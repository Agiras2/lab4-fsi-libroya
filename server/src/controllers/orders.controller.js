import Order from '../models/Order.js';
import Book from '../models/Book.js';

/**
 * POST /api/orders
 * Crea un pedido pendiente de pago recalculando precios en el servidor.
 */
export async function createOrder(req, res, next) {
  try {
    const { items, shippingAddress } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El pedido debe contener al menos un producto' });
    }

    // 1. Validar formato básico y combinar líneas duplicadas sumando cantidades
    const combinedQuantities = new Map();
    for (const item of items) {
      if (!item.bookId || !item.quantity || Number(item.quantity) < 1) {
        return res.status(400).json({ error: 'Ítems inválidos o cantidad menor a 1' });
      }
      const idStr = item.bookId.toString();
      const qty = parseInt(item.quantity, 10);
      combinedQuantities.set(idStr, (combinedQuantities.get(idStr) || 0) + qty);
    }

    // 2. Buscamos los libros en la base de datos
    const bookIds = Array.from(combinedQuantities.keys());
    const booksInDb = await Book.find({ _id: { $in: bookIds } });
    const booksMap = new Map(booksInDb.map((b) => [b._id.toString(), b]));

    const snapshotItems = [];
    let hasPhysical = false;
    let subtotal = 0;

    for (const [idStr, rawQty] of combinedQuantities.entries()) {
      const book = booksMap.get(idStr);
      if (!book || !book.active) {
        return res.status(400).json({
          error: `El libro solicitado no existe o no está disponible: ${idStr}`,
        });
      }

      // Regla: Para libros con formato "ebook", forzar cantidad a 1
      const qty = book.format === 'ebook' ? 1 : rawQty;

      // Regla: Stock solo aplica a formato "fisico"
      if (book.format === 'fisico') {
        hasPhysical = true;
        if (book.stock < qty) {
          return res.status(400).json({
            error: `Stock insuficiente para "${book.title}". Quedan ${book.stock} unidades.`,
          });
        }
      }
      // Ebooks NO validan stock (tienen 0 y es correcto)

      const unitPrice = book.price;
      subtotal += unitPrice * qty;

      snapshotItems.push({
        bookId: book._id,
        title: book.title,
        format: book.format,
        unitPrice,
        quantity: qty,
      });
    }

    // Validación de dirección de envío
    if (hasPhysical) {
      if (
        !shippingAddress ||
        !shippingAddress.fullName?.trim() ||
        !shippingAddress.street?.trim() ||
        !shippingAddress.city?.trim() ||
        !shippingAddress.phone?.trim()
      ) {
        return res.status(400).json({
          error:
            'La dirección de envío (nombre, calle, ciudad y teléfono) es obligatoria para pedidos con libros físicos',
        });
      }
    }

    const shippingCost = hasPhysical ? 4.99 : 0;
    const formattedSubtotal = Number(subtotal.toFixed(2));
    const total = Number((formattedSubtotal + shippingCost).toFixed(2));

    // NO asignar shipmentStatus ni shipmentHistory al crear el pedido
    const order = new Order({
      userId: req.user.id,
      items: snapshotItems,
      hasPhysical,
      shippingAddress: hasPhysical
        ? {
            fullName: shippingAddress.fullName.trim(),
            street: shippingAddress.street.trim(),
            city: shippingAddress.city.trim(),
            phone: shippingAddress.phone.trim(),
            notes: shippingAddress.notes ? shippingAddress.notes.trim() : '',
          }
        : undefined,
      subtotal: formattedSubtotal,
      shippingCost,
      total,
      paymentStatus: 'PENDIENTE_PAGO',
    });

    await order.save();

    return res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/orders/me
 * Historial de pedidos del cliente autenticado.
 */
export async function getMyOrders(req, res, next) {
  try {
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.json({ orders });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/orders/:id
 * Detalle de un pedido (dueño o admin).
 */
export async function getOrderById(req, res, next) {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Regla: Solo el dueño o un admin pueden consultar el pedido
    if (order.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para ver este pedido' });
    }

    return res.json({ order });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/orders
 * Listado para admin (pedidos pagados con físicos o todos).
 */
export async function listAdminOrders(req, res, next) {
  try {
    const filter = {};
    if (req.query.hasPhysical === 'true') filter.hasPhysical = true;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    return res.json({ orders });
  } catch (err) {
    next(err);
  }
}

