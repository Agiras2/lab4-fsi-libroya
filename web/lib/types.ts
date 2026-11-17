export interface OrderItem {
  bookId: string;
  title: string;
  format: 'fisico' | 'ebook';
  unitPrice: number;
  quantity: number;
}

export interface ShippingAddress {
  fullName: string;
  street: string;
  city: string;
  phone: string;
  notes?: string;
}

export interface Order {
  _id: string;
  userId: string;
  items: OrderItem[];
  hasPhysical: boolean;
  shippingAddress?: ShippingAddress;
  subtotal: number;
  shippingCost: number;
  total: number;
  paymentStatus: 'PENDIENTE_PAGO' | 'PAGADO' | 'FALLIDO' | 'CANCELADO';
  shipmentStatus?: 'PENDIENTE' | 'PREPARANDO' | 'ENVIADO' | 'ENTREGADO';
  shipmentHistory?: {
    status: string;
    changedBy: string;
    changedAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface EbookLibraryItem {
  _id: string;
  title: string;
  author: string;
  category: string;
  coverUrl?: string;
  description?: string;
  ebookFileUrl: string;
  purchasedAt?: string;
}

