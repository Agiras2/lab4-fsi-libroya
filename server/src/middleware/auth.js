import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Middleware: verifica JWT en el header Authorization: Bearer <token>
 * Si es válido, adjunta req.user con los datos del usuario.
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticación no proporcionado' });
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Adjuntamos solo lo necesario, sin consultar la BD en cada request
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'La sesión ha expirado. Por favor, inicia sesión de nuevo.' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

