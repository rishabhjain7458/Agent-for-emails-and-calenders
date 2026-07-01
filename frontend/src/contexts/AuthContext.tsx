import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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

function getLoginErrorMessage(caught: unknown) {
  if (caught instanceof Error && caught.message === 'Network Error') {
    return 'Could not reach the API from the app. Check the backend URL and mobile CORS origins.';
  }
  return caught instanceof Error ? caught.message : 'Mobile login could not create a session.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isNative = Capacitor.isNativePlatform();
  const handledNativeUrls = useRef(new Set<string>());

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

  const completeNativeLogin = useCallback(async (token: string) => {
    localStorage.setItem('sessionToken', token);
    setLoading(true);
    try {
      const nextUser = await getMe();
      setUser(nextUser);
      await Browser.close().catch(() => undefined);
      window.location.replace('/dashboard');
    } catch (caught) {
      localStorage.removeItem('sessionToken');
      setUser(null);
      await Browser.close().catch(() => undefined);
      const message = getLoginErrorMessage(caught);
      window.location.replace(`/login?auth_error=${encodeURIComponent(message)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleNativeCallbackUrl = useCallback(async (url: string) => {
    if (handledNativeUrls.current.has(url)) return;
    handledNativeUrls.current.add(url);

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      await Browser.close().catch(() => undefined);
      window.location.replace('/login?auth_error=Invalid%20mobile%20login%20callback');
      return;
    }
    if (parsed.protocol !== 'oconnect:') return;

    const path = parsed.hostname === 'app' ? parsed.pathname : `/${parsed.hostname}${parsed.pathname}`;
    const search = parsed.search;
    const token = parsed.searchParams.get('token');
    const error = parsed.searchParams.get('error') || parsed.searchParams.get('auth_error');

    if (token) {
      await completeNativeLogin(token);
      return;
    }

    await Browser.close().catch(() => undefined);
    if (error) {
      window.location.replace(`/login?auth_error=${encodeURIComponent(error)}`);
      return;
    }
    window.location.replace(`${path || '/dashboard'}${search}`);
  }, [completeNativeLogin]);

  useEffect(() => {
    if (!isNative) return;

    App.getLaunchUrl().then((launch) => {
      if (launch?.url) handleNativeCallbackUrl(launch.url);
    }).catch(() => undefined);

    const listener = App.addListener('appUrlOpen', ({ url }) => {
      handleNativeCallbackUrl(url);
    });

    return () => {
      listener.then((handle) => handle.remove());
    };
  }, [handleNativeCallbackUrl, isNative]);

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
