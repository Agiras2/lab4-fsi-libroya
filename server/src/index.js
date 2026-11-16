import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const httpServer = createServer(app);

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

app.use(
  cors({
    origin: allowedOrigin,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body parser ─────────────────────────────────────────────────────────────
app.use(express.json());

// ─── Socket.IO (mismo proceso que Express) ───────────────────────────────────
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST'],
  },
});

// Autenticación del handshake con JWT
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('connection:error — token no proporcionado'));
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.userId = payload.sub;
    socket.data.role = payload.role;
    next();
  } catch {
    next(new Error('connection:error — token inválido'));
  }
});

io.on('connection', (socket) => {
  const { userId, role } = socket.data;

  // Sala personal del usuario (el servidor asigna la sala, no el navegador)
  socket.join(`user:${userId}`);

  // Sala de administradores
  if (role === 'admin') {
    socket.join('admins');
  }
});

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Rutas API ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// 404 para rutas desconocidas
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// ─── Manejador de errores global ─────────────────────────────────────────────
app.use(errorHandler);

// ─── Arranque ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`[Server] LibroYa API corriendo en http://localhost:${PORT}`);
    console.log(`[Server] CORS permitido para: ${allowedOrigin}`);
  });
});
