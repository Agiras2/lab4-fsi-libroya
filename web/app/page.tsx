'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import BookCard, { type Book } from '@/components/BookCard';

export default function HomePage() {
  const [featuredBooks, setFeaturedBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient<{ books: Book[] }>('/api/books')
      .then((data) => {
        // Tomamos los primeros 8 libros como destacados
        setFeaturedBooks(data.books.slice(0, 8));
      })
      .catch((err) => {
        console.error('Error cargando libros destacados:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = [
    { name: 'Novela', icon: '📖', desc: 'Clásicos y ficción contemporánea' },
    { name: 'Ciencia', icon: '🔬', desc: 'Divulgación, física y astronomía' },
    { name: 'Historia', icon: '🏛️', desc: 'Crónicas y civilizaciones' },
    { name: 'Infantil', icon: '🎈', desc: 'Cuentos y literatura juvenil' },
    { name: 'Tecnología', icon: '💻', desc: 'Programación y arquitectura' },
    { name: 'Poesía', icon: '✒️', desc: 'Versos y prosa poética' },
  ];

  return (
    <div className="space-y-16">
      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="text-center py-12 md:py-20 bg-gradient-to-b from-white to-papel rounded-3xl border border-papel-dark p-8 shadow-sm">
        <span className="badge badge-green text-xs mb-4">Librería en línea independiente</span>
        <h1 className="text-4xl md:text-6xl font-serif font-bold text-tinta max-w-3xl mx-auto leading-tight">
          Historias en papel, conocimiento al instante
        </h1>
        <p className="mt-4 text-base md:text-lg text-tinta-suave max-w-2xl mx-auto leading-relaxed">
          Encuentra libros físicos con entrega a domicilio y libros electrónicos para descarga inmediata en tu biblioteca personal.
        </p>

        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link href="/catalogo" className="btn-primary text-base px-8 py-3">
            Explorar catálogo completo
          </Link>
          <Link href="/catalogo?format=ebook" className="btn-secondary text-base px-8 py-3">
            Ver solo ebooks
          </Link>
        </div>

        {/* Pequeñas características */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-papel-dark/60 text-left">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📦</span>
            <div>
              <h4 className="font-serif font-bold text-sm text-tinta">Envíos a domicilio</h4>
              <p className="text-xs text-tinta-suave">Seguimiento en vivo desde el despacho hasta la entrega.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h4 className="font-serif font-bold text-sm text-tinta">Ebooks al instante</h4>
              <p className="text-xs text-tinta-suave">Descarga en formato EPUB directo a tu biblioteca.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <h4 className="font-serif font-bold text-sm text-tinta">Pago protegido</h4>
              <p className="text-xs text-tinta-suave">Paga seguro con PayPal Sandbox en dólares (USD).</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Categorías destacadas ────────────────────────────────────────── */}
      <section>
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-tinta">Explorar por categoría</h2>
            <p className="text-sm text-tinta-suave mt-1">Elige tu género favorito</p>
          </div>
          <Link href="/catalogo" className="btn-ghost text-sm">
            Ver todas →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              href={`/catalogo?category=${encodeURIComponent(cat.name)}`}
              className="bg-white p-4 rounded-xl border border-papel-dark text-center hover:border-verde-500 hover:shadow-sm transition-all group"
            >
              <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform">{cat.icon}</span>
              <h3 className="font-serif font-bold text-sm text-tinta group-hover:text-verde-700">{cat.name}</h3>
              <p className="text-[11px] text-tinta-suave mt-1 line-clamp-1">{cat.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Libros destacados ────────────────────────────────────────────── */}
      <section>
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-tinta">Libros destacados</h2>
            <p className="text-sm text-tinta-suave mt-1">Nuestra selección recomendada de la semana</p>
          </div>
          <Link href="/catalogo" className="btn-ghost text-sm">
            Ver catálogo completo →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-80 bg-papel-dark rounded-xl animate-pulse" />
            ))}
          </div>
        ) : featuredBooks.length === 0 ? (
          <div className="card text-center py-12 text-tinta-suave">
            <p>No hay libros destacados disponibles en este momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-6">
            {featuredBooks.map((book) => (
              <BookCard key={book._id} book={book} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
