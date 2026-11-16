'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { useSocket } from '@/contexts/SocketContext';
import BookCard, { type Book } from '@/components/BookCard';

const CATEGORIES = ['Novela', 'Ciencia', 'Historia', 'Infantil', 'Tecnología', 'Poesía', 'Otro'];

function CatalogoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { socket } = useSocket();

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const category = searchParams.get('category') ?? '';
  const format = searchParams.get('format') ?? '';
  const q = searchParams.get('q') ?? '';

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (format) params.set('format', format);
      if (q) params.set('q', q);
      const data = await apiClient<{ books: Book[] }>(`/api/books?${params}`);
      setBooks(data.books);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar el catálogo');
    } finally {
      setLoading(false);
    }
  }, [category, format, q]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  // Actualización en tiempo real del stock via WebSocket
  useEffect(() => {
    if (!socket) return;
    const handler = (data: { bookId: string; stock: number }) => {
      setBooks(prev =>
        prev.map(b => b._id === data.bookId ? { ...b, stock: data.stock } : b)
      );
    };
    socket.on('book:stockChanged', handler);
    return () => { socket.off('book:stockChanged', handler); };
  }, [socket]);

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    router.push(`/catalogo?${params}`);
  }

  return (
    <div>
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-bold text-tinta">Catálogo</h1>
        <p className="text-tinta-suave mt-1">
          {loading ? 'Cargando…' : `${books.length} libro${books.length !== 1 ? 's' : ''} encontrado${books.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-8 p-4 bg-white rounded-xl border border-papel-dark">
        <input
          type="search"
          placeholder="Buscar por título o autor…"
          value={q}
          onChange={e => setFilter('q', e.target.value)}
          className="input-field flex-1 min-w-48"
        />
        <select value={category} onChange={e => setFilter('category', e.target.value)} className="input-field w-auto">
          <option value="">Todas las categorías</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={format} onChange={e => setFilter('format', e.target.value)} className="input-field w-auto">
          <option value="">Físico y ebook</option>
          <option value="fisico">Solo físicos</option>
          <option value="ebook">Solo ebooks</option>
        </select>
        {(category || format || q) && (
          <button onClick={() => router.push('/catalogo')} className="btn-ghost text-sm">
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {/* Contenido */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6">{error}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-papel-dark animate-pulse h-72" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-16 text-tinta-suave">
          <p className="text-4xl mb-4">📚</p>
          <p className="font-serif text-lg">No se encontraron libros con esos filtros</p>
          <button onClick={() => router.push('/catalogo')} className="btn-ghost mt-4">
            Ver todos los libros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {books.map(book => <BookCard key={book._id} book={book} />)}
        </div>
      )}
    </div>
  );
}

function CatalogoSkeleton() {
  return (
    <div>
      <div className="mb-6 h-10 bg-papel-dark rounded animate-pulse w-48" />
      <div className="mb-8 h-16 bg-papel-dark rounded-xl animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-papel-dark animate-pulse h-72" />
        ))}
      </div>
    </div>
  );
}

export default function CatalogoPage() {
  return (
    <Suspense fallback={<CatalogoSkeleton />}>
      <CatalogoContent />
    </Suspense>
  );
}
