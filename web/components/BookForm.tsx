'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import type { Book } from './BookCard';

const CATEGORIES = ['Novela', 'Ciencia', 'Historia', 'Infantil', 'Tecnología', 'Poesía', 'Otro'];

interface BookFormData {
  title: string;
  author: string;
  isbn: string;
  description: string;
  category: string;
  format: 'fisico' | 'ebook';
  price: string;
  coverUrl: string;
  stock: string;
  lowStockThreshold: string;
  ebookFileUrl: string;
  active: boolean;
}

interface BookFormProps {
  initialData?: (Partial<BookFormData> | Partial<Book>) & { _id?: string; ebookFileUrl?: string };
  onSuccess: () => void;
  onCancel: () => void;
}

const EMPTY: BookFormData = {
  title: '', author: '', isbn: '', description: '',
  category: 'Novela', format: 'fisico', price: '',
  coverUrl: '', stock: '0', lowStockThreshold: '3',
  ebookFileUrl: '', active: true,
};

export default function BookForm({ initialData, onSuccess, onCancel }: BookFormProps) {
  const isEdit = Boolean(initialData?._id);
  const [form, setForm] = useState<BookFormData>({
    ...EMPTY,
    ...(initialData as Partial<BookFormData>),
    price: initialData?.price?.toString() ?? '',
    stock: initialData?.stock?.toString() ?? '0',
    lowStockThreshold: initialData?.lowStockThreshold?.toString() ?? '3',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(field: keyof BookFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        author: form.author.trim(),
        description: form.description.trim(),
        category: form.category,
        format: form.format,
        price: parseFloat(form.price),
        coverUrl: form.coverUrl.trim(),
        lowStockThreshold: parseInt(form.lowStockThreshold),
        active: form.active,
      };
      if (form.isbn.trim()) payload.isbn = form.isbn.trim();
      if (form.format === 'fisico') payload.stock = parseInt(form.stock);
      if (form.format === 'ebook' && form.ebookFileUrl.trim()) {
        payload.ebookFileUrl = form.ebookFileUrl.trim();
      }

      if (isEdit) {
        await apiClient(`/api/books/${initialData!._id}`, { method: 'PATCH', body: payload });
      } else {
        await apiClient('/api/books', { method: 'POST', body: payload });
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  const field = (label: string, children: React.ReactNode) => (
    <div>
      <label className="block text-sm font-medium text-tinta mb-1">{label}</label>
      {children}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('Título *', (
          <input required value={form.title} onChange={e => set('title', e.target.value)} className="input-field" />
        ))}
        {field('Autor *', (
          <input required value={form.author} onChange={e => set('author', e.target.value)} className="input-field" />
        ))}
        {field('ISBN', (
          <input value={form.isbn} onChange={e => set('isbn', e.target.value)} className="input-field" placeholder="Opcional" />
        ))}
        {field('Categoría *', (
          <select required value={form.category} onChange={e => set('category', e.target.value)} className="input-field">
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        ))}
        {field('Formato *', (
          <select required value={form.format} onChange={e => set('format', e.target.value as 'fisico' | 'ebook')} className="input-field">
            <option value="fisico">Físico</option>
            <option value="ebook">Ebook</option>
          </select>
        ))}
        {field('Precio (USD) *', (
          <input required type="number" min="0.01" step="0.01" value={form.price}
            onChange={e => set('price', e.target.value)} className="input-field" placeholder="9.99" />
        ))}
        {form.format === 'fisico' && field('Stock inicial', (
          <input type="number" min="0" value={form.stock}
            onChange={e => set('stock', e.target.value)} className="input-field" />
        ))}
        {field('Umbral de stock bajo', (
          <input type="number" min="0" value={form.lowStockThreshold}
            onChange={e => set('lowStockThreshold', e.target.value)} className="input-field" />
        ))}
        {field('URL portada', (
          <input value={form.coverUrl} onChange={e => set('coverUrl', e.target.value)} className="input-field"
            placeholder="https://covers.openlibrary.org/..." />
        ))}
        {form.format === 'ebook' && field('URL del archivo ebook', (
          <input value={form.ebookFileUrl} onChange={e => set('ebookFileUrl', e.target.value)} className="input-field"
            placeholder="https://www.gutenberg.org/..." />
        ))}
      </div>

      {field('Descripción', (
        <textarea rows={3} value={form.description}
          onChange={e => set('description', e.target.value)}
          className="input-field resize-none" />
      ))}

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)}
          className="w-4 h-4 accent-verde-600" />
        <span className="text-sm font-medium text-tinta">Libro activo (visible en catálogo)</span>
      </label>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear libro'}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost">Cancelar</button>
      </div>
    </form>
  );
}

