import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    title: { type: String, required: true },
    format: {
      type: String,
      enum: ['fisico', 'ebook'],
      required: true,
    },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    notes: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const shipmentHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['PENDIENTE', 'PREPARANDO', 'ENVIADO', 'ENTREGADO'],
      required: true,
    },
    changedBy: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [(val) => val.length > 0, 'El pedido debe contener al menos un ítem'],
    },
    hasPhysical: { type: Boolean, required: true },
    shippingAddress: {
      type: shippingAddressSchema,
      required: function () {
        return this.hasPhysical;
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    shippingCost: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    paymentStatus: {
      type: String,
      enum: ['PENDIENTE_PAGO', 'PAGADO', 'FALLIDO', 'CANCELADO'],
      default: 'PENDIENTE_PAGO',
      index: true,
    },
    shipmentStatus: {
      type: String,
      enum: ['PENDIENTE', 'PREPARANDO', 'ENVIADO', 'ENTREGADO'],
    },
    shipmentHistory: {
      type: [shipmentHistorySchema],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model('Order', orderSchema);

