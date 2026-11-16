'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';
import { useSocket } from '@/contexts/SocketContext';
import BookForm from '@/components/BookForm';
import StockBadge from '@/components/StockBadge';
import type { Book } from '@/components/BookCard';

export default function AdminCatalogoPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [lowStockBooks, setLowStockBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'low-stock'>('all');

  // Modal de creación / edición
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  // Stock rápido
  const [quickStockId, setQuickStockId] = useState<string | null>(null);
  const [stockDelta, setStockDelta] = useState<string>('1');
  const [stockLoading, setStockLoading] = useState(false);

  const { socket } = useSocket();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [allRes, lowRes] = await Promise.all([
        apiClient<{ books: Book[] }>('/api/books'),
        apiClient<{ books: Book[] }>('/api/admin/low-stock'),
      ]);
      setBooks(allRes.books);
      setLowStockBooks(lowRes.books);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar los libros');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Actualización en tiempo real vía WebSocket
  useEffect(() => {
    if (!socket) return;
    const handleStockChanged = (data: { bookId: string; stock: number }) => {
      setBooks((prev) =>
        prev.map((b) => (b._id === data.bookId ? { ...b, stock: data.stock } : b))
      );
      // Actualizar también lista de low-stock
      setLowStockBooks((prev) => {
        const target = books.find((b) => b._id === data.bookId);
        if (!target) return prev;
        const updated = { ...target, stock: data.stock };
        if (data.stock <= updated.lowStockThreshold) {
          const exists = prev.some((b) => b._id === data.bookId);
          return exists
            ? prev.map((b) => (b._id === data.bookId ? updated : b))
            : [...prev, updated];
        } else {
          return prev.filter((b) => b._id !== data.bookId);
        }
      });
    };

    socket.on('book:stockChanged', handleStockChanged);
    return () => {
      socket.off('book:stockChanged', handleStockChanged);
    };
  }, [socket, books]);

  // Alternar estado activo / inactivo
  const handleToggleActive = async (book: Book) => {
    try {
      await apiClient(`/api/books/${book._id}`, {
        method: 'PATCH',
        body: { active: !book.active },
      });
      setBooks((prev) =>
        prev.map((b) => (b._id === book._id ? { ...b, active: !book.active } : b))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al cambiar estado');
    }
  };

  // Ajuste rápido de stock (+ / -)
  const handleAdjustStock = async (bookId: string, delta: number) => {
    setStockLoading(true);
    try {
      const res = await apiClient<{ book: { _id: string; stock: number } }>(
        `/api/books/${bookId}/stock`,
        {
          method: 'PATCH',
          body: { delta },
        }
      );
      setBooks((prev) =>
        prev.map((b) => (b._id === bookId ? { ...b, stock: res.book.stock } : b))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error ajustando stock');
    } finally {
      setStockLoading(false);
    }
  };

  const handleCustomStockSubmit = async (bookId: string) => {
    const d = parseInt(stockDelta);
    if (isNaN(d)) return;
    await handleAdjustStock(bookId, d);
    setQuickStockId(null);
  };

  const displayedBooks = activeTab === 'all' ? books : lowStockBooks;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* ── Encabezado y Acción Principal ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-tinta">
            Gestión de Catálogo e Inventario
          </h1>
          <p className="text-sm text-tinta-suave mt-1">
            Administra libros, ajusta existencias y monitorea alertas de stock bajo.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingBook(null);
            setIsModalOpen(true);
          }}
          className="btn-primary"
        >
          + Agregar nuevo libro
        </button>
      </div>

      {/* ── Tabs de Navegación ─────────────────────────────────────────── */}
      <div className="flex gap-4 border-b border-papel-dark pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-verde-600 text-verde-700'
              : 'border-transparent text-tinta-suave hover:text-tinta'
          }`}
        >
          Todos los libros ({books.length})
        </button>
        <button
          onClick={() => setActiveTab('low-stock')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'low-stock'
              ? 'border-orange-500 text-orange-700 font-bold'
              : 'border-transparent text-tinta-suave hover:text-tinta'
          }`}
        >
          <span>Alertas de stock bajo</span>
          {lowStockBooks.length > 0 && (
            <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded-full font-bold">
              {lowStockBooks.length}
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ── Tabla de Libros ────────────────────────────────────────────── */}
      <div className="card overflow-x-auto p-0 border border-papel-dark">
        {loading ? (
          <div className="p-12 text-center text-tinta-suave">Cargando inventario...</div>
        ) : displayedBooks.length === 0 ? (
          <div className="p-12 text-center text-tinta-suave">
            {activeTab === 'low-stock'
              ? '¡Excelente! No hay libros con stock bajo en este momento.'
              : 'No hay libros registrados en el catálogo.'}
          </div>
        ) : (
          <table className="w-full text-left text-sm text-tinta">
            <thead className="bg-papel text-xs uppercase text-tinta-suave border-b border-papel-dark">
              <tr>
                <th className="py-3 px-4">Libro</th>
                <th className="py-3 px-4">Formato / Categoría</th>
                <th className="py-3 px-4">Precio</th>
                <th className="py-3 px-4">Stock actual</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-papel-dark">
              {displayedBooks.map((book) => (
                <tr
                  key={book._id}
                  className={`hover:bg-papel/40 transition-colors ${
                    !book.active ? 'opacity-60 bg-gray-50/50' : ''
                  }`}
                >
                  {/* Título y Autor */}
                  <td className="py-3 px-4">
                    <div className="font-serif font-bold text-tinta">{book.title}</div>
                    <div className="text-xs text-tinta-suave">{book.author}</div>
                    {book.isbn && (
                      <div className="text-[11px] text-tinta-suave/70">ISBN: {book.isbn}</div>
                    )}
                  </td>

                  {/* Formato y Categoría */}
                  <td className="py-3 px-4 space-y-1">
                    <span className="badge badge-green text-xs block w-fit">
                      {book.format === 'ebook' ? '📱 Ebook' : '📖 Físico'}
                    </span>
                    <span className="text-xs text-tinta-suave block">{book.category}</span>
                  </td>

                  {/* Precio */}
                  <td className="py-3 px-4 font-semibold text-verde-700">
                    ${book.price.toFixed(2)} USD
                  </td>

                  {/* Stock y Alerta */}
                  <td className="py-3 px-4">
                    {book.format === 'fisico' ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold ${
                              book.stock === 0
                                ? 'text-red-600'
                                : book.stock <= book.lowStockThreshold
                                ? 'text-orange-600'
                                : 'text-tinta'
                            }`}
                          >
                            {book.stock} unid.
                          </span>
                        </div>
                        <StockBadge book={book} />

                        {/* Control rápido de Stock */}
                        <div className="flex items-center gap-1 pt-1">
                          <button
                            type="button"
                            disabled={stockLoading || book.stock <= 0}
                            onClick={() => handleAdjustStock(book._id, -1)}
                            className="w-6 h-6 rounded bg-papel-dark hover:bg-papel text-xs font-bold flex items-center justify-center disabled:opacity-40"
                            title="Restar 1 unidad"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            disabled={stockLoading}
                            onClick={() => handleAdjustStock(book._id, 1)}
                            className="w-6 h-6 rounded bg-papel-dark hover:bg-papel text-xs font-bold flex items-center justify-center"
                            title="Sumar 1 unidad"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setQuickStockId(quickStockId === book._id ? null : book._id)
                            }
                            className="text-[11px] text-verde-700 hover:underline ml-1"
                          >
                            Ajustar
                          </button>
                        </div>

                        {quickStockId === book._id && (
                          <div className="flex items-center gap-1 mt-2">
                            <input
                              type="number"
                              value={stockDelta}
                              onChange={(e) => setStockDelta(e.target.value)}
                              placeholder="+/-"
                              className="w-16 px-1.5 py-0.5 text-xs border rounded input-field"
                            />
                            <button
                              type="button"
                              onClick={() => handleCustomStockSubmit(book._id)}
                              className="px-2 py-0.5 text-xs bg-verde-600 text-white rounded font-medium"
                            >
                              Aplicar
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-blue-700 font-medium">Digital (Sin stock)</span>
                    )}
                  </td>

                  {/* Estado Activo / Inactivo */}
                  <td className="py-3 px-4">
                    <span
                      className={`badge text-xs ${
                        book.active ? 'badge-green' : 'badge-gray'
                      }`}
                    >
                      {book.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>

                  {/* Acciones */}
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBook(book);
                        setIsModalOpen(true);
                      }}
                      className="text-xs font-medium text-verde-700 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(book)}
                      className={`text-xs font-medium hover:underline ${
                        book.active ? 'text-red-600' : 'text-verde-700'
                      }`}
                    >
                      {book.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal de Creación / Edición ────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto my-8">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-papel-dark">
              <h2 className="font-serif font-bold text-xl text-tinta">
                {editingBook ? `Editar: ${editingBook.title}` : 'Crear nuevo libro'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-tinta-suave hover:text-tinta text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <BookForm
              initialData={editingBook || undefined}
              onSuccess={() => {
                setIsModalOpen(false);
                setEditingBook(null);
                loadData();
              }}
              onCancel={() => {
                setIsModalOpen(false);
                setEditingBook(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
