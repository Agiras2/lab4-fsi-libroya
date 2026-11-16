import type { Book } from './BookCard';

interface Props {
  book: Book;
  size?: 'sm' | 'md';
}

export default function StockBadge({ book, size = 'sm' }: Props) {
  const cls = size === 'sm' ? 'badge text-xs px-2 py-0.5' : 'badge text-sm px-3 py-1';

  if (book.format === 'ebook') {
    return <span className={`${cls} bg-blue-50 text-blue-700`}>Descarga inmediata</span>;
  }

  if (book.stock === 0) {
    return <span className={`${cls} bg-red-50 text-red-700`}>Agotado</span>;
  }

  if (book.stock <= book.lowStockThreshold) {
    return (
      <span className={`${cls} bg-orange-50 text-orange-700`}>
        ⚠ Quedan {book.stock}
      </span>
    );
  }

  return <span className={`${cls} bg-verde-50 text-verde-700`}>Disponible</span>;
}

