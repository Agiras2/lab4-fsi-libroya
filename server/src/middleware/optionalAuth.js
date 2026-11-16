import jwt from 'jsonwebtoken';

/**
 * Middleware opcional: si hay un Bearer válido adjunta req.user,
 * pero NO rechaza si no lo hay. Útil para rutas públicas con
 * comportamiento diferenciado por rol (ej. listado de libros).
 */
export function optionalAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: payload.sub, role: payload.role };
    }
  } catch {
    // token inválido o expirado → continuar como anónimo
  }
  next();
}

