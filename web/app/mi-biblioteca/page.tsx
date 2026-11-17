'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import type { EbookLibraryItem } from '@/lib/types';

function EbookCover({
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
        className={`w-full h-full flex flex-col items-center justify-center p-4 text-center ${palettes[idx]}`}
      >
        <span className="text-3xl mb-2">📱</span>
        <p className="font-serif text-xs font-bold line-clamp-3 leading-tight">{title}</p>
        <p className="text-xs opacity-75 mt-1 line-clamp-2">{author}</p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={coverUrl}
      alt={`Portada de ${title}`}
      className="w-full h-full object-cover"
      onError={() => setError(true)}
    />
  );
}

export default function MiBibliotecaPage() {
  const [ebooks, setEbooks] = useState<EbookLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    apiClient<{ ebooks: EbookLibraryItem[] }>('/api/library')
      .then((data) => setEbooks(data.ebooks))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Error al cargar tu biblioteca')
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-tinta">Mi biblioteca de ebooks</h1>
        <p className="text-sm text-tinta-suave mt-1">
          Accede y descarga todos los libros electrónicos que has adquirido en LibroYa.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-80 bg-papel-dark rounded-xl animate-pulse" />
          ))}
        </div>
      ) : ebooks.length === 0 ? (
        <div className="card text-center py-16 max-w-xl mx-auto space-y-4">
          <span className="text-5xl block">📱</span>
          <h2 className="text-2xl font-serif font-bold text-tinta">Tu biblioteca está vacía</h2>
          <p className="text-sm text-tinta-suave">
            Aún no has comprado ningún libro electrónico. Los ebooks cuentan con descarga inmediata sin costo de envío.
          </p>
          <Link href="/catalogo?format=ebook" className="btn-primary">
            Explorar catálogo de ebooks
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {ebooks.map((ebook) => (
            <div
              key={ebook._id}
              className="bg-white rounded-xl border border-papel-dark overflow-hidden shadow-sm flex flex-col justify-between"
            >
              <div>
                {/* Portada */}
                <div className="relative h-56 bg-papel-dark overflow-hidden">
                  <EbookCover
                    coverUrl={ebook.coverUrl}
                    title={ebook.title}
                    author={ebook.author}
                  />
                  <span className="absolute top-2 left-2 badge badge-green text-[11px]">
                    📱 Ebook digital
                  </span>
                </div>

                {/* Detalles */}
                <div className="p-4 space-y-2">
                  <span className="text-[11px] text-tinta-suave block">{ebook.category}</span>
                  <h3 className="font-serif font-bold text-base text-tinta line-clamp-2 leading-snug">
                    {ebook.title}
                  </h3>
                  <p className="text-xs text-tinta-suave">{ebook.author}</p>
                  {ebook.description && (
                    <p className="text-xs text-tinta-suave/80 line-clamp-3 mt-2">
                      {ebook.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Botón de Descarga */}
              <div className="p-4 pt-0">
                <a
                  href={ebook.ebookFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <span>⬇</span>
                  <span>Descargar EPUB</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
