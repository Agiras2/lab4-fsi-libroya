import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { SocketProvider } from '@/contexts/SocketContext';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'LibroYa — Tu librería en línea',
  description: 'Libros físicos y electrónicos. Compra, descarga y disfruta.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-papel text-tinta font-sans antialiased">
        <AuthProvider>
          <CartProvider>
            <SocketProvider>
              <Navbar />
              <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
              </main>
              <footer className="border-t border-papel-dark mt-16 py-8 text-center text-sm text-tinta-suave/70">
                © {new Date().getFullYear()} LibroYa — Todos los derechos reservados
              </footer>
            </SocketProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
