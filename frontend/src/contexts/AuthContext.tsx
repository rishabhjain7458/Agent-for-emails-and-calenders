import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { getMe } from '../api/endpoints';
import type { User } from '../types';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (provider?: 'google' | 'microsoft' | 'zoho') => void;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isNative = Capacitor.isNativePlatform();

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

  useEffect(() => {
    if (!isNative) return;

    const listener = App.addListener('appUrlOpen', async ({ url }) => {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        await Browser.close().catch(() => undefined);
        window.location.href = '/login?auth_error=Invalid%20mobile%20login%20callback';
        return;
      }
      if (parsed.protocol !== 'oconnect:') return;

      const path = parsed.hostname === 'app' ? parsed.pathname : `/${parsed.hostname}${parsed.pathname}`;
      const search = parsed.search;
      const token = parsed.searchParams.get('token');
      const error = parsed.searchParams.get('error') || parsed.searchParams.get('auth_error');

      if (token) {
        localStorage.setItem('sessionToken', token);
        await Browser.close().catch(() => undefined);
        await refresh();
        window.location.href = '/dashboard';
        return;
      }

      await Browser.close().catch(() => undefined);
      if (error) {
        window.location.href = `/login?auth_error=${encodeURIComponent(error)}`;
        return;
      }
      window.location.href = `${path || '/dashboard'}${search}`;
    });

    return () => {
      listener.then((handle) => handle.remove());
    };
  }, [isNative, refresh]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    refresh,
    login: (provider = 'google') => {
      const url = `${import.meta.env.VITE_API_URL ?? '/api'}/auth/${provider}${isNative ? '?mobile=1' : ''}`;
      if (isNative) {
        Browser.open({ url });
        return;
      }
      window.location.href = url;
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
