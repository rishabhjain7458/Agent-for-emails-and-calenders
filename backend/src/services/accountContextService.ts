import { getConnectedAccount, listConnectedAccounts } from '../repositories/connectedAccountRepository.js';
import { HttpError } from '../utils/http.js';
import type { AuthUser } from '../types.js';

export type AccountContext = {
  accountId: string;
  provider: 'google' | 'microsoft';
  email: string;
  name?: string | null;
  isPrimary: boolean;
};

export async function listAccountContexts(user: AuthUser): Promise<AccountContext[]> {
  const connected = await listConnectedAccounts(user.tenantId, user.id);
  return [
    {
      accountId: 'primary',
      provider: user.provider,
      email: user.email,
      name: user.name,
      isPrimary: true
    },
    ...connected.map((account) => ({
      accountId: account.id,
      provider: account.provider,
      email: account.email,
      name: account.name,
      isPrimary: false
    }))
  ];
}

export async function resolveAccountContext(user: AuthUser, accountId?: string | null): Promise<AccountContext> {
  if (!accountId || accountId === 'all' || accountId === 'primary') {
    return {
      accountId: 'primary',
      provider: user.provider,
      email: user.email,
      name: user.name,
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
    isPrimary: false
  };
}

export async function resolveMentionedAccount(user: AuthUser, message: string) {
  const accounts = await listAccountContexts(user);
  const normalized = message.toLowerCase();
  return accounts.find((account) => normalized.includes(account.email.toLowerCase()));
}

export function formatAccountChoicePrompt(accounts: AccountContext[], action: string) {
  return [
    `Which account should I use for ${action}?`,
    '',
    'Available accounts:',
    ...accounts.map((account, index) => `${index + 1}. ${account.email} (${account.provider === 'microsoft' ? 'Outlook' : 'Gmail'}${account.isPrimary ? ', primary' : ''})`),
    '',
    'Reply with the email address, for example: Use name@example.com.'
  ].join('\n');
}
