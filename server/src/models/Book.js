import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'El título es obligatorio'], trim: true },
    author: { type: String, required: [true, 'El autor es obligatorio'], trim: true },
    isbn: {
      type: String,
      trim: true,
      sparse: true, // único cuando está presente; permite múltiples sin ISBN
      index: true,
    },
    description: { type: String, default: '' },
    category: {
      type: String,
      enum: ['Novela', 'Ciencia', 'Historia', 'Infantil', 'Tecnología', 'Poesía', 'Otro'],
      required: [true, 'La categoría es obligatoria'],
    },
    format: {
      type: String,
      enum: ['fisico', 'ebook'],
      required: [true, 'El formato es obligatorio'],
    },
    price: {
      type: Number,
      required: [true, 'El precio es obligatorio'],
      min: [0.01, 'El precio debe ser positivo'],
    },
    coverUrl: { type: String, default: '' },
    // Solo fisico
    stock: {
      type: Number,
      integer: true,
      min: [0, 'El stock no puede ser negativo'],
      default: 0,
    },
    lowStockThreshold: { type: Number, default: 3, min: 0 },
    // Solo ebook — NUNCA se devuelve en el catálogo público
    ebookFileUrl: { type: String, select: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Índice de búsqueda de texto
bookSchema.index({ title: 'text', author: 'text' });

export default mongoose.models.Book || mongoose.model('Book', bookSchema);

