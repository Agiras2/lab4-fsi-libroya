import Order from '../models/Order.js';
import Book from '../models/Book.js';
import User from '../models/User.js';
import { getIO } from '../socket/index.js';

const ORDERED_STATES = ['PENDIENTE', 'PREPARANDO', 'ENVIADO', 'ENTREGADO'];
const VALID_NEXT_STEP = {
  PENDIENTE: 'PREPARANDO',
  PREPARANDO: 'ENVIADO',
  ENVIADO: 'ENTREGADO',
};

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
 * Listado para admin (por defecto pedidos PAGADOS con libros físicos para el tablero Kanban).
 */
export async function listAdminOrders(req, res, next) {
  try {
    const filter = {
      paymentStatus: req.query.paymentStatus || 'PAGADO',
      hasPhysical: req.query.hasPhysical !== undefined ? req.query.hasPhysical === 'true' : true,
    };
    if (req.query.shipmentStatus) {
      filter.shipmentStatus = req.query.shipmentStatus;
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    return res.json({ orders });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/orders/:id/shipment-status
 * Solo admin: avanza el estado del envío un solo paso según la máquina de estados.
 */
export async function updateShipmentStatus(req, res, next) {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'El campo "status" es obligatorio' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Regla: Solo pedidos pagados
    if (order.paymentStatus !== 'PAGADO') {
      return res.status(400).json({
        error: 'No se puede gestionar el envío de un pedido que no ha sido pagado',
      });
    }

    // Regla: Solo pedidos con libros físicos
    if (!order.hasPhysical) {
      return res.status(400).json({
        error: 'Este pedido solo contiene ebooks y no requiere gestión de envío',
      });
    }

    const currentStatus = order.shipmentStatus || 'PENDIENTE';
    const currentIndex = ORDERED_STATES.indexOf(currentStatus);
    const targetIndex = ORDERED_STATES.indexOf(status);

    if (targetIndex < 0) {
      return res.status(400).json({
        error: `Estado de envío no reconocido: "${status}". Valores permitidos: ${ORDERED_STATES.join(', ')}`,
      });
    }

    if (currentStatus === status) {
      return res.status(400).json({
        error: `El pedido ya se encuentra en estado "${status}"`,
      });
    }

    if (targetIndex < currentIndex) {
      return res.status(400).json({
        error: `Transición inválida: no está permitido retroceder de estado en el envío (${currentStatus} → ${status})`,
      });
    }

    const nextAllowed = VALID_NEXT_STEP[currentStatus];
    if (status !== nextAllowed) {
      return res.status(400).json({
        error: `Transición inválida: no está permitido saltar estados. Solo puede avanzar de "${currentStatus}" a "${nextAllowed}"`,
      });
    }

    // Obtener nombre del administrador que realizó el cambio
    const adminUser = await User.findById(req.user.id);
    const changedByName = adminUser?.name || req.user.name || 'Administrador';

    // Actualizar estado y agregar entrada al historial
    order.shipmentStatus = status;
    order.shipmentHistory.push({
      status,
      changedBy: changedByName,
      changedAt: new Date(),
    });

    await order.save();

    // Punto 3: Emitir shipment:updated a sala 'admins' y sala 'user:<userId>' con datos mínimos
    const io = getIO();
    if (io) {
      const socketPayload = {
        orderId: order._id.toString(),
        shipmentStatus: order.shipmentStatus,
        updatedAt: new Date().toISOString(),
      };
      io.to('admins').emit('shipment:updated', socketPayload);
      io.to(`user:${order.userId.toString()}`).emit('shipment:updated', socketPayload);
    }

    return res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
}

