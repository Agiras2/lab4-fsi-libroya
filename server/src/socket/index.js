import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

/** Instancia singleton de Socket.IO */
let _io = null;

/**
 * Inicializa Socket.IO sobre el httpServer dado.
 * Debe llamarse UNA sola vez desde src/index.js.
 */
export function initSocket(httpServer) {
  const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

  const io = new SocketIOServer(httpServer, {
    cors: { origin: allowedOrigin, methods: ['GET', 'POST'] },
  });

  // ── Autenticación del handshake ──────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      // Punto 1: Conexión de invitado anónimo permitida (recibe eventos públicos)
      socket.data.role = 'guest';
      return next();
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      next();
    } catch {
      // Si se proporciona un token pero es inválido o expiró, rechazar
      next(new Error('connection:error — token inválido'));
    }
  });

  // ── Asignación de salas (el servidor decide, no el navegador) ────────────
  io.on('connection', (socket) => {
    const { userId, role } = socket.data;
    if (userId) {
      socket.join(`user:${userId}`);
    }
    if (role === 'admin') {
      socket.join('admins');
    }
  });

  _io = io;
  return io;
}

/**
 * Devuelve la instancia de Socket.IO.
 * Los controladores la usan para emitir eventos.
 */
export function getIO() {
  return _io; // null en tests; los controladores manejan el caso graciosamente
}
