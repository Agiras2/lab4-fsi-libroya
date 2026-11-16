import Book from '../models/Book.js';
import { getIO } from '../socket/index.js';

/** Emite un evento de Socket.IO sin fallar si io no está inicializado (tests) */
function emit(event, data) {
  try { getIO()?.emit(event, data); } catch { /* no-op */ }
}

// ── GET /api/books ───────────────────────────────────────────────────────────
export async function listBooks(req, res, next) {
  try {
    const { category, format, q } = req.query;
    const filter = {};

    // Admins ven todos los libros; el público solo los activos
    if (req.user?.role !== 'admin') filter.active = true;

    if (category) filter.category = category;
    if (format) filter.format = format;
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { author: { $regex: q, $options: 'i' } },
      ];
    }

    const books = await Book.find(filter)
      .select('-ebookFileUrl')
      .sort({ createdAt: -1 });

    return res.json({ books });
  } catch (err) { next(err); }
}

// ── GET /api/books/:id ───────────────────────────────────────────────────────
export async function getBook(req, res, next) {
  try {
    const book = await Book.findById(req.params.id).select('-ebookFileUrl');
    if (!book) return res.status(404).json({ error: 'Libro no encontrado' });
    return res.json({ book });
  } catch (err) { next(err); }
}

// ── POST /api/books ──────────────────────────────────────────────────────────
export async function createBook(req, res, next) {
  try {
    const book = await Book.create(req.body);
    return res.status(201).json({ book });
  } catch (err) { next(err); }
}

// ── PATCH /api/books/:id ─────────────────────────────────────────────────────
export async function updateBook(req, res, next) {
  try {
    // Nunca permitir cambiar ebookFileUrl desde este endpoint si no hay intención clara
    const { ebookFileUrl, ...rest } = req.body;
    const updateData = { ...rest };
    if (ebookFileUrl !== undefined) updateData.ebookFileUrl = ebookFileUrl;

    const book = await Book.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-ebookFileUrl');

    if (!book) return res.status(404).json({ error: 'Libro no encontrado' });

    emit('book:stockChanged', {
      bookId: book._id.toString(),
      stock: book.stock,
      title: book.title,
    });

    return res.json({ book });
  } catch (err) { next(err); }
}

// ── PATCH /api/books/:id/stock ───────────────────────────────────────────────
export async function updateStock(req, res, next) {
  try {
    const { stock, delta } = req.body;

    if (stock === undefined && delta === undefined) {
      return res.status(400).json({ error: 'Se requiere "stock" (valor absoluto) o "delta" (incremento)' });
    }

    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Libro no encontrado' });
    if (book.format !== 'fisico') {
      return res.status(400).json({ error: 'Los ebooks no tienen stock' });
    }

    if (delta !== undefined) {
      const newStock = book.stock + Number(delta);
      if (newStock < 0) {
        return res.status(400).json({ error: 'El stock no puede quedar negativo' });
      }
      book.stock = newStock;
    } else {
      if (Number(stock) < 0) {
        return res.status(400).json({ error: 'El stock no puede ser negativo' });
      }
      book.stock = Number(stock);
    }

    await book.save();

    emit('book:stockChanged', {
      bookId: book._id.toString(),
      stock: book.stock,
      title: book.title,
    });

    return res.json({ book: { _id: book._id, title: book.title, stock: book.stock } });
  } catch (err) { next(err); }
}

// ── GET /api/admin/low-stock ─────────────────────────────────────────────────
export async function lowStock(req, res, next) {
  try {
    const books = await Book.find({
      format: 'fisico',
      active: true,
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    })
      .select('-ebookFileUrl')
      .sort({ stock: 1 });

    return res.json({ books });
  } catch (err) { next(err); }
}

