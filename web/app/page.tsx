export default function HomePage() {
  return (
    <div className="text-center py-16">
      <h1 className="text-4xl font-serif font-bold text-tinta mb-4">
        Bienvenido a <span className="text-verde-600">LibroYa</span>
      </h1>
      <p className="text-lg text-tinta-suave max-w-xl mx-auto">
        Tu librería en línea de libros físicos y electrónicos. Encuentra tu próxima gran lectura.
      </p>
      <div className="mt-8 flex gap-4 justify-center">
        <a href="/catalogo" className="btn-primary">Ver catálogo</a>
        <a href="/registro" className="btn-ghost">Crear cuenta</a>
      </div>
    </div>
  );
}

