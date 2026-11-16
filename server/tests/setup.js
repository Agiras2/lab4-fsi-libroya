/**
 * Setup global para las pruebas del backend.
 * Usa una BD en memoria o la misma MONGODB_URI con un prefijo de test
 * para no contaminar datos de desarrollo.
 */
import 'dotenv/config';

// Sobrescribir la URI de Mongo para tests si se usa Atlas
// (en CI se puede usar mongodb-memory-server en su lugar)
if (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('test')) {
  // Agrega sufijo -test a la base de datos para aislar los datos
  process.env.MONGODB_URI = process.env.MONGODB_URI.replace(
    /\/([^/?]+)(\?|$)/,
    '/libroya-test$2'
  );
}

