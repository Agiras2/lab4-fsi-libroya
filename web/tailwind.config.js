/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './contexts/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Fondo color papel (crema claro)
        papel: '#F5F0E8',
        'papel-dark': '#EDE8DC',
        // Texto tinta casi negra
        tinta: '#1A1A18',
        'tinta-suave': '#3D3D38',
        // Acento verde botella
        verde: {
          DEFAULT: '#2D5016',
          light: '#3D6B1E',
          dark: '#1E3610',
          50: '#F0F5EA',
          100: '#D6E8C4',
          200: '#AECF89',
          500: '#3D6B1E',
          600: '#2D5016',
          700: '#1E3610',
        },
        // Detalles terracota
        terracota: {
          DEFAULT: '#B5451B',
          light: '#D4572A',
          dark: '#8C3415',
          50: '#FBF0EC',
          100: '#F5D5C8',
          200: '#E8A88D',
          500: '#D4572A',
          600: '#B5451B',
          700: '#8C3415',
        },
      },
      fontFamily: {
        // Serif elegante para títulos
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        // Sans-serif legible para cuerpo
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-papel': 'linear-gradient(135deg, #F5F0E8 0%, #EDE8DC 100%)',
      },
    },
  },
  plugins: [],
};

