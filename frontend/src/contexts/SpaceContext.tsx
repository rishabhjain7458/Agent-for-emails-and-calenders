import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getConnectedAccounts } from '../api/endpoints';
import { useAuth } from './AuthContext';
import type { ConnectedAccount } from '../types';

export type SpaceAccount = {
  id: string;
  email: string;
  provider: 'google' | 'microsoft' | 'zoho';
  label: string;
  name?: string;
  isPrimary: boolean;
};

type SpaceContextValue = {
  accounts: ConnectedAccount[];
  spaces: SpaceAccount[];
  activeSpaceId: string;
  activeSpace: SpaceAccount | null;
  isCombined: boolean;
  setActiveSpaceId: (id: string) => void;
  refreshSpaces: () => Promise<void>;
};

const SpaceContext = createContext<SpaceContextValue | null>(null);
const storageKey = 'o-connect-active-space';

export function SpaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [activeSpaceId, setActiveSpaceIdState] = useState(() => localStorage.getItem(storageKey) || 'combined');

  async function refreshSpaces() {
    setAccounts(await getConnectedAccounts());
  }

  useEffect(() => {
    if (user) refreshSpaces();
  }, [user?.id]);

  const spaces = useMemo<SpaceAccount[]>(() => {
    if (!user) return [];
    return [
      { id: 'primary', email: user.email, provider: user.provider ?? 'google', label: `${user.email} (primary)`, name: user.name, isPrimary: true },
      ...accounts.map((account) => ({
        id: account.id,
        email: account.email,
        provider: account.provider,
        label: account.email,
        name: account.name ?? account.email,
        isPrimary: false
      }))
    ];
  }, [accounts, user]);

  const activeSpace = spaces.find((space) => space.id === activeSpaceId) ?? null;
  const isCombined = activeSpaceId === 'combined';

  function setActiveSpaceId(id: string) {
    setActiveSpaceIdState(id);
    localStorage.setItem(storageKey, id);
  }

  const value = useMemo<SpaceContextValue>(() => ({
    accounts,
    spaces,
    activeSpaceId,
    activeSpace,
    isCombined,
    setActiveSpaceId,
    refreshSpaces
  }), [accounts, spaces, activeSpaceId, activeSpace, isCombined]);

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useSpace() {
  const context = useContext(SpaceContext);
  if (!context) throw new Error('useSpace must be used within SpaceProvider');
  return context;
}
