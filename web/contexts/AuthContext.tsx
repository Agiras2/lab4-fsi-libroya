'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: 'cliente' | 'admin';
  createdAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Persist token in localStorage + cookie auxiliar de rol para el middleware de Next.js
  const saveSession = useCallback((newToken: string, newUser: AuthUser) => {
    localStorage.setItem('libroya_token', newToken);
    // Cookie no-HttpOnly solo para que middleware.ts pueda leer el rol en SSR.
    // No contiene el JWT; no es una cookie de autenticación.
    document.cookie = `libroya_role=${newUser.role}; path=/; SameSite=Lax`;
    setToken(newToken);
    setUser(newUser);
    router.refresh();
  }, [router]);

  const clearSession = useCallback(() => {
    localStorage.removeItem('libroya_token');
    // Borra la cookie auxiliar de rol
    document.cookie = 'libroya_role=; path=/; max-age=0';
    setToken(null);
    setUser(null);
    router.refresh();
  }, [router]);

  // Rehydrate session on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('libroya_token');
    if (!storedToken) {
      setLoading(false);
      return;
    }
    setToken(storedToken);
    apiClient<{ user: AuthUser }>('/api/auth/me')
      .then(({ user: fetchedUser }) => {
        setUser(fetchedUser);
        // Re-sincroniza la cookie auxiliar de rol al rehidratar
        document.cookie = `libroya_role=${fetchedUser.role}; path=/; SameSite=Lax`;
      })
      .catch(() => clearSession())
      .finally(() => setLoading(false));
  }, [clearSession]);

  // Listen for 401 dispatched by apiClient
  useEffect(() => {
    const handle = () => clearSession();
    window.addEventListener('auth:unauthorized', handle);
    return () => window.removeEventListener('auth:unauthorized', handle);
  }, [clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { token: newToken, user: newUser } = await apiClient<{
        token: string;
        user: AuthUser;
      }>('/api/auth/login', { method: 'POST', body: { email, password } });
      saveSession(newToken, newUser);
    },
    [saveSession]
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const { token: newToken, user: newUser } = await apiClient<{
        token: string;
        user: AuthUser;
      }>('/api/auth/register', {
        method: 'POST',
        body: { name, email, password },
      });
      saveSession(newToken, newUser);
    },
    [saveSession]
  );

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout: clearSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
