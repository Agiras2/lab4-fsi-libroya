import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rutas que requieren estar autenticado como 'cliente'
const CLIENT_ROUTES = ['/carrito', '/checkout', '/mis-pedidos', '/mi-biblioteca'];

// Rutas que requieren estar autenticado como 'admin'
const ADMIN_ROUTES = ['/admin'];

// Rutas que son solo para NO autenticados (login / registro)
const AUTH_ONLY_ROUTES = ['/login', '/registro'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Leemos el token de la Authorization header no es posible en middleware Next.js
  // desde el lado servidor; usamos una cookie auxiliar solo para el guard de ruta.
  // El token real sigue viviendo en localStorage y en el header Authorization.
  // Estrategia: el AuthContext setea la cookie 'libroya_role' (no HttpOnly) 
  // para que el middleware pueda leer el rol sin exponer el JWT.
  const role = request.cookies.get('libroya_role')?.value;
  const hasSession = Boolean(role);

  const isClientRoute = CLIENT_ROUTES.some((r) => pathname.startsWith(r));
  const isAdminRoute = ADMIN_ROUTES.some((r) => pathname.startsWith(r));
  const isAuthRoute = AUTH_ONLY_ROUTES.some((r) => pathname.startsWith(r));

  // Si intenta acceder a una ruta de cliente sin sesión → login
  if (isClientRoute && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Si intenta acceder a una ruta de cliente pero es admin → panel admin
  if (isClientRoute && role === 'admin') {
    return NextResponse.redirect(new URL('/admin/catalogo', request.url));
  }

  // Si intenta acceder a una ruta de admin sin ser admin → inicio
  if (isAdminRoute && role !== 'admin') {
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Si ya tiene sesión e intenta ir a login/registro → redirige según rol
  if (isAuthRoute && hasSession) {
    const dest = role === 'admin' ? '/admin/catalogo' : '/';
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/carrito/:path*',
    '/checkout/:path*',
    '/mis-pedidos/:path*',
    '/mi-biblioteca/:path*',
    '/admin/:path*',
    '/login',
    '/registro',
  ],
};

