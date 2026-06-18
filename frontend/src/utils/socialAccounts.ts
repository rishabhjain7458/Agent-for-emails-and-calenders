export type SocialPlatform = 'instagram' | 'facebook';

export type SocialAccount = {
  id: string;
  platform: SocialPlatform;
  label: string;
  url: string;
};

const storageKey = 'o-connect-social-accounts';

function normalizeHandle(value: string) {
  return value.trim().replace(/^@/, '').replace(/^\/+/, '');
}

export function normalizeSocialUrl(platform: SocialPlatform, value: string) {
  const input = value.trim();
  if (/^https?:\/\//i.test(input)) return input;
  const handle = normalizeHandle(input);
  if (!handle) return '';
  return platform === 'instagram'
    ? `https://www.instagram.com/${handle}`
    : `https://www.facebook.com/${handle}`;
}

export function loadSocialAccounts(): SocialAccount[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSocialAccounts(accounts: SocialAccount[]) {
  localStorage.setItem(storageKey, JSON.stringify(accounts));
}
