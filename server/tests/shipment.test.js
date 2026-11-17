import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import express from 'express';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

import { connectDB } from '../src/config/db.js';
import ordersRoutes from '../src/routes/orders.routes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import Book from '../src/models/Book.js';
import User from '../src/models/User.js';
import Order from '../src/models/Order.js';

const app = express();
app.use(express.json());
app.use('/api/orders', ordersRoutes);
app.use(errorHandler);

let adminUser;
let clientUser;
let adminToken;
let clientToken;

beforeAll(async () => {
  await connectDB();
});

afterAll(async () => {
  await Order.deleteMany({});
  await Book.deleteMany({});
  await User.deleteMany({});
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Order.deleteMany({});
  await Book.deleteMany({});
  await User.deleteMany({});

  adminUser = await User.create({
    name: 'Admin Envíos',
    email: 'admin_envios@libroya.com',
    passwordHash: 'pass123',
    role: 'admin',
  });

  clientUser = await User.create({
    name: 'Cliente Regular',
    email: 'cliente_envios@libroya.com',
    passwordHash: 'pass123',
    role: 'cliente',
  });

  adminToken = jwt.sign(
    { sub: adminUser._id.toString(), role: adminUser.role, name: adminUser.name },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  clientToken = jwt.sign(
    { sub: clientUser._id.toString(), role: clientUser.role, name: clientUser.name },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
});

describe('Máquina de Estados de Envío: PATCH /api/orders/:id/shipment-status', () => {
  it('permite avanzar un solo paso válido (PENDIENTE → PREPARANDO) y registra la entrada en shipmentHistory', async () => {
    const book = await Book.create({
      title: 'Libro Físico',
      author: 'Autor',
      category: 'Novela',
      format: 'fisico',
      price: 20.0,
      stock: 5,
    });

    const order = await Order.create({
      userId: clientUser._id,
      items: [
        {
          bookId: book._id,
          title: book.title,
          format: 'fisico',
          unitPrice: 20.0,
          quantity: 1,
        },
      ],
      hasPhysical: true,
      shippingAddress: {
        fullName: 'Cliente Regular',
        street: 'Calle 10',
        city: 'Medellín',
        phone: '1234567',
      },
      subtotal: 20.0,
      shippingCost: 4.99,
      total: 24.99,
      paymentStatus: 'PAGADO',
      shipmentStatus: 'PENDIENTE',
      shipmentHistory: [
        {
          status: 'PENDIENTE',
          changedBy: 'PayPal Sandbox (Pago verificado)',
          changedAt: new Date(),
        },
      ],
    });

    const res = await request(app)
      .patch(`/api/orders/${order._id}/shipment-status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PREPARANDO' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.order.shipmentStatus).toBe('PREPARANDO');
    expect(res.body.order.shipmentHistory).toHaveLength(2);
    expect(res.body.order.shipmentHistory[1].status).toBe('PREPARANDO');
    expect(res.body.order.shipmentHistory[1].changedBy).toBe('Admin Envíos');
  });

  it('rechaza saltar estados de envío (PENDIENTE → ENVIADO: 400)', async () => {
    const book = await Book.create({
      title: 'Libro Salto',
      author: 'Autor',
      category: 'Novela',
      format: 'fisico',
      price: 15.0,
      stock: 5,
    });

    const order = await Order.create({
      userId: clientUser._id,
      items: [
        {
          bookId: book._id,
          title: book.title,
          format: 'fisico',
          unitPrice: 15.0,
          quantity: 1,
        },
      ],
      hasPhysical: true,
      shippingAddress: {
        fullName: 'Destinatario',
        street: 'Calle 5',
        city: 'Cali',
        phone: '123',
      },
      subtotal: 15.0,
      shippingCost: 4.99,
      total: 19.99,
      paymentStatus: 'PAGADO',
      shipmentStatus: 'PENDIENTE',
    });

    const res = await request(app)
      .patch(`/api/orders/${order._id}/shipment-status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ENVIADO' }); // Intento de salto

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/saltar estados/i);

    // El estado en la BD no debe cambiar
    const check = await Order.findById(order._id);
    expect(check.shipmentStatus).toBe('PENDIENTE');
  });

  it('rechaza retroceder de estado de envío (PREPARANDO → PENDIENTE: 400)', async () => {
    const book = await Book.create({
      title: 'Libro Retroceso',
      author: 'Autor',
      category: 'Novela',
      format: 'fisico',
      price: 10.0,
      stock: 5,
    });

    const order = await Order.create({
      userId: clientUser._id,
      items: [
        {
          bookId: book._id,
          title: book.title,
          format: 'fisico',
          unitPrice: 10.0,
          quantity: 1,
        },
      ],
      hasPhysical: true,
      shippingAddress: {
        fullName: 'Destinatario',
        street: 'Calle 5',
        city: 'Cali',
        phone: '123',
      },
      subtotal: 10.0,
      shippingCost: 4.99,
      total: 14.99,
      paymentStatus: 'PAGADO',
      shipmentStatus: 'PREPARANDO',
    });

    const res = await request(app)
      .patch(`/api/orders/${order._id}/shipment-status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PENDIENTE' }); // Intento de retroceso

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/retroceder de estado/i);

    const check = await Order.findById(order._id);
    expect(check.shipmentStatus).toBe('PREPARANDO');
  });

  it('deniega a un usuario cliente cambiar el estado de envío (403)', async () => {
    const book = await Book.create({
      title: 'Libro Cliente No Autorizado',
      author: 'Autor',
      category: 'Novela',
      format: 'fisico',
      price: 12.0,
      stock: 3,
    });

    const order = await Order.create({
      userId: clientUser._id,
      items: [
        {
          bookId: book._id,
          title: book.title,
          format: 'fisico',
          unitPrice: 12.0,
          quantity: 1,
        },
      ],
      hasPhysical: true,
      shippingAddress: {
        fullName: 'Cliente',
        street: 'Calle 1',
        city: 'Bogota',
        phone: '123',
      },
      subtotal: 12.0,
      shippingCost: 4.99,
      total: 16.99,
      paymentStatus: 'PAGADO',
      shipmentStatus: 'PENDIENTE',
    });

    const res = await request(app)
      .patch(`/api/orders/${order._id}/shipment-status`)
      .set('Authorization', `Bearer ${clientToken}`) // Token de cliente
      .send({ status: 'PREPARANDO' });

    expect(res.status).toBe(403);
  });

  it('rechaza gestionar el envío de un pedido que no ha sido pagado (400)', async () => {
    const book = await Book.create({
      title: 'Libro No Pagado',
      author: 'Autor',
      category: 'Novela',
      format: 'fisico',
      price: 18.0,
      stock: 2,
    });

    const order = await Order.create({
      userId: clientUser._id,
      items: [
        {
          bookId: book._id,
          title: book.title,
          format: 'fisico',
          unitPrice: 18.0,
          quantity: 1,
        },
      ],
      hasPhysical: true,
      shippingAddress: {
        fullName: 'Cliente',
        street: 'Calle 1',
        city: 'Bogota',
        phone: '123',
      },
      subtotal: 18.0,
      shippingCost: 4.99,
      total: 22.99,
      paymentStatus: 'PENDIENTE_PAGO', // NO pagado
    });

    const res = await request(app)
      .patch(`/api/orders/${order._id}/shipment-status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PREPARANDO' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no ha sido pagado/i);
  });
});

