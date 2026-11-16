'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart, type CartItem } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';

function CartItemRow({ item }: { item: CartItem }) {
  const { updateQty, removeItem } = useCart();
  const [imgError, setImgError] = useState(false);

  return (
    <div className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-papel-dark last:border-b-0">
      <div className="flex items-center gap-4 flex-1">
        {/* Miniatura portada */}
        <div className="w-16 h-22 bg-papel-dark rounded-lg overflow-hidden flex-shrink-0 border border-papel-dark flex items-center justify-center">
          {item.coverUrl && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.coverUrl}
              alt={item.title}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="text-xl">📚</span>
          )}
        </div>

        {/* Info */}
        <div className="space-y-1">
          <Link
            href={`/libros/${item.bookId}`}
            className="font-serif font-bold text-sm text-tinta hover:text-verde-700 transition-colors line-clamp-1"
          >
            {item.title}
          </Link>
          <p className="text-xs text-tinta-suave">{item.author}</p>
          <span className="badge badge-green text-[11px]">
            {item.format === 'ebook' ? '📱 Ebook' : '📖 Físico'}
          </span>
        </div>
      </div>

      {/* Controles de cantidad y precio */}
      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
        {/* Selector de cantidad */}
        <div className="flex items-center border border-papel-dark rounded-lg bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => updateQty(item.bookId, item.quantity - 1)}
            className="px-2.5 py-1 text-xs hover:bg-papel font-bold text-tinta"
            aria-label="Disminuir cantidad"
          >
            -
          </button>
          <span className="px-3 py-1 text-xs font-semibold">{item.quantity}</span>
          <button
            type="button"
            onClick={() => updateQty(item.bookId, item.quantity + 1)}
            className="px-2.5 py-1 text-xs hover:bg-papel font-bold text-tinta"
            aria-label="Aumentar cantidad"
          >
            +
          </button>
        </div>

        {/* Subtotal por ítem */}
        <div className="text-right min-w-20">
          <span className="font-serif font-bold text-sm text-tinta block">
            ${(item.price * item.quantity).toFixed(2)}
          </span>
          <span className="text-[11px] text-tinta-suave block">
            (${item.price.toFixed(2)} c/u)
          </span>
        </div>

        {/* Botón eliminar */}
        <button
          type="button"
          onClick={() => removeItem(item.bookId)}
          className="text-xs text-red-600 hover:text-red-800 p-1"
          title="Eliminar del carrito"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function CarritoPage() {
  const { items, totalItems, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  const hasPhysical = items.some((i) => i.format === 'fisico');

  const handleCheckout = () => {
    if (!user) {
      router.push('/login?redirect=/checkout');
    } else {
      router.push('/checkout');
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center card">
        <span className="text-5xl block mb-4">🛒</span>
        <h1 className="text-2xl md:text-3xl font-serif font-bold text-tinta mb-2">
          Tu carrito está vacío
        </h1>
        <p className="text-sm text-tinta-suave mb-8 max-w-md mx-auto">
          Parece que aún no has agregado ningún libro a tu carrito de compras. Explora nuestro catálogo y descubre grandes lecturas.
        </p>
        <Link href="/catalogo" className="btn-primary">
          Explorar catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-tinta">Carrito de compras</h1>
        <p className="text-sm text-tinta-suave mt-1">
          {totalItems} {totalItems === 1 ? 'producto' : 'productos'} en tu lista
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Columna izquierda: Lista de libros en el carrito */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between pb-4 border-b border-papel-dark">
            <h2 className="font-serif font-bold text-base text-tinta">Artículos seleccionados</h2>
            <button
              onClick={clearCart}
              className="text-xs text-red-600 hover:underline font-medium"
            >
              Vaciar carrito
            </button>
          </div>

          <div className="divide-y divide-papel-dark">
            {items.map((item) => (
              <CartItemRow key={item.bookId} item={item} />
            ))}
          </div>
        </div>

        {/* Columna derecha: Resumen del pedido */}
        <div className="card space-y-6">
          <h2 className="font-serif font-bold text-lg text-tinta pb-3 border-b border-papel-dark">
            Resumen del pedido
          </h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-tinta-suave">
              <span>Subtotal productos:</span>
              <span className="font-semibold text-tinta">${subtotal.toFixed(2)} USD</span>
            </div>

            <div className="flex justify-between text-tinta-suave">
              <span>Envío estimado:</span>
              <span className="font-semibold text-tinta">
                {hasPhysical ? '$4.99 USD' : 'Gratis (Ebooks)'}
              </span>
            </div>

            <div className="pt-3 border-t border-papel-dark flex justify-between items-baseline">
              <span className="font-bold text-base text-tinta">Total estimado:</span>
              <span className="text-2xl font-serif font-bold text-verde-700">
                ${(subtotal + (hasPhysical ? 4.99 : 0)).toFixed(2)}{' '}
                <span className="text-xs font-sans text-tinta-suave font-normal">USD</span>
              </span>
            </div>
          </div>

          {/* Información del envío */}
          <div className="p-3 bg-papel rounded-lg text-xs text-tinta-suave space-y-1">
            {hasPhysical ? (
              <p>
                📦 <strong>Incluye libros físicos:</strong> Ingresarás tu dirección de envío en la siguiente pantalla.
              </p>
            ) : (
              <p>
                ⚡ <strong>Solo libros digitales:</strong> No requiere dirección física. Descarga tus ebooks inmediatamente tras el pago.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            className="btn-primary w-full py-3 text-base justify-center font-semibold"
          >
            Proceder al Checkout
          </button>

          <div className="text-center">
            <Link href="/catalogo" className="text-xs text-verde-700 hover:underline">
              ← Continuar comprando
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
