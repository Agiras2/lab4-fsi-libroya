import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

import { connectDB } from './config/db.js';
import { initSocket } from './socket/index.js';
import authRoutes from './routes/auth.routes.js';
import booksRoutes from './routes/books.routes.js';
import adminRoutes from './routes/admin.routes.js';
import ordersRoutes from './routes/orders.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import libraryRoutes from './routes/library.routes.js';
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
export const io = initSocket(httpServer);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Rutas API ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/library', libraryRoutes);

// 404 para rutas desconocidas
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// ─── Manejador de errores global ─────────────────────────────────────────────
app.use(errorHandler);

// ─── Arranque ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

// Solo escuchar cuando no estamos en modo prueba (vitest no debe bloquear el puerto)
if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    httpServer.listen(PORT, () => {
      console.log(`[Server] LibroYa API corriendo en http://localhost:${PORT}`);
      console.log(`[Server] CORS permitido para: ${allowedOrigin}`);
    });
  });
}

export { app, httpServer };
