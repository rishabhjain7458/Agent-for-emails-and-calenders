import axios from 'axios';
import { env } from '../config/env.js';
import { decrypt } from '../utils/crypto.js';
import { getUserById, updateUserTokens } from '../repositories/userRepository.js';
import { getConnectedAccount, updateConnectedAccountTokens } from '../repositories/connectedAccountRepository.js';
import { HttpError } from '../utils/http.js';

const tenant = 'common';
const authorizeUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`;
const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

export const microsoftScopes = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'User.Read',
  'Mail.ReadWrite',
  'Mail.Send',
  'Calendars.ReadWrite',
  'Tasks.ReadWrite'
];

type MicrosoftTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

type MicrosoftProfile = {
  id: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
};

export function getMicrosoftAuthUrl(state?: string) {
  const params = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: env.MICROSOFT_REDIRECT_URI,
    response_mode: 'query',
    scope: microsoftScopes.join(' ')
  });
  if (state) params.set('state', state);
  return `${authorizeUrl}?${params.toString()}`;
}

async function requestToken(params: Record<string, string>) {
  const body = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID,
    client_secret: env.MICROSOFT_CLIENT_SECRET,
    redirect_uri: env.MICROSOFT_REDIRECT_URI,
    ...params
  });
  const { data } = await axios.post<MicrosoftTokenResponse>(tokenUrl, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return data;
}

export async function exchangeMicrosoftCode(code: string) {
  const tokens = await requestToken({
    code,
    grant_type: 'authorization_code',
    scope: microsoftScopes.join(' ')
  });
  const { data: profile } = await axios.get<MicrosoftProfile>('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
  const email = profile.mail ?? profile.userPrincipalName;
  if (!profile.id || !email) throw new HttpError(400, 'Microsoft profile is incomplete');
  return {
    profile: {
      id: profile.id,
      email,
      name: profile.displayName ?? email
    },
    tokens: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null
    }
  };
}

export async function getMicrosoftAccessToken(userId: string) {
  const user = await getUserById(userId);
  if (!user) throw new HttpError(401, 'User not found');

  const accessToken = decrypt(user.access_token);
  const refreshToken = decrypt(user.refresh_token);
  const expiresAt = user.token_expiry ? new Date(user.token_expiry).getTime() : 0;

  if (accessToken && expiresAt > Date.now() + 60_000) return accessToken;
  if (!refreshToken) throw new HttpError(401, 'Microsoft refresh token is missing. Please sign in again.');

  const refreshed = await requestToken({
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: microsoftScopes.join(' ')
  });
  const expiry = refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null;
  await updateUserTokens(userId, refreshed.access_token, refreshed.refresh_token ?? refreshToken, expiry);
  return refreshed.access_token;
}

export async function getMicrosoftAccessTokenForConnectedAccount(tenantId: string, userId: string, accountId: string) {
  const account = await getConnectedAccount(tenantId, userId, accountId);
  if (!account || account.provider !== 'microsoft') throw new HttpError(404, 'Connected Outlook account not found');

  const accessToken = decrypt(account.access_token);
  const refreshToken = decrypt(account.refresh_token);
  const expiresAt = account.token_expiry ? new Date(account.token_expiry).getTime() : 0;

  if (accessToken && expiresAt > Date.now() + 60_000) return accessToken;
  if (!refreshToken) throw new HttpError(401, 'Microsoft refresh token is missing. Reconnect this account.');

  const refreshed = await requestToken({
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: microsoftScopes.join(' ')
  });
  const expiry = refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null;
  await updateConnectedAccountTokens(account.id, refreshed.access_token, refreshed.refresh_token ?? refreshToken, expiry);
  return refreshed.access_token;
}

export function redirectWithMicrosoftSession(token: string, mobile = false) {
  const baseUrl = mobile ? env.MOBILE_APP_URL : env.FRONTEND_URL;
  return `${baseUrl}/auth/callback?token=${encodeURIComponent(token)}`;
}
