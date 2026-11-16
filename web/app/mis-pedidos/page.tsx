'use client';
import { useAuth } from '@/contexts/AuthContext';

export default function MisPedidosPage() {
  const { user } = useAuth();
  return (
    <div>
      <h1 className="text-3xl font-serif font-bold text-tinta mb-4">Mis pedidos</h1>
      <p className="text-tinta-suave">
        Hola, {user?.name}. (Disponible en la Entrega 3)
      </p>
    </div>
  );
}

