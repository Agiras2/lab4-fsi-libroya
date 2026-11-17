import Order from '../models/Order.js';
import Book from '../models/Book.js';

/**
 * GET /api/library
 * Devuelve los ebooks comprados y pagados por el cliente autenticado,
 * incluyendo su URL de descarga (ebookFileUrl).
 */
export async function getMyLibrary(req, res, next) {
  try {
    // 1. Buscamos todos los pedidos pagados del cliente
    const paidOrders = await Order.find({
      userId: req.user.id,
      paymentStatus: 'PAGADO',
    });

    // 2. Extraemos los bookIds de los ebooks comprados
    const ebookIdSet = new Set();
    const purchaseDateMap = new Map();

    for (const order of paidOrders) {
      for (const item of order.items) {
        if (item.format === 'ebook') {
          const idStr = item.bookId.toString();
          ebookIdSet.add(idStr);
          if (!purchaseDateMap.has(idStr)) {
            purchaseDateMap.set(idStr, order.createdAt);
          }
        }
      }
    }

    if (ebookIdSet.size === 0) {
      return res.json({ ebooks: [] });
    }

    // 3. Consultamos los libros incluyendo explícitamente ebookFileUrl
    const books = await Book.find({
      _id: { $in: Array.from(ebookIdSet) },
    }).select('+ebookFileUrl');

    const ebooks = books.map((b) => ({
      _id: b._id,
      title: b.title,
      author: b.author,
      category: b.category,
      coverUrl: b.coverUrl,
      description: b.description,
      ebookFileUrl: b.ebookFileUrl,
      purchasedAt: purchaseDateMap.get(b._id.toString()),
    }));

    return res.json({ ebooks });
  } catch (err) {
    next(err);
  }
}

