import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import express from 'express';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

import { connectDB } from '../src/config/db.js';
import booksRoutes from '../src/routes/books.routes.js';
import adminRoutes from '../src/routes/admin.routes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import Book from '../src/models/Book.js';
import User from '../src/models/User.js';

const app = express();
app.use(express.json());
app.use('/api/books', booksRoutes);
app.use('/api/admin', adminRoutes);
app.use(errorHandler);

let adminToken;
let clientToken;
let adminUser;
let clientUser;

beforeAll(async () => {
  await connectDB();
});

afterAll(async () => {
  await Book.deleteMany({});
  await User.deleteMany({});
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Book.deleteMany({});
  await User.deleteMany({});

  adminUser = await User.create({
    name: 'Admin Test',
    email: 'admin_test@libroya.com',
    passwordHash: 'hashed123',
    role: 'admin',
  });

  clientUser = await User.create({
    name: 'Cliente Test',
    email: 'cliente_test@libroya.com',
    passwordHash: 'hashed123',
    role: 'cliente',
  });

  adminToken = jwt.sign(
    { sub: adminUser._id.toString(), role: adminUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  clientToken = jwt.sign(
    { sub: clientUser._id.toString(), role: clientUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
});

describe('GET /api/books', () => {
  it('lista libros activos sin incluir ebookFileUrl en la respuesta pública', async () => {
    await Book.create([
      {
        title: 'Libro Físico Activo',
        author: 'Autor A',
        category: 'Novela',
        format: 'fisico',
        price: 15.0,
        stock: 5,
        active: true,
      },
      {
        title: 'Ebook Activo',
        author: 'Autor B',
        category: 'Ciencia',
        format: 'ebook',
        price: 9.99,
        ebookFileUrl: 'https://secret.com/book.epub',
        active: true,
      },
      {
        title: 'Libro Inactivo',
        author: 'Autor C',
        category: 'Historia',
        format: 'fisico',
        price: 12.0,
        stock: 3,
        active: false,
      },
    ]);

    const res = await request(app).get('/api/books');
    expect(res.status).toBe(200);
    expect(res.body.books).toHaveLength(2);

    // No debe contener ebookFileUrl
    const jsonStr = JSON.stringify(res.body.books);
    expect(jsonStr).not.toContain('ebookFileUrl');
    expect(jsonStr).not.toContain('https://secret.com/book.epub');
  });

  it('permite filtrar por formato, categoría y búsqueda de texto', async () => {
    await Book.create([
      {
        title: 'Don Quijote',
        author: 'Cervantes',
        category: 'Novela',
        format: 'ebook',
        price: 10.0,
        active: true,
      },
      {
        title: 'Cosmos',
        author: 'Carl Sagan',
        category: 'Ciencia',
        format: 'fisico',
        price: 25.0,
        stock: 4,
        active: true,
      },
    ]);

    // Filtrar por formato
    const resFormat = await request(app).get('/api/books?format=ebook');
    expect(resFormat.status).toBe(200);
    expect(resFormat.body.books).toHaveLength(1);
    expect(resFormat.body.books[0].title).toBe('Don Quijote');

    // Filtrar por búsqueda
    const resSearch = await request(app).get('/api/books?q=sagan');
    expect(resSearch.status).toBe(200);
    expect(resSearch.body.books).toHaveLength(1);
    expect(resSearch.body.books[0].title).toBe('Cosmos');
  });
});

describe('POST /api/books (Gestión Admin)', () => {
  it('permite a un admin crear un libro', async () => {
    const res = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Nuevo Libro',
        author: 'Nuevo Autor',
        category: 'Tecnología',
        format: 'fisico',
        price: 29.99,
        stock: 10,
      });

    expect(res.status).toBe(201);
    expect(res.body.book.title).toBe('Nuevo Libro');
  });

  it('deniega la creación a un usuario cliente (403)', async () => {
    const res = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Libro no autorizado',
        author: 'Autor',
        category: 'Novela',
        format: 'fisico',
        price: 20.0,
      });

    expect(res.status).toBe(403);
  });

  it('deniega la creación a usuarios no autenticados (401)', async () => {
    const res = await request(app).post('/api/books').send({
      title: 'Libro anónimo',
      author: 'Autor',
      category: 'Novela',
      format: 'fisico',
      price: 20.0,
    });

    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/books/:id/stock', () => {
  it('ajusta el stock de forma absoluta y con delta', async () => {
    const book = await Book.create({
      title: 'Libro de Stock',
      author: 'Autor',
      category: 'Novela',
      format: 'fisico',
      price: 15.0,
      stock: 5,
    });

    // Con delta positivo
    const resDelta = await request(app)
      .patch(`/api/books/${book._id}/stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ delta: 3 });

    expect(resDelta.status).toBe(200);
    expect(resDelta.body.book.stock).toBe(8);

    // Con valor absoluto
    const resAbs = await request(app)
      .patch(`/api/books/${book._id}/stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stock: 2 });

    expect(resAbs.status).toBe(200);
    expect(resAbs.body.book.stock).toBe(2);
  });

  it('rechaza si el stock resultante queda negativo', async () => {
    const book = await Book.create({
      title: 'Libro Escaso',
      author: 'Autor',
      category: 'Novela',
      format: 'fisico',
      price: 15.0,
      stock: 2,
    });

    const res = await request(app)
      .patch(`/api/books/${book._id}/stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ delta: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/negativo/i);
  });

  it('rechaza ajuste de stock para formato ebook', async () => {
    const ebook = await Book.create({
      title: 'Ebook Sin Stock',
      author: 'Autor',
      category: 'Novela',
      format: 'ebook',
      price: 10.0,
    });

    const res = await request(app)
      .patch(`/api/books/${ebook._id}/stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stock: 10 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ebooks no tienen stock/i);
  });
});

describe('GET /api/admin/low-stock', () => {
  it('devuelve solo libros físicos con stock <= lowStockThreshold', async () => {
    await Book.create([
      {
        title: 'Bajo Stock 1',
        author: 'Autor A',
        category: 'Novela',
        format: 'fisico',
        price: 10.0,
        stock: 2,
        lowStockThreshold: 3,
        active: true,
      },
      {
        title: 'Agotado',
        author: 'Autor B',
        category: 'Novela',
        format: 'fisico',
        price: 10.0,
        stock: 0,
        lowStockThreshold: 3,
        active: true,
      },
      {
        title: 'Stock Normal',
        author: 'Autor C',
        category: 'Novela',
        format: 'fisico',
        price: 10.0,
        stock: 10,
        lowStockThreshold: 3,
        active: true,
      },
    ]);

    const res = await request(app)
      .get('/api/admin/low-stock')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.books).toHaveLength(2);
    const titles = res.body.books.map((b) => b.title);
    expect(titles).toContain('Bajo Stock 1');
    expect(titles).toContain('Agotado');
    expect(titles).not.toContain('Stock Normal');
  });
});

