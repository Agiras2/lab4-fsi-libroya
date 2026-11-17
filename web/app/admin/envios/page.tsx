'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { apiClient } from '@/lib/apiClient';
import { useSocket } from '@/contexts/SocketContext';
import type { Order } from '@/lib/types';

type ShipmentStatus = 'PENDIENTE' | 'PREPARANDO' | 'ENVIADO' | 'ENTREGADO';

const COLUMNS: { id: ShipmentStatus; label: string; badgeCls: string }[] = [
  { id: 'PENDIENTE', label: 'Pendiente', badgeCls: 'bg-orange-100 text-orange-800' },
  { id: 'PREPARANDO', label: 'Preparando', badgeCls: 'bg-blue-100 text-blue-800' },
  { id: 'ENVIADO', label: 'Enviado', badgeCls: 'bg-purple-100 text-purple-800' },
  { id: 'ENTREGADO', label: 'Entregado', badgeCls: 'bg-verde-100 text-verde-800' },
];

const VALID_NEXT_STEP: Record<string, ShipmentStatus | undefined> = {
  PENDIENTE: 'PREPARANDO',
  PREPARANDO: 'ENVIADO',
  ENVIADO: 'ENTREGADO',
  ENTREGADO: undefined,
};

function KanbanCardView({
  order,
  isDragging = false,
}: {
  order: Order;
  isDragging?: boolean;
}) {
  const shortId = order._id.slice(-8).toUpperCase();
  const timeStr = new Date(order.createdAt).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateStr = new Date(order.createdAt).toLocaleDateString('es-CO', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      className={`p-3.5 bg-white rounded-xl border border-papel-dark shadow-sm space-y-2 select-none cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? 'shadow-xl rotate-1 scale-105 border-verde-600 ring-2 ring-verde-500/20' : 'hover:border-verde-500/60 hover:shadow-md'
      }`}
    >
      {/* Cabecera de la tarjeta */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-tinta">#{shortId}</span>
        <span className="text-[11px] text-tinta-suave">
          {dateStr} · {timeStr}
        </span>
      </div>

      {/* Ítems */}
      <div className="text-xs text-tinta-suave space-y-0.5 line-clamp-2">
        {order.items
          .filter((i) => i.format === 'fisico')
          .map((i, idx) => (
            <div key={idx} className="truncate">
              • <strong className="text-tinta font-semibold">{i.quantity}x</strong> {i.title}
            </div>
          ))}
      </div>

      {/* Ciudad y Total */}
      <div className="pt-2 border-t border-papel-dark/50 flex items-center justify-between text-xs">
        <span className="text-tinta-suave truncate max-w-[120px]">
          📍 {order.shippingAddress?.city || 'Sin ciudad'}
        </span>
        <span className="font-bold text-verde-700">
          ${order.total.toFixed(2)} USD
        </span>
      </div>
    </div>
  );
}

function DraggableCard({ order }: { order: Order }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: order._id,
    data: { order },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={isDragging ? 'opacity-30' : ''}
    >
      <KanbanCardView order={order} />
    </div>
  );
}

function DroppableColumn({
  column,
  orders,
  activeOrder,
}: {
  column: (typeof COLUMNS)[number];
  orders: Order[];
  activeOrder: Order | null;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
  });

  // Validar si esta columna es el único paso siguiente permitido para el ítem que se arrastra
  const isTargetAllowed =
    activeOrder &&
    VALID_NEXT_STEP[activeOrder.shipmentStatus || 'PENDIENTE'] === column.id;
  const isCurrentColumn =
    activeOrder && (activeOrder.shipmentStatus || 'PENDIENTE') === column.id;
  const isDraggingAny = Boolean(activeOrder);

  let columnStyle = 'border-papel-dark bg-papel/40';
  if (isDraggingAny) {
    if (isTargetAllowed) {
      columnStyle = isOver
        ? 'border-verde-600 bg-verde-100/60 ring-2 ring-verde-500 shadow-md'
        : 'border-verde-500 bg-verde-50/40 border-dashed animate-pulse';
    } else if (!isCurrentColumn) {
      columnStyle = 'border-dashed border-gray-300 bg-gray-100/50 opacity-40';
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border p-4 flex flex-col min-h-[560px] max-h-[80vh] transition-all duration-200 ${columnStyle}`}
    >
      {/* Encabezado de la columna */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-papel-dark/60">
        <div className="flex items-center gap-2">
          <h2 className="font-serif font-bold text-sm text-tinta">{column.label}</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${column.badgeCls}`}>
            {orders.length}
          </span>
        </div>
        {isTargetAllowed && (
          <span className="text-[11px] font-bold text-verde-700 bg-verde-100 px-2 py-0.5 rounded-full">
            Soltar aquí ↓
          </span>
        )}
      </div>

      {/* Lista de tarjetas */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {orders.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-center text-xs text-tinta-suave/60 italic border border-dashed border-papel-dark rounded-xl">
            Sin pedidos
          </div>
        ) : (
          orders.map((o) => <DraggableCard key={o._id} order={o} />)
        )}
      </div>
    </div>
  );
}

export default function AdminEnviosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { socket } = useSocket();

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // GET /api/orders devuelve por defecto pedidos PAGADOS con libros físicos
      const res = await apiClient<{ orders: Order[] }>('/api/orders');
      setOrders(res.orders);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar los envíos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Eventos de reconexión y WebSockets en vivo
  useEffect(() => {
    // Sincronizar tras reconexión
    const handleReconnected = () => {
      fetchOrders();
    };
    window.addEventListener('socket:reconnected', handleReconnected);

    if (!socket) return () => window.removeEventListener('socket:reconnected', handleReconnected);

    // Escuchar order:paid (nuevo pedido físico pagado entra al tablero en PENDIENTE)
    const handleOrderPaid = async (data: { orderId: string }) => {
      try {
        const res = await apiClient<{ order: Order }>(`/api/orders/${data.orderId}`);
        if (res.order.hasPhysical) {
          setOrders((prev) => {
            const exists = prev.some((o) => o._id === res.order._id);
            if (exists) return prev;
            return [res.order, ...prev];
          });
          showToast(`Nuevo pedido pagado #${res.order._id.slice(-8).toUpperCase()} ingresó a Pendiente`);
        }
      } catch (err) {
        console.error('Error sincronizando nuevo pedido pagado:', err);
      }
    };

    // Escuchar shipment:updated (otro admin movió una tarjeta)
    const handleShipmentUpdated = (data: {
      orderId: string;
      shipmentStatus: ShipmentStatus;
    }) => {
      setOrders((prev) =>
        prev.map((o) =>
          o._id === data.orderId ? { ...o, shipmentStatus: data.shipmentStatus } : o
        )
      );
    };

    socket.on('order:paid', handleOrderPaid);
    socket.on('shipment:updated', handleShipmentUpdated);

    return () => {
      window.removeEventListener('socket:reconnected', handleReconnected);
      socket.off('order:paid', handleOrderPaid);
      socket.off('shipment:updated', handleShipmentUpdated);
    };
  }, [socket, fetchOrders, showToast]);

  // Configuración de sensores para dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const order = orders.find((o) => o._id === event.active.id);
    if (order) setActiveOrder(order);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOrder(null);

    if (!over) return;

    const orderId = active.id as string;
    const targetStatus = over.id as ShipmentStatus;
    const targetOrder = orders.find((o) => o._id === orderId);

    if (!targetOrder) return;

    const currentStatus = targetOrder.shipmentStatus || 'PENDIENTE';
    if (currentStatus === targetStatus) return;

    const nextAllowed = VALID_NEXT_STEP[currentStatus];
    if (targetStatus !== nextAllowed) {
      showToast(
        `Transición no permitida: solo puedes mover a "${nextAllowed}"`
      );
      return;
    }

    // Actualización optimista
    const prevOrders = [...orders];
    setOrders((prev) =>
      prev.map((o) =>
        o._id === orderId ? { ...o, shipmentStatus: targetStatus } : o
      )
    );

    try {
      await apiClient<{ success: boolean; order: Order }>(
        `/api/orders/${orderId}/shipment-status`,
        {
          method: 'PATCH',
          body: { status: targetStatus },
        }
      );
      showToast(`Pedido #${orderId.slice(-8).toUpperCase()} avanzado a ${targetStatus}`);
    } catch (err: unknown) {
      // Revertir ante rechazo del backend
      setOrders(prevOrders);
      const msg = err instanceof Error ? err.message : 'Error al actualizar estado';
      showToast(`Error: ${msg}`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast flotante */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-tinta text-white text-xs px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 border border-papel-dark/40 animate-fade-in">
          <span>🔔</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-tinta">
            Tablero de Envíos (Kanban)
          </h1>
          <p className="text-sm text-tinta-suave mt-1">
            Despacha y actualiza el seguimiento en tiempo real arrastrando las tarjetas.
          </p>
        </div>

        <button
          onClick={fetchOrders}
          className="btn-ghost text-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>🔄</span>
          <span>Actualizar tablero</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-96 bg-papel-dark rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
            {COLUMNS.map((col) => {
              const colOrders = orders.filter(
                (o) => (o.shipmentStatus || 'PENDIENTE') === col.id
              );
              return (
                <DroppableColumn
                  key={col.id}
                  column={col}
                  orders={colOrders}
                  activeOrder={activeOrder}
                />
              );
            })}
          </div>

          <DragOverlay>
            {activeOrder ? <KanbanCardView order={activeOrder} isDragging /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
