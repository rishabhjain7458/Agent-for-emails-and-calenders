export type SocialPlatform = 'instagram' | 'facebook' | 'linkedin' | 'x' | 'threads' | 'reddit';

export const socialPlatformLabels: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  x: 'X',
  threads: 'Threads',
  reddit: 'Reddit'
};

function normalizeHandle(value: string) {
  return value.trim().replace(/^@/, '').replace(/^\/+/, '').replace(/^u\//i, '');
}

export function normalizeSocialUrl(platform: SocialPlatform, value: string) {
  const input = value.trim();
  if (/^https?:\/\//i.test(input)) return input;
  const handle = normalizeHandle(input);
  if (!handle) return '';
  if (platform === 'instagram') return `https://www.instagram.com/${handle}`;
  if (platform === 'facebook') return `https://www.facebook.com/${handle}`;
  if (platform === 'linkedin') return `https://www.linkedin.com/in/${handle}`;
  if (platform === 'x') return `https://x.com/${handle}`;
  if (platform === 'threads') return `https://www.threads.net/@${handle}`;
  return `https://www.reddit.com/user/${handle}`;
}
