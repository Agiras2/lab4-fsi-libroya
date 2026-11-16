/**
 * Factory: crea un middleware que exige que req.user tenga el rol indicado.
 * Debe usarse DESPUÉS del middleware authenticate.
 *
 * @param {...string} roles - Roles permitidos ('admin', 'cliente')
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permiso para realizar esta acción' });
    }
    next();
  };
}

