/**
 * Manejador de errores global de Express.
 * Convierte todos los errores en la forma uniforme { error: "mensaje" }
 * sin filtrar detalles internos al cliente.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Errores de validación de Mongoose
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: messages.join('. ') });
  }

  // Clave duplicada (ej. email único)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ error: `Ya existe un registro con ese ${field}` });
  }

  // CastError — ID de Mongo inválido
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'ID con formato inválido' });
  }

  // Log del error real (sin secretos)
  console.error(`[Error] ${err.message}`);

  const status = err.status || err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && status === 500
      ? 'Error interno del servidor'
      : (err.message || 'Error interno del servidor');

  return res.status(status).json({ error: message });
}

