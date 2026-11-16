'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/contexts/CartContext';
import StockBadge from './StockBadge';

export interface Book {
  _id: string;
  title: string;
  author: string;
  format: 'fisico' | 'ebook';
  price: number;
  coverUrl?: string;
  stock: number;
  lowStockThreshold: number;
  category: string;
  active: boolean;
}

function PlaceholderCover({ title, author }: { title: string; author: string }) {
  // Color determinista basado en el primer carácter del título
  const palettes = [
    'bg-verde-100 text-verde-700',
    'bg-terracota-100 text-terracota-700',
    'bg-blue-100 text-blue-700',
    'bg-amber-100 text-amber-700',
  ];
  const idx = (title.charCodeAt(0) || 0) % palettes.length;
  return (
    <div className={`w-full h-full flex flex-col items-center justify-center p-3 text-center ${palettes[idx]}`}>
      <span className="text-3xl mb-2">📚</span>
      <p className="font-serif text-xs font-bold line-clamp-3 leading-tight">{title}</p>
      <p className="text-xs opacity-70 mt-1 line-clamp-2">{author}</p>
    </div>
  );
}

function BookCover({ coverUrl, title, author }: { coverUrl?: string; title: string; author: string }) {
  const [error, setError] = useState(false);

  if (!coverUrl || error) {
    return <PlaceholderCover title={title} author={author} />;
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

export default function BookCard({ book }: { book: Book }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const isAvailable =
    book.format === 'ebook' || book.stock > 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isAvailable) return;
    addItem({
      bookId: book._id,
      title: book.title,
      author: book.author,
      format: book.format,
      price: book.price,
      coverUrl: book.coverUrl,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <Link href={`/libros/${book._id}`} className="group block">
      <div className="bg-white rounded-xl border border-papel-dark overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
        {/* Portada */}
        <div className="relative h-56 bg-papel-dark overflow-hidden">
          <BookCover coverUrl={book.coverUrl} title={book.title} author={book.author} />
          {/* Badge de formato */}
          <span className="absolute top-2 left-2 badge badge-green text-xs">
            {book.format === 'ebook' ? '📱 Ebook' : '📖 Físico'}
          </span>
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="font-serif font-bold text-tinta text-sm leading-snug line-clamp-2 group-hover:text-verde-700 transition-colors">
            {book.title}
          </h3>
          <p className="text-xs text-tinta-suave mt-1 line-clamp-1">{book.author}</p>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-verde-700 font-bold text-base">
              ${book.price.toFixed(2)}
            </span>
            <StockBadge book={book} />
          </div>

          <button
            onClick={handleAddToCart}
            disabled={!isAvailable || added}
            className={`mt-3 w-full text-sm py-1.5 rounded-lg font-medium transition-all duration-150
              ${added
                ? 'bg-verde-100 text-verde-700 cursor-default'
                : isAvailable
                  ? 'btn-primary'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
          >
            {added ? '✓ Agregado' : isAvailable ? 'Agregar al carrito' : 'Agotado'}
          </button>
        </div>
      </div>
    </Link>
  );
}

