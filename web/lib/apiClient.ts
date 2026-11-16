const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('libroya_token');
}

/**
 * Wrapper de fetch con:
 * - baseURL del backend
 * - header Authorization: Bearer <token> automático
 * - Serialización JSON del body
 * - Devolución del JSON parseado o lanzamiento del { error } del servidor
 */
export async function apiClient<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, headers = {}, ...rest } = options;

  const token = getToken();
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };
  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 204 No Content
  if (response.status === 204) return undefined as T;

  const data = await response.json();

  if (!response.ok) {
    // Si el servidor responde 401, el contexto de Auth limpiará la sesión
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    throw new Error(data.error || `Error ${response.status}`);
  }

  return data as T;
}

