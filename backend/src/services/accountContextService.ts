import { getConnectedAccount, listConnectedAccounts } from '../repositories/connectedAccountRepository.js';
import { HttpError } from '../utils/http.js';
import type { AuthUser } from '../types.js';

export type AccountContext = {
  accountId: string;
  provider: 'google' | 'microsoft' | 'zoho';
  email: string;
  name?: string | null;
  providerAccountId?: string | null;
  isPrimary: boolean;
};

export async function listAccountContexts(user: AuthUser): Promise<AccountContext[]> {
  const connected = await listConnectedAccounts(user.tenantId, user.id);
  const accounts = [
    {
      accountId: 'primary',
      provider: user.provider,
      email: user.email,
      name: user.name,
      providerAccountId: null,
      isPrimary: true
    },
    ...connected
      .filter((account) => account.provider !== user.provider || account.email.toLowerCase() !== user.email.toLowerCase())
      .map((account) => ({
      accountId: account.id,
      provider: account.provider,
      email: account.email,
      name: account.name,
      providerAccountId: account.provider_account_id,
      isPrimary: false
    }))
  ];
  const seen = new Set<string>();
  return accounts.filter((account) => {
    const key = `${account.provider}:${account.email.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function resolveAccountContext(user: AuthUser, accountId?: string | null): Promise<AccountContext> {
  if (!accountId || accountId === 'all' || accountId === 'primary') {
    return {
      accountId: 'primary',
      provider: user.provider,
    email: user.email,
    name: user.name,
    providerAccountId: null,
    isPrimary: true
    };
  }

  const account = await getConnectedAccount(user.tenantId, user.id, accountId);
  if (!account) throw new HttpError(404, 'Connected account not found.');

  return {
    accountId: account.id,
    provider: account.provider,
    email: account.email,
    name: account.name,
    providerAccountId: account.provider_account_id,
    isPrimary: false
  };
}

export async function resolveMentionedAccount(user: AuthUser, message: string) {
  const accounts = await listAccountContexts(user);
  const normalized = message.toLowerCase();
  return accounts.find((account) => normalized.includes(account.email.toLowerCase()));
}

export function resolveAccountSelection(accounts: AccountContext[], message: string) {
  const normalized = message.trim().toLowerCase();
  const numericSelection = normalized.match(/(?:^|\b)(\d+)(?:\b|$)/);
  if (numericSelection) {
    const account = accounts[Number(numericSelection[1]) - 1];
    if (account) return account;
  }

  return accounts.find((account) => normalized.includes(account.email.toLowerCase()));
}

export function formatAccountChoicePrompt(accounts: AccountContext[], action: string) {
  return [
    `Which account should I use for ${action}?`,
    '',
    'Available accounts:',
    ...accounts.map((account, index) => `${index + 1}. ${account.email} (${account.provider === 'microsoft' ? 'Outlook' : account.provider === 'zoho' ? 'Zoho Mail' : 'Gmail'}${account.isPrimary ? ', primary' : ''})`),
    '',
    'Reply with the number or email address, for example: 1 or Use name@example.com.'
  ].join('\n');
}
