import Order from '../models/Order.js';
import Book from '../models/Book.js';
import Payment from '../models/Payment.js';
import * as paypalService from '../services/paypal.service.js';
import { getIO } from '../socket/index.js';

function emit(event, data) {
  try {
    getIO()?.emit(event, data);
  } catch {
    /* no-op */
  }
}

function emitToRoom(room, event, data) {
  try {
    getIO()?.to(room).emit(event, data);
  } catch {
    /* no-op */
  }
}

/**
 * POST /api/payments/paypal/order
 * Crea una orden de pago en PayPal para un pedido propio pendiente.
 */
export async function createPayPalOrder(req, res, next) {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'El ID del pedido (orderId) es obligatorio' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Regla 7: Propiedad del pedido
    if (order.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para pagar un pedido ajeno' });
    }

    if (order.paymentStatus === 'PAGADO') {
      return res.status(400).json({ error: 'Este pedido ya ha sido pagado' });
    }

    const paypalOrder = await paypalService.createPayPalOrder({
      orderId: order._id,
      amount: order.total,
    });

    // Registramos el pago en estado inicial
    await Payment.findOneAndUpdate(
      { providerOrderId: paypalOrder.id },
      {
        orderId: order._id,
        provider: 'paypal',
        providerOrderId: paypalOrder.id,
        amount: order.total,
        currency: 'USD',
        status: 'CREATED',
      },
      { upsert: true, new: true }
    );

    return res.json({
      providerOrderId: paypalOrder.id,
      orderId: order._id,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/paypal/capture
 * Captura el pago, descuenta stock atómicamente y confirma el pedido.
 */
export async function capturePayPalOrder(req, res, next) {
  try {
    const { orderId, providerOrderId } = req.body;

    if (!orderId || !providerOrderId) {
      return res.status(400).json({ error: 'orderId y providerOrderId son obligatorios' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Regla 7: Propiedad del pedido
    if (order.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para pagar un pedido ajeno' });
    }

    // Regla 6: Idempotencia del pago
    if (order.paymentStatus === 'PAGADO') {
      const existingPayment = await Payment.findOne({ providerOrderId });
      return res.json({
        success: true,
        message: 'El pago de este pedido ya fue procesado y confirmado con anterioridad',
        order,
        payment: existingPayment,
      });
    }

    // [DEFECTO 1 RESUELTO] Verificación PREVIA antes de descontar stock y antes de capturar con PayPal
    const paymentRecord = await Payment.findOne({ providerOrderId });
    if (!paymentRecord) {
      return res.status(400).json({
        error: 'No existe una orden de pago registrada para este providerOrderId',
      });
    }

    if (paymentRecord.orderId.toString() !== order._id.toString()) {
      return res.status(400).json({
        error: 'La orden de PayPal no corresponde al pedido especificado',
      });
    }

    if (paymentRecord.status !== 'CREATED') {
      return res.status(400).json({
        error: `La orden de pago se encuentra en estado inválido (${paymentRecord.status}) para captura`,
      });
    }

    // Regla 3: Descuento atómico de stock condicional ANTES de capturar
    // Solo aplica a libros con formato 'fisico'
    const physicalItems = order.items.filter((i) => i.format === 'fisico');
    const successfullyDeducted = [];

    for (const item of physicalItems) {
      const updatedBook = await Book.findOneAndUpdate(
        { _id: item.bookId, format: 'fisico', stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );

      if (!updatedBook) {
        // Rollback inmediato de lo que ya se hubiera descontado en este pedido
        for (const rolled of successfullyDeducted) {
          await Book.updateOne({ _id: rolled.bookId }, { $inc: { stock: rolled.quantity } });
        }
        return res.status(400).json({
          error: `Stock insuficiente para "${item.title}". No se realizó el cobro en PayPal.`,
        });
      }

      successfullyDeducted.push({
        bookId: item.bookId,
        quantity: item.quantity,
        title: item.title,
        newStock: updatedBook.stock,
      });
    }

    // Capturar en PayPal Sandbox
    let captureResult;
    try {
      captureResult = await paypalService.capturePayPalOrder(providerOrderId);
    } catch (err) {
      // Si la llamada a PayPal falla, se restituye inmediatamente el stock
      for (const rolled of successfullyDeducted) {
        await Book.updateOne({ _id: rolled.bookId }, { $inc: { stock: rolled.quantity } });
      }
      await Payment.findOneAndUpdate({ providerOrderId }, { status: 'FAILED' });
      return res.status(400).json({
        error: `Error al capturar el pago en PayPal: ${err.message}`,
      });
    }

    // Regla 4 y 5: Validación estricta de la captura
    const purchaseUnit = captureResult.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0];
    const captureStatus = capture?.status || captureResult.status;

    if (captureStatus !== 'COMPLETED') {
      for (const rolled of successfullyDeducted) {
        await Book.updateOne({ _id: rolled.bookId }, { $inc: { stock: rolled.quantity } });
      }
      await Payment.findOneAndUpdate({ providerOrderId }, { status: 'FAILED' });
      return res.status(400).json({ error: 'La captura del pago no fue completada en PayPal' });
    }

    // Verificar referencia / custom_id
    const refId = purchaseUnit?.reference_id || purchaseUnit?.custom_id;
    if (refId && refId !== order._id.toString()) {
      for (const rolled of successfullyDeducted) {
        await Book.updateOne({ _id: rolled.bookId }, { $inc: { stock: rolled.quantity } });
      }
      return res.status(400).json({ error: 'La orden de PayPal no corresponde al pedido especificado' });
    }

    // [DEFECTO 3 RESUELTO] Verificar importe exacto al centavo (en centavos enteros) y divisa
    const capturedVal = parseFloat(capture?.amount?.value || purchaseUnit?.amount?.value || 0);
    const capturedCurrency = capture?.amount?.currency_code || purchaseUnit?.amount?.currency_code;
    const capturedCents = Math.round(capturedVal * 100);
    const orderCents = Math.round(order.total * 100);

    if (capturedCurrency !== 'USD' || capturedCents !== orderCents) {
      for (const rolled of successfullyDeducted) {
        await Book.updateOne({ _id: rolled.bookId }, { $inc: { stock: rolled.quantity } });
      }
      return res.status(400).json({
        error: 'El importe o divisa capturado no coincide exactamente al centavo con el total del pedido',
      });
    }

    // [DEFECTO 2 RESUELTO] Confirmar pedido: asignar shipmentStatus y una única entrada en el historial
    order.paymentStatus = 'PAGADO';
    if (order.hasPhysical) {
      order.shipmentStatus = 'PENDIENTE';
      order.shipmentHistory = [
        {
          status: 'PENDIENTE',
          changedBy: 'PayPal Sandbox (Pago verificado)',
          changedAt: new Date(),
        },
      ];
    }
    await order.save();

    // Actualizar registro de pago
    const captureId = capture?.id || captureResult.id;
    const payment = await Payment.findOneAndUpdate(
      { providerOrderId },
      {
        orderId: order._id,
        provider: 'paypal',
        providerOrderId,
        captureId,
        amount: order.total,
        currency: 'USD',
        status: 'CAPTURED',
      },
      { upsert: true, new: true }
    );

    // Notificaciones WebSocket en tiempo real
    for (const d of successfullyDeducted) {
      emit('book:stockChanged', {
        bookId: d.bookId.toString(),
        stock: d.newStock,
        title: d.title,
      });
    }

    if (order.hasPhysical) {
      emitToRoom('admins', 'order:paid', {
        orderId: order._id,
        total: order.total,
        itemsCount: order.items.length,
      });
    }

    return res.json({
      success: true,
      order,
      payment,
    });
  } catch (err) {
    next(err);
  }
}

