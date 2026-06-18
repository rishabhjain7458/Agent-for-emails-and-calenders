export type SocialPlatform = 'instagram' | 'facebook';

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
