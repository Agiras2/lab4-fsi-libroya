'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import { useCart } from '@/contexts/CartContext';
import { useSocket } from '@/contexts/SocketContext';
import StockBadge from '@/components/StockBadge';
import type { Book } from '@/components/BookCard';

function DetailCover({
  coverUrl,
  title,
  author,
}: {
  coverUrl?: string;
  title: string;
  author: string;
}) {
  const [error, setError] = useState(false);

  if (!coverUrl || error) {
    const palettes = [
      'bg-verde-100 text-verde-700',
      'bg-terracota-100 text-terracota-700',
      'bg-blue-100 text-blue-700',
      'bg-amber-100 text-amber-700',
    ];
    const idx = (title.charCodeAt(0) || 0) % palettes.length;
    return (
      <div
        className={`w-full aspect-[2/3] max-w-sm mx-auto rounded-2xl flex flex-col items-center justify-center p-6 text-center shadow-md ${palettes[idx]}`}
      >
        <span className="text-5xl mb-4">📚</span>
        <h2 className="font-serif text-lg font-bold leading-tight">{title}</h2>
        <p className="text-sm opacity-80 mt-2">{author}</p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={coverUrl}
      alt={`Portada de ${title}`}
      className="w-full aspect-[2/3] max-w-sm mx-auto rounded-2xl object-cover shadow-lg border border-papel-dark"
      onError={() => setError(true)}
    />
  );
}

export default function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  // Manejo de params tanto para Next.js 14 / 15
  const resolvedParams = 'then' in params ? use(params) : params;
  const bookId = resolvedParams.id;

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const { addItem } = useCart();
  const { socket } = useSocket();

  useEffect(() => {
    setLoading(true);
    apiClient<{ book: Book }>(`/api/books/${bookId}`)
      .then((data) => setBook(data.book))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar el libro'))
      .finally(() => setLoading(false));
  }, [bookId]);

  // Actualización de stock en tiempo real
  useEffect(() => {
    if (!socket) return;
    const handleStockChanged = (data: { bookId: string; stock: number }) => {
      if (data.bookId === bookId) {
        setBook((prev) => (prev ? { ...prev, stock: data.stock } : prev));
      }
    };
    socket.on('book:stockChanged', handleStockChanged);
    return () => {
      socket.off('book:stockChanged', handleStockChanged);
    };
  }, [socket, bookId]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-pulse">
          <div className="aspect-[2/3] max-w-sm mx-auto bg-papel-dark rounded-2xl w-full" />
          <div className="space-y-4">
            <div className="h-8 bg-papel-dark rounded w-3/4" />
            <div className="h-5 bg-papel-dark rounded w-1/2" />
            <div className="h-24 bg-papel-dark rounded w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="text-center py-16 card max-w-xl mx-auto">
        <span className="text-4xl block mb-4">⚠️</span>
        <h2 className="text-2xl font-serif font-bold text-tinta mb-2">Libro no encontrado</h2>
        <p className="text-sm text-tinta-suave mb-6">{error || 'El libro solicitado no existe.'}</p>
        <Link href="/catalogo" className="btn-primary">
          Regresar al catálogo
        </Link>
      </div>
    );
  }

  const isAvailable = book.format === 'ebook' || book.stock > 0;
  const maxAvailable = book.format === 'ebook' ? 10 : Math.max(1, book.stock);

  const handleAddToCart = () => {
    if (!isAvailable) return;
    addItem({
      bookId: book._id,
      title: book.title,
      author: book.author,
      format: book.format,
      price: book.price,
      coverUrl: book.coverUrl,
      quantity,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto py-6">
      {/* Migas de pan */}
      <nav className="text-xs text-tinta-suave mb-8 flex items-center gap-2">
        <Link href="/" className="hover:text-verde-600">
          Inicio
        </Link>
        <span>/</span>
        <Link href="/catalogo" className="hover:text-verde-600">
          Catálogo
        </Link>
        <span>/</span>
        <span className="text-tinta font-medium truncate max-w-xs">{book.title}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
        {/* Columna izquierda: Portada */}
        <div>
          <DetailCover coverUrl={book.coverUrl} title={book.title} author={book.author} />
        </div>

        {/* Columna derecha: Detalles y Compra */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="badge badge-green text-xs">
                {book.format === 'ebook' ? '📱 Formato Ebook' : '📖 Libro Físico'}
              </span>
              <span className="badge badge-gray text-xs">{book.category}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-tinta leading-tight">
              {book.title}
            </h1>
            <p className="text-lg text-tinta-suave mt-1">Por {book.author}</p>
          </div>

          <div className="p-4 bg-white rounded-xl border border-papel-dark flex items-center justify-between">
            <div>
              <span className="text-xs text-tinta-suave block">Precio unitario</span>
              <span className="text-3xl font-serif font-bold text-verde-700">
                ${book.price.toFixed(2)}{' '}
                <span className="text-xs font-sans text-tinta-suave font-normal">USD</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-tinta-suave block mb-1">Estado de inventario</span>
              <StockBadge book={book} size="md" />
            </div>
          </div>

          {/* Selector de cantidad y botón Agregar */}
          {isAvailable ? (
            <div className="space-y-4 pt-2">
              {book.format === 'fisico' && (
                <div className="flex items-center gap-4">
                  <label htmlFor="qty" className="text-sm font-medium text-tinta">
                    Cantidad:
                  </label>
                  <div className="flex items-center border border-papel-dark rounded-lg bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="px-3 py-1.5 text-sm hover:bg-papel text-tinta font-bold"
                    >
                      -
                    </button>
                    <span className="px-4 py-1.5 text-sm font-semibold">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(maxAvailable, q + 1))}
                      className="px-3 py-1.5 text-sm hover:bg-papel text-tinta font-bold"
                      disabled={quantity >= maxAvailable}
                    >
                      +
                    </button>
                  </div>
                  {book.stock <= book.lowStockThreshold && (
                    <span className="text-xs text-orange-600 font-medium">
                      (Máx. disponible: {book.stock})
                    </span>
                  )}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={added}
                  className={`flex-1 py-3 px-6 rounded-xl font-medium text-base transition-all duration-150 ${
                    added ? 'bg-verde-100 text-verde-700' : 'btn-primary'
                  }`}
                >
                  {added ? '✓ Agregado al carrito' : 'Agregar al carrito'}
                </button>
                <Link href="/carrito" className="btn-secondary py-3 px-6 rounded-xl text-base">
                  Ver carrito
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <p className="font-semibold">Producto actualmente agotado</p>
              <p className="text-xs mt-1">
                Este libro físico no tiene unidades disponibles en este momento. Vuelve a consultar pronto.
              </p>
            </div>
          )}

          {/* Información y sinopsis */}
          <div className="pt-6 border-t border-papel-dark space-y-4">
            <h3 className="font-serif font-bold text-lg text-tinta">Sinopsis</h3>
            <p className="text-sm text-tinta-suave leading-relaxed whitespace-pre-line">
              {book.description || 'Sin descripción disponible para esta edición.'}
            </p>

            <div className="grid grid-cols-2 gap-4 text-xs pt-4 border-t border-papel-dark/50 text-tinta-suave">
              {book.isbn && (
                <div>
                  <span className="font-semibold text-tinta block">ISBN:</span>
                  <span>{book.isbn}</span>
                </div>
              )}
              <div>
                <span className="font-semibold text-tinta block">Categoría:</span>
                <span>{book.category}</span>
              </div>
              <div>
                <span className="font-semibold text-tinta block">Tipo de entrega:</span>
                <span>
                  {book.format === 'ebook'
                    ? 'Descarga digital inmediata (EPUB)'
                    : 'Envío físico a domicilio'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

