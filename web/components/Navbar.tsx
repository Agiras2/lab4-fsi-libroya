'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-papel-dark shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="font-serif text-2xl font-bold text-verde-600 hover:text-verde-700 transition-colors">
          LibroYa
        </Link>

        {/* Links centrales */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/catalogo" className="text-sm font-medium text-tinta-suave hover:text-verde-600 transition-colors">
            Catálogo
          </Link>
          {user?.role === 'cliente' && (
            <>
              <Link href="/mis-pedidos" prefetch={false} className="text-sm font-medium text-tinta-suave hover:text-verde-600 transition-colors">
                Mis pedidos
              </Link>
              <Link href="/mi-biblioteca" prefetch={false} className="text-sm font-medium text-tinta-suave hover:text-verde-600 transition-colors">
                Mi biblioteca
              </Link>
            </>
          )}
          {user?.role === 'admin' && (
            <>
              <Link href="/admin/catalogo" prefetch={false} className="text-sm font-medium text-tinta-suave hover:text-verde-600 transition-colors">
                Catálogo
              </Link>
              <Link href="/admin/envios" prefetch={false} className="text-sm font-medium text-tinta-suave hover:text-verde-600 transition-colors">
                Envíos
              </Link>
            </>
          )}
        </div>

        {/* Auth + carrito */}
        <div className="flex items-center gap-3">
          {/* Carrito — visible para clientes y visitantes */}
          {user?.role !== 'admin' && (
            <Link href="/carrito" prefetch={false} className="relative btn-ghost p-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-9H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-terracota-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
            </Link>
          )}

          {user ? (
            <>
              <span className="hidden sm:block text-sm text-tinta-suave">
                Hola, <span className="font-medium text-tinta">{user.name.split(' ')[0]}</span>
              </span>
              <button onClick={handleLogout} className="btn-ghost text-sm">Salir</button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">Iniciar sesión</Link>
              <Link href="/registro" className="btn-primary">Registrarse</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
