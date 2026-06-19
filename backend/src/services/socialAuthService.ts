import crypto from 'node:crypto';
import axios from 'axios';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http.js';
import type { SocialPlatform } from '../repositories/socialConnectionRepository.js';

type ProviderConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type SocialTokens = {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
};

export type SocialProfile = {
  providerAccountId: string;
  username?: string | null;
  displayName: string;
  profileUrl: string;
  avatarUrl?: string | null;
};

const platformLabels: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  x: 'X',
  reddit: 'Reddit'
};

function configFor(platform: SocialPlatform, redirectUri?: string): ProviderConfig {
  const configs: Record<SocialPlatform, ProviderConfig> = {
    facebook: { clientId: env.FACEBOOK_CLIENT_ID, clientSecret: env.FACEBOOK_CLIENT_SECRET, redirectUri: env.FACEBOOK_REDIRECT_URI },
    instagram: { clientId: env.INSTAGRAM_CLIENT_ID, clientSecret: env.INSTAGRAM_CLIENT_SECRET, redirectUri: env.INSTAGRAM_REDIRECT_URI },
    linkedin: { clientId: env.LINKEDIN_CLIENT_ID, clientSecret: env.LINKEDIN_CLIENT_SECRET, redirectUri: env.LINKEDIN_REDIRECT_URI },
    x: { clientId: env.X_CLIENT_ID, clientSecret: env.X_CLIENT_SECRET, redirectUri: env.X_REDIRECT_URI },
    reddit: { clientId: env.REDDIT_CLIENT_ID, clientSecret: env.REDDIT_CLIENT_SECRET, redirectUri: env.REDDIT_REDIRECT_URI }
  };
  const config = configs[platform];
  if (!config.clientId || !config.clientSecret) {
    throw new HttpError(400, `${platformLabels[platform]} OAuth is not configured. Add ${platform.toUpperCase()}_CLIENT_ID and ${platform.toUpperCase()}_CLIENT_SECRET.`);
  }
  return { ...config, redirectUri: redirectUri || config.redirectUri };
}

export function supportedSocialPlatform(value: string): value is SocialPlatform {
  return ['facebook', 'instagram', 'linkedin', 'x', 'reddit'].includes(value);
}

export function socialCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function codeChallenge(verifier: string) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function getSocialAuthUrl(platform: SocialPlatform, state: string, codeVerifier?: string, redirectUri?: string) {
  const config = configFor(platform, redirectUri);
  if (platform === 'facebook') {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'public_profile',
      state
    });
    return `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`;
  }
  if (platform === 'instagram') {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'instagram_business_basic',
      state
    });
    return `https://api.instagram.com/oauth/authorize?${params.toString()}`;
  }
  if (platform === 'linkedin') {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'openid profile',
      state
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }
  if (platform === 'x') {
    if (!codeVerifier) throw new HttpError(400, 'X OAuth needs a code verifier.');
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'users.read tweet.read offline.access',
      state,
      code_challenge: codeChallenge(codeVerifier),
      code_challenge_method: 'S256'
    });
    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  }
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    duration: 'permanent',
    scope: 'identity',
    state
  });
  return `https://www.reddit.com/api/v1/authorize?${params.toString()}`;
}

function tokenExpiry(tokens: SocialTokens) {
  return tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : null;
}

export function socialTokenExpiry(tokens: SocialTokens) {
  return tokenExpiry(tokens);
}

export async function exchangeSocialCode(platform: SocialPlatform, code: string, codeVerifier?: string, redirectUri?: string): Promise<{ tokens: SocialTokens; profile: SocialProfile }> {
  const config = configFor(platform, redirectUri);
  let tokens: SocialTokens;

  if (platform === 'facebook') {
    const { data } = await axios.get('https://graph.facebook.com/v20.0/oauth/access_token', {
      params: { client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, code }
    });
    tokens = { accessToken: data.access_token, expiresIn: data.expires_in };
    const profile = await facebookProfile(tokens.accessToken);
    return { tokens, profile };
  }

  if (platform === 'instagram') {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
      code
    });
    const { data } = await axios.post('https://api.instagram.com/oauth/access_token', body);
    tokens = { accessToken: data.access_token };
    const profile = await instagramProfile(tokens.accessToken, data.user_id);
    return { tokens, profile };
  }

  if (platform === 'linkedin') {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret
    });
    const { data } = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', body);
    tokens = { accessToken: data.access_token, expiresIn: data.expires_in };
    const profile = await linkedinProfile(tokens.accessToken);
    return { tokens, profile };
  }

  if (platform === 'x') {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier ?? ''
    });
    const { data } = await axios.post('https://api.twitter.com/2/oauth2/token', body, {
      auth: { username: config.clientId, password: config.clientSecret },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    tokens = { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
    const profile = await xProfile(tokens.accessToken);
    return { tokens, profile };
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri
  });
  const { data } = await axios.post('https://www.reddit.com/api/v1/access_token', body, {
    auth: { username: config.clientId, password: config.clientSecret },
    headers: { 'User-Agent': 'O-Connect/1.0' }
  });
  tokens = { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
  const profile = await redditProfile(tokens.accessToken);
  return { tokens, profile };
}

async function facebookProfile(accessToken: string): Promise<SocialProfile> {
  const { data } = await axios.get('https://graph.facebook.com/v20.0/me', {
    params: { fields: 'id,name,picture.type(large)', access_token: accessToken }
  });
  return {
    providerAccountId: data.id,
    displayName: data.name,
    profileUrl: 'https://www.facebook.com/me',
    avatarUrl: data.picture?.data?.url
  };
}

async function instagramProfile(accessToken: string, userId?: string): Promise<SocialProfile> {
  const { data } = await axios.get('https://graph.instagram.com/v20.0/me', {
    params: { fields: 'id,user_id,username,name,profile_picture_url,account_type', access_token: accessToken }
  });
  const username = data.username ?? data.name;
  return {
    providerAccountId: String(data.id ?? data.user_id ?? userId),
    username,
    displayName: username ? `@${username}` : 'Instagram profile',
    profileUrl: username ? `https://www.instagram.com/${username}` : 'https://www.instagram.com',
    avatarUrl: data.profile_picture_url
  };
}

async function linkedinProfile(accessToken: string): Promise<SocialProfile> {
  const { data } = await axios.get('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return {
    providerAccountId: data.sub,
    displayName: data.name,
    profileUrl: data.profile ?? 'https://www.linkedin.com/feed/',
    avatarUrl: data.picture
  };
}

async function xProfile(accessToken: string): Promise<SocialProfile> {
  const { data } = await axios.get('https://api.twitter.com/2/users/me', {
    params: { 'user.fields': 'profile_image_url,username,name' },
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return {
    providerAccountId: data.data.id,
    username: data.data.username,
    displayName: data.data.name ?? `@${data.data.username}`,
    profileUrl: `https://x.com/${data.data.username}`,
    avatarUrl: data.data.profile_image_url
  };
}

async function redditProfile(accessToken: string): Promise<SocialProfile> {
  const { data } = await axios.get('https://oauth.reddit.com/api/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'O-Connect/1.0' }
  });
  return {
    providerAccountId: data.id,
    username: data.name,
    displayName: `u/${data.name}`,
    profileUrl: `https://www.reddit.com/user/${data.name}`,
    avatarUrl: data.icon_img?.split('?')[0]
  };
}
