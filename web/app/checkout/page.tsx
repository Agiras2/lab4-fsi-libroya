'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/apiClient';
import type { Order, ShippingAddress } from '@/lib/types';

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  const hasPhysical = items.some((i) => i.format === 'fisico');
  const shippingCost = hasPhysical ? 4.99 : 0;
  const estimatedTotal = subtotal + shippingCost;

  const [address, setAddress] = useState<ShippingAddress>({
    fullName: user?.name || '',
    street: '',
    city: '',
    phone: '',
    notes: '',
  });

  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  // Mantenemos referencia del orderId creado en el backend
  const createdOrderIdRef = useRef<string | null>(null);

  const validateAddress = () => {
    if (!hasPhysical) return true;
    if (!address.fullName.trim()) {
      setError('El nombre completo del destinatario es obligatorio.');
      return false;
    }
    if (!address.street.trim()) {
      setError('La dirección de entrega (calle / carrera) es obligatoria.');
      return false;
    }
    if (!address.city.trim()) {
      setError('La ciudad de destino es obligatoria.');
      return false;
    }
    if (!address.phone.trim()) {
      setError('El teléfono de contacto es obligatorio.');
      return false;
    }
    return true;
  };

  const paypalClientId =
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'sb';

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center card">
        <span className="text-4xl block mb-4">🛒</span>
        <h1 className="text-2xl font-serif font-bold text-tinta mb-2">No tienes productos por pagar</h1>
        <p className="text-sm text-tinta-suave mb-6">Tu carrito está vacío.</p>
        <Link href="/catalogo" className="btn-primary">
          Ir al catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-tinta">Finalizar compra (Checkout)</h1>
        <p className="text-sm text-tinta-suave mt-1">
          Confirma tu información y realiza el pago seguro con PayPal Sandbox en dólares (USD).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Columna izquierda: Dirección de envío o aviso de Ebooks */}
        <div className="lg:col-span-2 space-y-6">
          {hasPhysical ? (
            <div className="card space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-papel-dark">
                <h2 className="font-serif font-bold text-lg text-tinta">
                  Dirección de envío (Libros físicos)
                </h2>
                <span className="badge badge-green text-xs">Requerida</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-tinta mb-1">
                    Nombre completo del destinatario *
                  </label>
                  <input
                    type="text"
                    required
                    value={address.fullName}
                    onChange={(e) => setAddress({ ...address, fullName: e.target.value })}
                    className="input-field"
                    placeholder="Ej. Ana María Gómez"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-tinta mb-1">
                    Dirección (Calle, Carrera, Edificio, Apto) *
                  </label>
                  <input
                    type="text"
                    required
                    value={address.street}
                    onChange={(e) => setAddress({ ...address, street: e.target.value })}
                    className="input-field"
                    placeholder="Ej. Cra 43A # 1-50 Apto 402"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-tinta mb-1">
                    Ciudad de entrega *
                  </label>
                  <input
                    type="text"
                    required
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    className="input-field"
                    placeholder="Ej. Medellín"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-tinta mb-1">
                    Teléfono de contacto *
                  </label>
                  <input
                    type="tel"
                    required
                    value={address.phone}
                    onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                    className="input-field"
                    placeholder="Ej. 3001234567"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-tinta mb-1">
                    Instrucciones o notas adicionales (Opcional)
                  </label>
                  <input
                    type="text"
                    value={address.notes}
                    onChange={(e) => setAddress({ ...address, notes: e.target.value })}
                    className="input-field"
                    placeholder="Ej. Dejar en portería"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="card bg-blue-50/60 border-blue-200 p-6 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-3xl">⚡</span>
                <div>
                  <h3 className="font-serif font-bold text-base text-blue-900">
                    Solo productos digitales (Ebooks)
                  </h3>
                  <p className="text-xs text-blue-800 mt-1">
                    Tu pedido no incluye libros físicos, por lo que <strong>no requiere dirección física de envío</strong>. Inmediatamente tras confirmarse el pago, tus ebooks estarán disponibles para descarga en formato EPUB en tu biblioteca personal.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Lista de productos a pagar */}
          <div className="card space-y-3">
            <h3 className="font-serif font-bold text-sm text-tinta pb-2 border-b border-papel-dark">
              Artículos en este pedido ({items.length})
            </h3>
            <div className="divide-y divide-papel-dark text-sm">
              {items.map((item) => (
                <div key={item.bookId} className="py-2.5 flex justify-between items-center">
                  <div>
                    <span className="font-medium text-tinta block">{item.title}</span>
                    <span className="text-xs text-tinta-suave">
                      {item.format === 'ebook' ? '📱 Ebook' : '📖 Físico'} · Cantidad: {item.quantity}
                    </span>
                  </div>
                  <span className="font-semibold text-tinta">
                    ${(item.price * item.quantity).toFixed(2)} USD
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Columna derecha: Resumen y Botón de Pago PayPal */}
        <div className="card space-y-6">
          <h2 className="font-serif font-bold text-lg text-tinta pb-3 border-b border-papel-dark">
            Resumen de pago
          </h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-tinta-suave">
              <span>Subtotal:</span>
              <span className="font-semibold text-tinta">${subtotal.toFixed(2)} USD</span>
            </div>

            <div className="flex justify-between text-tinta-suave">
              <span>Costo de envío:</span>
              <span className="font-semibold text-tinta">
                {hasPhysical ? '$4.99 USD' : '$0.00 USD (Gratis)'}
              </span>
            </div>

            <div className="pt-3 border-t border-papel-dark flex justify-between items-baseline">
              <span className="font-bold text-base text-tinta">Total a pagar:</span>
              <span className="text-2xl font-serif font-bold text-verde-700">
                ${estimatedTotal.toFixed(2)}{' '}
                <span className="text-xs font-sans text-tinta-suave font-normal">USD</span>
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          {processing && (
            <div className="p-3 bg-verde-50 border border-verde-200 rounded-lg text-xs text-verde-800 text-center animate-pulse">
              Procesando y verificando tu pedido con PayPal Sandbox...
            </div>
          )}

          {/* Botones de PayPal Sandbox */}
          <div className="pt-2">
            <PayPalScriptProvider
              options={{
                clientId: paypalClientId,
                currency: 'USD',
                intent: 'capture',
              }}
            >
              <PayPalButtons
                style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' }}
                disabled={processing}
                createOrder={async () => {
                  setError('');
                  if (!validateAddress()) {
                    throw new Error('Completa los campos obligatorios de la dirección de envío');
                  }

                  setProcessing(true);

                  try {
                    // 1. Crear el pedido en nuestro backend
                    const orderPayload = {
                      items: items.map((i) => ({
                        bookId: i.bookId,
                        quantity: i.quantity,
                      })),
                      shippingAddress: hasPhysical ? address : undefined,
                    };

                    const orderRes = await apiClient<{ order: Order }>('/api/orders', {
                      method: 'POST',
                      body: orderPayload,
                    });

                    createdOrderIdRef.current = orderRes.order._id;

                    // 2. Crear la orden de pago en PayPal a través del backend
                    const payRes = await apiClient<{
                      providerOrderId: string;
                      orderId: string;
                    }>('/api/payments/paypal/order', {
                      method: 'POST',
                      body: { orderId: orderRes.order._id },
                    });

                    return payRes.providerOrderId;
                  } catch (err: unknown) {
                    setProcessing(false);
                    const msg =
                      err instanceof Error ? err.message : 'Error al iniciar el pago con PayPal';
                    setError(msg);
                    throw err;
                  }
                }}
                onApprove={async (data) => {
                  setProcessing(true);
                  setError('');

                  try {
                    const orderId = createdOrderIdRef.current;
                    if (!orderId) {
                      throw new Error('ID de pedido no disponible para captura');
                    }

                    // 3. Capturar el pago en el backend
                    await apiClient<{ success: boolean; order: Order }>(
                      '/api/payments/paypal/capture',
                      {
                        method: 'POST',
                        body: {
                          orderId,
                          providerOrderId: data.orderID,
                        },
                      }
                    );

                    // 4. Limpiar carrito y redirigir
                    clearCart();
                    router.push('/mis-pedidos?pago=exitoso');
                  } catch (err: unknown) {
                    const msg =
                      err instanceof Error
                        ? err.message
                        : 'Error al verificar la captura del pago';
                    setError(msg);
                    setProcessing(false);
                  }
                }}
                onError={(err) => {
                  setProcessing(false);
                  setError(
                    'Hubo un problema de conexión con PayPal. Verifica tus credenciales de Sandbox.'
                  );
                  console.error('PayPal Buttons Error:', err);
                }}
                onCancel={() => {
                  setProcessing(false);
                  setError('El pago fue cancelado en la ventana de PayPal.');
                }}
              />
            </PayPalScriptProvider>
          </div>

          <div className="text-center text-xs text-tinta-suave">
            <p>🔒 Pago simulado seguro vía PayPal Sandbox API v2.</p>
            <p className="mt-1">
              ¿Dudas?{' '}
              <Link href="/carrito" className="text-verde-700 hover:underline">
                Regresar al carrito
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

