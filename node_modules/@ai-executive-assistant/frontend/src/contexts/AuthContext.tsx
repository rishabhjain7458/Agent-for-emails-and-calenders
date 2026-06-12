import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getMe } from '../api/endpoints';
import type { User } from '../types';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (provider?: 'google' | 'microsoft') => void;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('sessionToken');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await getMe());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    refresh,
    login: (provider = 'google') => {
      window.location.href = `${import.meta.env.VITE_API_URL ?? '/api'}/auth/${provider}`;
    },
    logout: () => {
      localStorage.removeItem('sessionToken');
      setUser(null);
      window.location.href = '/login';
    }
  }), [user, loading, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
