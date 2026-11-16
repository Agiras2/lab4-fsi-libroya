import 'dotenv/config';
import mongoose from 'mongoose';
import User from './src/models/User.js';
import Book from './src/models/Book.js';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('[Seed] Error: MONGODB_URI no está definida en .env');
  process.exit(1);
}

const DEMO_USERS = [
  {
    name: 'Cliente Demo',
    email: 'cliente@libroya.com',
    password: 'Cliente123!',
    role: 'cliente',
  },
  {
    name: 'Administrador LibroYa',
    email: 'admin@libroya.com',
    password: 'Admin123!',
    role: 'admin',
  },
];

const DEMO_BOOKS = [
  // ── Libros Físicos (8) ──────────────────────────────────────────────────
  {
    title: 'Cien años de soledad',
    author: 'Gabriel García Márquez',
    isbn: '9780307474728',
    category: 'Novela',
    format: 'fisico',
    price: 24.99,
    stock: 12,
    lowStockThreshold: 3,
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780307474728-L.jpg?default=false',
    description: 'La obra cumbre del realismo mágico y una de las novelas más influyentes del siglo XX.',
    active: true,
  },
  {
    title: 'Breve historia del tiempo',
    author: 'Stephen Hawking',
    isbn: '9788497593793',
    category: 'Ciencia',
    format: 'fisico',
    price: 19.99,
    stock: 7,
    lowStockThreshold: 3,
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9788497593793-L.jpg?default=false',
    description: 'Del Big Bang a los agujeros negros: una exploración accesible del cosmos.',
    active: true,
  },
  {
    title: 'Sapiens: De animales a dioses',
    author: 'Yuval Noah Harari',
    isbn: '9788499926223',
    category: 'Historia',
    format: 'fisico',
    price: 28.50,
    stock: 2, // Alerta: Stock Bajo
    lowStockThreshold: 3,
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9788499926223-L.jpg?default=false',
    description: 'Una breve historia de la humanidad desde la revolución cognitiva hasta el presente.',
    active: true,
  },
  {
    title: 'El principito',
    author: 'Antoine de Saint-Exupéry',
    isbn: '9780156013987',
    category: 'Infantil',
    format: 'fisico',
    price: 12.99,
    stock: 1, // Alerta: Stock Bajo
    lowStockThreshold: 3,
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780156013987-L.jpg?default=false',
    description: 'Un cuento poético sobre el amor, la amistad y el sentido de la vida.',
    active: true,
  },
  {
    title: 'Clean Code: Manual de estilo ágil',
    author: 'Robert C. Martin',
    isbn: '9780132350884',
    category: 'Tecnología',
    format: 'fisico',
    price: 37.99,
    stock: 6,
    lowStockThreshold: 3,
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg?default=false',
    description: 'Guía fundamental para desarrolladores que buscan escribir código limpio, legible y mantenible.',
    active: true,
  },
  {
    title: 'Veinte poemas de amor y una canción desesperada',
    author: 'Pablo Neruda',
    isbn: '9788420658926',
    category: 'Poesía',
    format: 'fisico',
    price: 11.50,
    stock: 0, // Alerta: Agotado
    lowStockThreshold: 3,
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9788420658926-L.jpg?default=false',
    description: 'Uno de los libros de poesía en lengua española más leídos y celebrados de todos los tiempos.',
    active: true,
  },
  {
    title: 'El código Da Vinci',
    author: 'Dan Brown',
    isbn: '9780307474278',
    category: 'Novela',
    format: 'fisico',
    price: 18.99,
    stock: 9,
    lowStockThreshold: 3,
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780307474278-L.jpg?default=false',
    description: 'Un misterio apasionante lleno de enigmas históricos y conspiraciones milenarias.',
    active: true,
  },
  {
    title: 'Cosmos',
    author: 'Carl Sagan',
    isbn: '9780345539434',
    category: 'Ciencia',
    format: 'fisico',
    price: 29.99,
    stock: 3, // Alerta: En el umbral de stock bajo
    lowStockThreshold: 3,
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780345539434-L.jpg?default=false',
    description: 'Un viaje extraordinario por el universo de la mano de uno de los mayores divulgadores científicos.',
    active: true,
  },

  // ── Libros Electrónicos (Ebooks - Dominio Público Project Gutenberg) (8) ───
  {
    title: 'Don Quijote de la Mancha',
    author: 'Miguel de Cervantes Saavedra',
    isbn: '9788491050261',
    category: 'Novela',
    format: 'ebook',
    price: 9.99,
    stock: 0,
    lowStockThreshold: 0,
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9788491050261-L.jpg?default=false',
    ebookFileUrl: 'https://www.gutenberg.org/ebooks/2000.epub3.images',
    description: 'Las aventuras del ingenioso hidalgo Don Quijote de la Mancha y su leal escudero Sancho Panza.',
    active: true,
  },
  {
    title: 'Orgullo y prejuicio',
    author: 'Jane Austen',
    isbn: '9788491050087',
    category: 'Novela',
    format: 'ebook',
    price: 7.99,
    stock: 0,
    lowStockThreshold: 0,
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9788491050087-L.jpg?default=false',
    ebookFileUrl: 'https://www.gutenberg.org/ebooks/42671.epub3.images',
    description: 'Una brillante sátira sobre el matrimonio, la moralidad y los malentendidos en la sociedad inglesa.',
    active: true,
  },
  {
    title: 'La metamorfosis',
    author: 'Franz Kafka',
    isbn: '9788491050414',
    category: 'Novela',
    format: 'ebook',
    price: 6.99,
    stock: 0,
    lowStockThreshold: 0,
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9788491050414-L.jpg?default=false',
    ebookFileUrl: 'https://www.gutenberg.org/ebooks/57884.epub3.images',
    description: 'Gregor Samsa se despierta una mañana transformado en un monstruoso insecto.',
    active: true,
  },
  {
    title: 'Frankenstein o el moderno Prometeo',
    author: 'Mary Shelley',
    isbn: '9788491050735',
    category: 'Novela',
    format: 'ebook',
    price: 8.49,
    stock: 0,
    lowStockThreshold: 0,
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9788491050735-L.jpg?default=false',
    ebookFileUrl: 'https://www.gutenberg.org/ebooks/84.epub3.images',
    description: 'La clásica historia gótica de obsesión científica, ambición y soledad existencial.',
    active: true,
  },
  {
    title: 'Drácula',
    author: 'Bram Stoker',
    isbn: '9788491050186',
    category: 'Novela',
    format: 'ebook',
    price: 9.49,
    stock: 0,
    lowStockThreshold: 0,
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9788491050186-L.jpg?default=false',
    ebookFileUrl: 'https://www.gutenberg.org/ebooks/345.epub3.images',
    description: 'El conde Drácula viaja desde Transilvania hasta Inglaterra sembrando el terror y la intriga.',
    active: true,
  },
  {
    title: 'Alicia en el país de las maravillas',
    author: 'Lewis Carroll',
    isbn: '9788491050117',
    category: 'Infantil',
    format: 'ebook',
    price: 5.99,
    stock: 0,
    lowStockThreshold: 0,
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9788491050117-L.jpg?default=false',
    ebookFileUrl: 'https://www.gutenberg.org/ebooks/11.epub3.images',
    description: 'Alicia cae por una madriguera hacia un mundo de fantasía lleno de seres extraordinarios y disparatados.',
    active: true,
  },
  {
    title: 'Moby Dick',
    author: 'Herman Melville',
    isbn: '9788491050353',
    category: 'Novela',
    format: 'ebook',
    price: 10.99,
    stock: 0,
    lowStockThreshold: 0,
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9788491050353-L.jpg?default=false',
    ebookFileUrl: 'https://www.gutenberg.org/ebooks/2701.epub3.images',
    description: 'La incansable y destructiva búsqueda del capitán Ahab para cazar a la gran ballena blanca.',
    active: true,
  },
  {
    title: 'El retrato de Dorian Gray',
    author: 'Oscar Wilde',
    isbn: '9788491050216',
    category: 'Novela',
    format: 'ebook',
    price: 7.49,
    stock: 0,
    lowStockThreshold: 0,
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9788491050216-L.jpg?default=false',
    ebookFileUrl: 'https://www.gutenberg.org/ebooks/174.epub3.images',
    description: 'Un joven vende su alma para mantener la juventud eterna mientras su retrato envejece con sus pecados.',
    active: true,
  },
];

async function seed() {
  console.log('[Seed] Conectando a MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI);
  console.log('[Seed] Conexión establecida.');

  // ── 1. Usuarios demo (Idempotente) ──────────────────────────────────────────
  console.log('[Seed] Sembrando usuarios demo...');
  for (const u of DEMO_USERS) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      existing.name = u.name;
      existing.role = u.role;
      existing.passwordHash = u.password; // pre-save hook lo hasheará
      await existing.save();
      console.log(`  ✓ Usuario actualizado: ${u.email} (${u.role})`);
    } else {
      const newUser = new User({
        name: u.name,
        email: u.email,
        passwordHash: u.password,
        role: u.role,
      });
      await newUser.save();
      console.log(`  + Usuario creado: ${u.email} (${u.role})`);
    }
  }

  // ── 2. Libros demo (Idempotente) ────────────────────────────────────────────
  console.log('[Seed] Sembrando catálogo de libros...');
  // Limpiamos libros previos para garantizar un catálogo consistente y sin duplicados
  await Book.deleteMany({});
  const inserted = await Book.insertMany(DEMO_BOOKS);
  console.log(`  ✓ ${inserted.length} libros insertados exitosamente.`);

  const fisicos = inserted.filter((b) => b.format === 'fisico');
  const ebooks = inserted.filter((b) => b.format === 'ebook');
  const agotados = inserted.filter((b) => b.format === 'fisico' && b.stock === 0);
  const bajoStock = inserted.filter(
    (b) => b.format === 'fisico' && b.stock > 0 && b.stock <= b.lowStockThreshold
  );

  console.log('\n[Seed] Resumen del catálogo:');
  console.log(`  - Total libros: ${inserted.length}`);
  console.log(`  - Físicos: ${fisicos.length}`);
  console.log(`  - Ebooks: ${ebooks.length}`);
  console.log(`  - Con stock bajo: ${bajoStock.length} (${bajoStock.map((b) => b.title).join(', ')})`);
  console.log(`  - Agotados: ${agotados.length} (${agotados.map((b) => b.title).join(', ')})`);

  console.log('\n[Seed] Proceso completado exitosamente.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[Seed] Error ejecutando seed:', err);
  process.exit(1);
});

