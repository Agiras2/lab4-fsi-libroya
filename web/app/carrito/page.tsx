'use client';
import { useAuth } from '@/contexts/AuthContext';

export default function CarritoPage() {
  const { user } = useAuth();
  return (
    <div>
      <h1 className="text-3xl font-serif font-bold text-tinta mb-4">Carrito</h1>
      <p className="text-tinta-suave">
        Hola, {user?.name}. (Disponible en la Entrega 2)
      </p>
    </div>
  );
}

