import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import { connectDB } from '../src/config/db.js';
import authRoutes from '../src/routes/auth.routes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import User from '../src/models/User.js';

// ── App de prueba (sin Socket.IO para simplificar) ────────────────────────
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(errorHandler);

// ── Ciclo de vida de la BD ─────────────────────────────────────────────────
beforeAll(async () => {
  await connectDB();
});

afterAll(async () => {
  // Vaciamos colecciones (el usuario de la app no tiene permiso de dropDatabase)
  await User.deleteMany({});
  await mongoose.disconnect();
});

beforeEach(async () => {
  await User.deleteMany({});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('crea un usuario con rol cliente y devuelve un token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Ana Pérez',
      email: 'ana@test.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('cliente');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rechaza si falta el nombre', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'sin-nombre@test.com',
      password: 'password123',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('rechaza contraseña menor de 8 caracteres', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test',
      email: 'corta@test.com',
      password: '123',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 caracteres/i);
  });

  it('rechaza email duplicado', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Primera',
      email: 'dup@test.com',
      password: 'password123',
    });
    const res = await request(app).post('/api/auth/register').send({
      name: 'Segunda',
      email: 'dup@test.com',
      password: 'password456',
    });
    expect(res.status).toBe(409);
  });

  it('el navegador no puede asignar rol admin', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Hacker',
      email: 'hacker@test.com',
      password: 'password123',
      role: 'admin', // debe ser ignorado
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('cliente');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Usuario Login',
      email: 'login@test.com',
      password: 'correcta123',
    });
  });

  it('login correcto devuelve token y datos del usuario', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@test.com',
      password: 'correcta123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('login@test.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('login con contraseña incorrecta devuelve 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@test.com',
      password: 'incorrecta',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('login con email inexistente devuelve 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'noexiste@test.com',
      password: 'correcta123',
    });
    expect(res.status).toBe(401);
  });

  it('no devuelve passwordHash en ningún caso', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@test.com',
      password: 'correcta123',
    });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  let token;

  beforeEach(async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Me User',
      email: 'me@test.com',
      password: 'mepassword',
    });
    token = res.body.token;
  });

  it('sin token devuelve 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('con token válido devuelve los datos del usuario', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@test.com');
  });

  it('con token inválido devuelve 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token.falso.invalido');
    expect(res.status).toBe(401);
  });
});

