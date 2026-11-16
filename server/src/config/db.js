import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('[DB] MONGODB_URI no está definida en .env');
  process.exit(1);
}

export async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('[DB] Conectado a MongoDB Atlas');
  } catch (err) {
    console.error('[DB] Error de conexión:', err.message);
    process.exit(1);
  }
}

