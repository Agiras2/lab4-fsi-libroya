import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import express from 'express';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

import { connectDB } from '../src/config/db.js';
import ordersRoutes from '../src/routes/orders.routes.js';
import paymentsRoutes from '../src/routes/payments.routes.js';
import libraryRoutes from '../src/routes/library.routes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import Book from '../src/models/Book.js';
import User from '../src/models/User.js';
import Order from '../src/models/Order.js';
import Payment from '../src/models/Payment.js';
import * as paypalService from '../src/services/paypal.service.js';

const app = express();
app.use(express.json());
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/library', libraryRoutes);
app.use(errorHandler);

let clientA;
let clientB;
let tokenA;
let tokenB;

beforeAll(async () => {
  await connectDB();
});

afterAll(async () => {
  await Order.deleteMany({});
  await Payment.deleteMany({});
  await Book.deleteMany({});
  await User.deleteMany({});
  await mongoose.disconnect();
});

beforeEach(async () => {
  vi.restoreAllMocks();

  await Order.deleteMany({});
  await Payment.deleteMany({});
  await Book.deleteMany({});
  await User.deleteMany({});

  clientA = await User.create({
    name: 'Cliente A',
    email: 'clienta@test.com',
    passwordHash: 'hash123',
    role: 'cliente',
  });

  clientB = await User.create({
    name: 'Cliente B',
    email: 'clientb@test.com',
    passwordHash: 'hash123',
    role: 'cliente',
  });

  tokenA = jwt.sign(
    { sub: clientA._id.toString(), role: clientA.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  tokenB = jwt.sign(
    { sub: clientB._id.toString(), role: clientB.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
});

describe('POST /api/orders (Creación de pedidos)', () => {
  it('rechaza que un admin cree un pedido (403)', async () => {
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@test.com',
      passwordHash: 'hash123',
      role: 'admin',
    });
    const adminToken = jwt.sign(
      { sub: admin._id.toString(), role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [] });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/no tienes permiso/i);
  });

  it('recalcula el precio en el servidor e ignora precios enviados por el cliente', async () => {
    const book = await Book.create({
      title: 'Libro Caro',
      author: 'Autor',
      category: 'Novela',
      format: 'fisico',
      price: 50.0,
      stock: 5,
    });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [
          {
            bookId: book._id,
            quantity: 2,
            unitPrice: 0.01, // Intento de manipulación de precio
            total: 0.02,
          },
        ],
        shippingAddress: {
          fullName: 'Juan Pérez',
          street: 'Calle 10 # 20-30',
          city: 'Medellín',
          phone: '3001234567',
        },
      });

    expect(res.status).toBe(201);
    // Subtotal: 50.00 * 2 = 100.00. Envío físico: 4.99. Total: 104.99
    expect(res.body.order.subtotal).toBe(100.0);
    expect(res.body.order.shippingCost).toBe(4.99);
    expect(res.body.order.total).toBe(104.99);
    expect(res.body.order.items[0].unitPrice).toBe(50.0);
    expect(res.body.order.items[0].title).toBe('Libro Caro');
  });

  it('un pedido recién creado no tiene shipmentStatus ni shipmentHistory (Punto 2)', async () => {
    const book = await Book.create({
      title: 'Libro Sin Envio Inicial',
      author: 'Autor',
      category: 'Novela',
      format: 'fisico',
      price: 25.0,
      stock: 5,
    });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ bookId: book._id, quantity: 1 }],
        shippingAddress: {
          fullName: 'Juan Pérez',
          street: 'Calle 10',
          city: 'Medellín',
          phone: '3001234567',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.order.paymentStatus).toBe('PENDIENTE_PAGO');
    // shipmentStatus debe ser undefined en el pedido recién creado
    expect(res.body.order.shipmentStatus).toBeUndefined();
    // shipmentHistory debe estar vacío
    expect(res.body.order.shipmentHistory).toEqual([]);
  });

  it('combina ítems con el mismo bookId sumando cantidades y fuerza la cantidad de ebooks a 1 (Punto 4)', async () => {
    const physicalBook = await Book.create({
      title: 'Libro Múltiple',
      author: 'Autor',
      category: 'Novela',
      format: 'fisico',
      price: 20.0,
      stock: 10,
    });

    const ebook = await Book.create({
      title: 'Ebook Cantidad',
      author: 'Autor',
      category: 'Ciencia',
      format: 'ebook',
      price: 10.0,
      stock: 0,
    });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [
          { bookId: physicalBook._id, quantity: 2 },
          { bookId: physicalBook._id, quantity: 3 }, // Mismo físico en dos líneas -> suma 5
          { bookId: ebook._id, quantity: 4 },        // Ebook con cantidad 4 -> debe forzarse a 1
        ],
        shippingAddress: {
          fullName: 'Juan Pérez',
          street: 'Calle 10',
          city: 'Medellín',
          phone: '3001234567',
        },
      });

    expect(res.status).toBe(201);
    const items = res.body.order.items;
    expect(items).toHaveLength(2);

    const physicalItem = items.find((i) => i.format === 'fisico');
    expect(physicalItem.quantity).toBe(5); // 2 + 3 = 5

    const ebookItem = items.find((i) => i.format === 'ebook');
    expect(ebookItem.quantity).toBe(1); // Forzado a 1

    // Subtotal: (20 * 5) + (10 * 1) = 100 + 10 = 110. Total: 110 + 4.99 = 114.99
    expect(res.body.order.subtotal).toBe(110.0);
    expect(res.body.order.total).toBe(114.99);
  });

  it('rechaza el pedido si el stock de un libro físico es insuficiente', async () => {
    const book = await Book.create({
      title: 'Poco Stock',
      author: 'Autor',
      category: 'Ciencia',
      format: 'fisico',
      price: 20.0,
      stock: 1,
    });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ bookId: book._id, quantity: 2 }],
        shippingAddress: {
          fullName: 'Juan Pérez',
          street: 'Calle 10',
          city: 'Medellín',
          phone: '3001234567',
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/stock insuficiente/i);
  });

  it('permite comprar solo ebooks sin requerir shippingAddress y con shippingCost 0', async () => {
    const ebook = await Book.create({
      title: 'Don Quijote Ebook',
      author: 'Cervantes',
      category: 'Novela',
      format: 'ebook',
      price: 9.99,
      stock: 0, // Los ebooks tienen stock 0 y eso es correcto
      ebookFileUrl: 'https://gutenberg.org/quijote.epub',
    });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ bookId: ebook._id, quantity: 1 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.order.hasPhysical).toBe(false);
    expect(res.body.order.shippingCost).toBe(0);
    expect(res.body.order.total).toBe(9.99);
    expect(res.body.order.shippingAddress).toBeUndefined();
  });
});

describe('Flujo de Pago y Captura con PayPal Simulado', () => {
  it('impide que un cliente cree orden o capture el pago de un pedido ajeno (403)', async () => {
    const book = await Book.create({
      title: 'Libro A',
      author: 'Autor',
      category: 'Novela',
      format: 'ebook',
      price: 15.0,
    });

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ items: [{ bookId: book._id, quantity: 1 }] });

    const orderId = orderRes.body.order._id;

    // Cliente B intenta generar orden PayPal para el pedido de Cliente A
    const payRes = await request(app)
      .post('/api/payments/paypal/order')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ orderId });

    expect(payRes.status).toBe(403);
    expect(payRes.body.error).toMatch(/no tienes permiso/i);

    // Cliente B intenta capturar pedido de Cliente A
    const capRes = await request(app)
      .post('/api/payments/paypal/capture')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ orderId, providerOrderId: 'ORDER-123' });

    expect(capRes.status).toBe(403);
  });

  it('rechaza la captura si el providerOrderId pertenece a otro pedido o no existe, sin tocar stock ni llamar a PayPal (Punto 1)', async () => {
    const physicalBook = await Book.create({
      title: 'Libro Protegido Pre-Captura',
      author: 'Autor',
      category: 'Historia',
      format: 'fisico',
      price: 30.0,
      stock: 10,
    });

    // Pedido 1 de Cliente A
    const orderRes1 = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ bookId: physicalBook._id, quantity: 2 }],
        shippingAddress: {
          fullName: 'Cliente A',
          street: 'Calle 1',
          city: 'Bogotá',
          phone: '123',
        },
      });
    const order1 = orderRes1.body.order;

    // Pedido 2 de Cliente A
    const orderRes2 = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ bookId: physicalBook._id, quantity: 2 }],
        shippingAddress: {
          fullName: 'Cliente A',
          street: 'Calle 2',
          city: 'Bogotá',
          phone: '123',
        },
      });
    const order2 = orderRes2.body.order;

    // Registramos la orden PayPal SOLO para el pedido 2
    await Payment.create({
      orderId: order2._id,
      provider: 'paypal',
      providerOrderId: 'PAYPAL-ORD-FOR-ORDER-2',
      amount: order2.total,
      currency: 'USD',
      status: 'CREATED',
    });

    const paypalCaptureSpy = vi.spyOn(paypalService, 'capturePayPalOrder');

    // Intentamos capturar el Pedido 1 usando el providerOrderId del Pedido 2
    const resMismatched = await request(app)
      .post('/api/payments/paypal/capture')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        orderId: order1._id,
        providerOrderId: 'PAYPAL-ORD-FOR-ORDER-2',
      });

    expect(resMismatched.status).toBe(400);
    expect(resMismatched.body.error).toMatch(/no corresponde al pedido/i);

    // Intentamos capturar con un providerOrderId inexistente
    const resNonExistent = await request(app)
      .post('/api/payments/paypal/capture')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        orderId: order1._id,
        providerOrderId: 'PAYPAL-ORD-INEXISTENTE',
      });

    expect(resNonExistent.status).toBe(400);
    expect(resNonExistent.body.error).toMatch(/no existe una orden de pago/i);

    // Verificar que NUNCA se llamó a PayPal capture
    expect(paypalCaptureSpy).not.toHaveBeenCalled();

    // Verificar que el stock físico permanece intacto en 10
    const bookCheck = await Book.findById(physicalBook._id);
    expect(bookCheck.stock).toBe(10);
  });

  it('captura con éxito, descuenta stock atómicamente, asigna shipmentStatus y es idempotente ante doble captura', async () => {
    const physicalBook = await Book.create({
      title: 'Libro Físico Atómico',
      author: 'Autor',
      category: 'Novela',
      format: 'fisico',
      price: 20.0,
      stock: 5,
    });

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ bookId: physicalBook._id, quantity: 2 }],
        shippingAddress: {
          fullName: 'Cliente A',
          street: 'Av 1',
          city: 'Cali',
          phone: '123456',
        },
      });

    const order = orderRes.body.order;

    // Simular servicios de PayPal
    vi.spyOn(paypalService, 'createPayPalOrder').mockResolvedValue({
      id: 'PAYPAL-ORD-999',
    });

    vi.spyOn(paypalService, 'capturePayPalOrder').mockResolvedValue({
      id: 'PAYPAL-ORD-999',
      status: 'COMPLETED',
      purchase_units: [
        {
          reference_id: order._id.toString(),
          payments: {
            captures: [
              {
                id: 'CAPTURE-111',
                status: 'COMPLETED',
                amount: {
                  currency_code: 'USD',
                  value: order.total.toFixed(2),
                },
              },
            ],
          },
        },
      ],
    });

    // 1. Crear orden PayPal
    const createRes = await request(app)
      .post('/api/payments/paypal/order')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderId: order._id });

    expect(createRes.status).toBe(200);
    expect(createRes.body.providerOrderId).toBe('PAYPAL-ORD-999');

    // 2. Primera captura: debe descontar stock de 5 a 3, marcar PAGADO y asignar shipmentStatus PENDIENTE
    const capture1 = await request(app)
      .post('/api/payments/paypal/capture')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderId: order._id, providerOrderId: 'PAYPAL-ORD-999' });

    expect(capture1.status).toBe(200);
    expect(capture1.body.success).toBe(true);
    expect(capture1.body.order.paymentStatus).toBe('PAGADO');
    expect(capture1.body.order.shipmentStatus).toBe('PENDIENTE');
    expect(capture1.body.order.shipmentHistory).toHaveLength(1);

    // Verificar stock descontado
    const checkBook1 = await Book.findById(physicalBook._id);
    expect(checkBook1.stock).toBe(3); // 5 - 2 = 3

    // 3. Segunda captura idéntica (Idempotencia): no debe volver a descontar ni fallar
    const capture2 = await request(app)
      .post('/api/payments/paypal/capture')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderId: order._id, providerOrderId: 'PAYPAL-ORD-999' });

    expect(capture2.status).toBe(200);
    expect(capture2.body.success).toBe(true);

    // Stock sigue siendo 3, no se cobró ni descontó doble
    const checkBook2 = await Book.findById(physicalBook._id);
    expect(checkBook2.stock).toBe(3);
  });

  it('restituye el stock si la llamada a PayPal capture falla', async () => {
    const physicalBook = await Book.create({
      title: 'Libro Rollback',
      author: 'Autor',
      category: 'Historia',
      format: 'fisico',
      price: 30.0,
      stock: 4,
    });

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ bookId: physicalBook._id, quantity: 1 }],
        shippingAddress: {
          fullName: 'Cliente A',
          street: 'Av 1',
          city: 'Cali',
          phone: '123456',
        },
      });

    const order = orderRes.body.order;

    // Crear registro previo Payment con status CREATED
    await Payment.create({
      orderId: order._id,
      provider: 'paypal',
      providerOrderId: 'PAYPAL-FAIL-1',
      amount: order.total,
      currency: 'USD',
      status: 'CREATED',
    });

    // Simular que PayPal arroja error en capture
    vi.spyOn(paypalService, 'capturePayPalOrder').mockRejectedValue(
      new Error('PAYPAL_GATEWAY_TIMEOUT')
    );

    const capRes = await request(app)
      .post('/api/payments/paypal/capture')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderId: order._id, providerOrderId: 'PAYPAL-FAIL-1' });

    expect(capRes.status).toBe(400);
    expect(capRes.body.error).toMatch(/error al capturar/i);

    // Verificar que el stock se restituyó a 4
    const restoredBook = await Book.findById(physicalBook._id);
    expect(restoredBook.stock).toBe(4);

    // El pedido no debe estar pagado ni tener shipmentStatus
    const checkOrder = await Order.findById(order._id);
    expect(checkOrder.paymentStatus).toBe('PENDIENTE_PAGO');
    expect(checkOrder.shipmentStatus).toBeUndefined();
  });

  it('GET /api/library entrega los ebooks comprados con su URL de descarga tras el pago', async () => {
    const ebook = await Book.create({
      title: 'Ebook Biblioteca',
      author: 'Autor Digital',
      category: 'Tecnología',
      format: 'ebook',
      price: 15.0,
      ebookFileUrl: 'https://gutenberg.org/ebook-secreto.epub',
    });

    // Crear y pagar pedido
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ items: [{ bookId: ebook._id, quantity: 1 }] });

    const order = orderRes.body.order;

    await Payment.create({
      orderId: order._id,
      provider: 'paypal',
      providerOrderId: 'PAYPAL-EBOOK-1',
      amount: order.total,
      currency: 'USD',
      status: 'CREATED',
    });

    vi.spyOn(paypalService, 'capturePayPalOrder').mockResolvedValue({
      id: 'PAYPAL-EBOOK-1',
      status: 'COMPLETED',
      purchase_units: [
        {
          reference_id: order._id.toString(),
          payments: {
            captures: [
              {
                id: 'CAP-EB',
                status: 'COMPLETED',
                amount: { currency_code: 'USD', value: '15.00' },
              },
            ],
          },
        },
      ],
    });

    await request(app)
      .post('/api/payments/paypal/capture')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderId: order._id, providerOrderId: 'PAYPAL-EBOOK-1' });

    // Consultar biblioteca
    const libRes = await request(app)
      .get('/api/library')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(libRes.status).toBe(200);
    expect(libRes.body.ebooks).toHaveLength(1);
    expect(libRes.body.ebooks[0].title).toBe('Ebook Biblioteca');
    expect(libRes.body.ebooks[0].ebookFileUrl).toBe('https://gutenberg.org/ebook-secreto.epub');

    // Cliente B no debe ver los ebooks de Cliente A
    const libResB = await request(app)
      .get('/api/library')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(libResB.status).toBe(200);
    expect(libResB.body.ebooks).toHaveLength(0);
  });
});
