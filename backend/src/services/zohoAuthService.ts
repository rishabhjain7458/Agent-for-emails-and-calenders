import axios from 'axios';
import { env } from '../config/env.js';
import { getConnectedAccount, updateConnectedAccountTokens } from '../repositories/connectedAccountRepository.js';
import { getUserById, updateUserTokens } from '../repositories/userRepository.js';
import { decrypt } from '../utils/crypto.js';
import { HttpError } from '../utils/http.js';

export const zohoScopes = [
  'ZohoMail.accounts.READ',
  'ZohoMail.folders.READ',
  'ZohoMail.messages.ALL'
];

type ZohoTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

export type ZohoMailAccount = {
  accountId: string;
  primaryEmailAddress?: string;
  emailAddress?: string;
  displayName?: string;
  accountDisplayName?: string;
};

function authorizeUrl() {
  return `${env.ZOHO_ACCOUNTS_URL.replace(/\/$/, '')}/oauth/v2/auth`;
}

function tokenUrl() {
  return `${env.ZOHO_ACCOUNTS_URL.replace(/\/$/, '')}/oauth/v2/token`;
}

export function getZohoAuthUrl(state?: string) {
  const params = new URLSearchParams({
    client_id: env.ZOHO_CLIENT_ID,
    response_type: 'code',
    redirect_uri: env.ZOHO_REDIRECT_URI,
    scope: zohoScopes.join(','),
    access_type: 'offline',
    prompt: 'consent'
  });
  if (state) params.set('state', state);
  return `${authorizeUrl()}?${params.toString()}`;
}

async function requestToken(params: Record<string, string>) {
  const body = new URLSearchParams({
    client_id: env.ZOHO_CLIENT_ID,
    client_secret: env.ZOHO_CLIENT_SECRET,
    redirect_uri: env.ZOHO_REDIRECT_URI,
    ...params
  });
  const { data } = await axios.post<ZohoTokenResponse>(tokenUrl(), body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return data;
}

async function fetchPrimaryMailAccount(accessToken: string) {
  const { data } = await axios.get<{ data?: ZohoMailAccount[] }>(`${env.ZOHO_MAIL_API_URL.replace(/\/$/, '')}/api/accounts`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
  });
  const account = data.data?.[0];
  const email = account?.primaryEmailAddress ?? account?.emailAddress;
  if (!account?.accountId || !email) throw new HttpError(400, 'Zoho Mail account is incomplete');
  return {
    id: String(account.accountId),
    email,
    name: account.displayName ?? account.accountDisplayName ?? email
  };
}

export async function exchangeZohoCode(code: string) {
  const tokens = await requestToken({
    code,
    grant_type: 'authorization_code'
  });
  const profile = await fetchPrimaryMailAccount(tokens.access_token);
  return {
    profile,
    tokens: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null
    }
  };
}

export async function getZohoAccessToken(userId: string) {
  const user = await getUserById(userId);
  if (!user) throw new HttpError(401, 'User not found');

  const accessToken = decrypt(user.access_token);
  const refreshToken = decrypt(user.refresh_token);
  const expiresAt = user.token_expiry ? new Date(user.token_expiry).getTime() : 0;

  if (accessToken && expiresAt > Date.now() + 60_000) return accessToken;
  if (!refreshToken) throw new HttpError(401, 'Zoho refresh token is missing. Please sign in again.');

  const refreshed = await requestToken({
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  const expiry = refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null;
  await updateUserTokens(userId, refreshed.access_token, refreshed.refresh_token ?? refreshToken, expiry);
  return refreshed.access_token;
}

export async function getZohoAccessTokenForConnectedAccount(tenantId: string, userId: string, accountId: string) {
  const account = await getConnectedAccount(tenantId, userId, accountId);
  if (!account || account.provider !== 'zoho') throw new HttpError(404, 'Connected Zoho Mail account not found');

  const accessToken = decrypt(account.access_token);
  const refreshToken = decrypt(account.refresh_token);
  const expiresAt = account.token_expiry ? new Date(account.token_expiry).getTime() : 0;

  if (accessToken && expiresAt > Date.now() + 60_000) return accessToken;
  if (!refreshToken) throw new HttpError(401, 'Zoho refresh token is missing. Reconnect this account.');

  const refreshed = await requestToken({
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  const expiry = refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null;
  await updateConnectedAccountTokens(account.id, refreshed.access_token, refreshed.refresh_token ?? refreshToken, expiry);
  return refreshed.access_token;
}

export function redirectWithZohoSession(token: string, mobile = false) {
  const baseUrl = mobile ? env.MOBILE_APP_URL : env.FRONTEND_URL;
  return `${baseUrl}/auth/callback?token=${encodeURIComponent(token)}`;
}
