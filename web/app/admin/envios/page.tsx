'use client';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminEnviosPage() {
  const { user } = useAuth();
  return (
    <div>
      <h1 className="text-3xl font-serif font-bold text-tinta mb-4">Tablero de envíos</h1>
      <p className="text-tinta-suave">
        Hola, {user?.name} (admin). (Disponible en la Entrega 4)
      </p>
    </div>
  );
}

