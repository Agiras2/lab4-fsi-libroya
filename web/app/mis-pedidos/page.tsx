'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { useSocket } from '@/contexts/SocketContext';
import type { Order } from '@/lib/types';

function ShipmentBadge({ status }: { status?: string }) {
  if (!status) return null;
  const config: Record<string, { label: string; cls: string }> = {
    PENDIENTE: { label: 'Envío Pendiente', cls: 'bg-orange-50 text-orange-700' },
    PREPARANDO: { label: 'Preparando Paquete', cls: 'bg-blue-50 text-blue-700' },
    ENVIADO: { label: 'Enviado en Camino', cls: 'bg-purple-50 text-purple-700' },
    ENTREGADO: { label: 'Entregado con Éxito', cls: 'bg-verde-50 text-verde-700' },
  };
  const c = config[status] || { label: status, cls: 'bg-gray-100 text-gray-700' };
  return <span className={`badge text-xs px-2.5 py-0.5 ${c.cls}`}>📦 {c.label}</span>;
}

function PaymentBadge({ status }: { status: string }) {
  if (status === 'PAGADO') {
    return <span className="badge badge-green text-xs">✓ Pagado</span>;
  }
  if (status === 'PENDIENTE_PAGO') {
    return <span className="badge badge-orange text-xs">⏳ Pendiente de Pago</span>;
  }
  if (status === 'FALLIDO') {
    return <span className="badge badge-red text-xs">✕ Pago Fallido</span>;
  }
  return <span className="badge badge-gray text-xs">{status}</span>;
}

function MisPedidosContent() {
  const searchParams = useSearchParams();
  const showSuccessBanner = searchParams.get('pago') === 'exitoso';

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { socket } = useSocket();

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient<{ orders: Order[] }>('/api/orders/me');
      setOrders(data.orders);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar tus pedidos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Escuchar WebSockets de actualización en vivo y reconexión
  useEffect(() => {
    const handleReconnected = () => {
      fetchOrders();
    };
    window.addEventListener('socket:reconnected', handleReconnected);

    if (!socket) return () => window.removeEventListener('socket:reconnected', handleReconnected);

    // Escuchar shipment:updated (el admin avanzó el estado del envío)
    const handleShipmentUpdated = (data: {
      orderId: string;
      shipmentStatus: string;
    }) => {
      setOrders((prev) =>
        prev.map((o) =>
          o._id === data.orderId ? { ...o, shipmentStatus: data.shipmentStatus as any } : o
        )
      );
      showToast(
        `Tu pedido #${data.orderId.slice(-8).toUpperCase()} ahora está: ${data.shipmentStatus}`
      );
    };

    socket.on('shipment:updated', handleShipmentUpdated);

    return () => {
      window.removeEventListener('socket:reconnected', handleReconnected);
      socket.off('shipment:updated', handleShipmentUpdated);
    };
  }, [socket, fetchOrders, showToast]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Toast de notificación en vivo */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-verde-700 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in border border-verde-600">
          <span>📦</span>
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Banner de éxito al retornar de PayPal */}
      {showSuccessBanner && (
        <div className="p-4 bg-verde-50 border border-verde-200 rounded-xl flex items-center justify-between text-verde-900">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="font-bold text-sm">¡Pago completado con éxito!</p>
              <p className="text-xs text-verde-800">
                Tu pedido fue verificado y registrado en el sistema. Los ebooks comprados ya están disponibles en tu biblioteca.
              </p>
            </div>
          </div>
          <Link href="/mi-biblioteca" className="btn-primary text-xs py-2 px-4 whitespace-nowrap">
            Ir a Mi Biblioteca →
          </Link>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-serif font-bold text-tinta">Mis pedidos</h1>
        <p className="text-sm text-tinta-suave mt-1">
          Historial de compras, estado del pago y seguimiento del despacho en vivo.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 bg-papel-dark rounded-xl animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="card text-center py-16 max-w-xl mx-auto space-y-4">
          <span className="text-5xl block">📦</span>
          <h2 className="text-2xl font-serif font-bold text-tinta">Aún no has realizado pedidos</h2>
          <p className="text-sm text-tinta-suave">
            Cuando compres libros físicos o digitales, podrás ver el detalle y el estado de entrega en esta pantalla.
          </p>
          <Link href="/catalogo" className="btn-primary">
            Explorar catálogo
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const hasEbooks = order.items.some((i) => i.format === 'ebook');
            return (
              <div key={order._id} className="card space-y-4 border border-papel-dark">
                {/* Encabezado del pedido */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-papel-dark">
                  <div>
                    <span className="text-xs text-tinta-suave block">
                      Pedido #{order._id.slice(-8).toUpperCase()}
                    </span>
                    <span className="text-xs text-tinta-suave/80">
                      Fecha: {new Date(order.createdAt).toLocaleDateString('es-CO', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <PaymentBadge status={order.paymentStatus} />
                    {order.hasPhysical && <ShipmentBadge status={order.shipmentStatus} />}
                  </div>
                </div>

                {/* Lista de productos */}
                <div className="divide-y divide-papel-dark/60 text-sm">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="py-2 flex justify-between items-center">
                      <div className="space-y-0.5">
                        <Link
                          href={`/libros/${item.bookId}`}
                          className="font-serif font-bold text-tinta hover:text-verde-700"
                        >
                          {item.title}
                        </Link>
                        <div className="text-xs text-tinta-suave">
                          {item.format === 'ebook' ? '📱 Formato Ebook' : '📖 Libro Físico'} · Cantidad: {item.quantity} · ${item.unitPrice.toFixed(2)} USD c/u
                        </div>
                      </div>
                      <span className="font-semibold text-tinta">
                        ${(item.unitPrice * item.quantity).toFixed(2)} USD
                      </span>
                    </div>
                  ))}
                </div>

                {/* Dirección de envío si aplica */}
                {order.hasPhysical && order.shippingAddress && (
                  <div className="p-3 bg-papel rounded-lg text-xs text-tinta-suave space-y-1">
                    <p className="font-semibold text-tinta">Dirección de entrega:</p>
                    <p>
                      {order.shippingAddress.fullName} · {order.shippingAddress.street}, {order.shippingAddress.city} · Tel: {order.shippingAddress.phone}
                    </p>
                    {order.shippingAddress.notes && (
                      <p className="italic">Nota: {order.shippingAddress.notes}</p>
                    )}
                  </div>
                )}

                {/* Pie del pedido: Totales y Accesos */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-papel-dark">
                  <div className="text-xs text-tinta-suave space-y-0.5">
                    <p>Subtotal: ${order.subtotal.toFixed(2)} USD · Envío: ${order.shippingCost.toFixed(2)} USD</p>
                    <p className="text-base font-serif font-bold text-verde-700">
                      Total: ${order.total.toFixed(2)} USD
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {hasEbooks && order.paymentStatus === 'PAGADO' && (
                      <Link href="/mi-biblioteca" className="btn-secondary text-xs py-2 px-3">
                        ⚡ Descargar ebooks en Mi Biblioteca
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MisPedidosPage() {
  return (
    <Suspense fallback={<div className="h-48 bg-papel-dark rounded-xl animate-pulse" />}>
      <MisPedidosContent />
    </Suspense>
  );
}
