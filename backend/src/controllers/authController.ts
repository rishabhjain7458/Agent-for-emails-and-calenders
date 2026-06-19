import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getGoogleAuthUrl, exchangeCode, redirectWithSession } from '../services/googleAuthService.js';
import { exchangeMicrosoftCode, getMicrosoftAuthUrl, redirectWithMicrosoftSession } from '../services/microsoftAuthService.js';
import { exchangeZohoCode, getZohoAuthUrl, redirectWithZohoSession } from '../services/zohoAuthService.js';
import { upsertGoogleUser, upsertMicrosoftUser, upsertZohoUser } from '../repositories/userRepository.js';
import { ensureDefaultTenant } from '../repositories/tenantRepository.js';
import { signSession } from '../middleware/auth.js';
import { deleteConnectedAccount, listConnectedAccounts, upsertConnectedAccount } from '../repositories/connectedAccountRepository.js';
import { createDashboardCard } from '../repositories/dashboardCardRepository.js';
import { upsertSocialConnection, type SocialPlatform } from '../repositories/socialConnectionRepository.js';
import { exchangeSocialCode, getSocialAuthUrl, socialCodeVerifier, socialTokenExpiry, supportedSocialPlatform } from '../services/socialAuthService.js';
import { env } from '../config/env.js';
import { HttpError, send } from '../utils/http.js';
import type { AuthUser } from '../types.js';

type ImapConnectionInput = {
  email: string;
  password: string;
  name?: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
};

type ConnectState = {
  mode: 'connect';
  provider: 'google' | 'microsoft' | 'zoho';
  user: AuthUser;
  mobile?: boolean;
};

type LoginState = {
  mode: 'login';
  provider: 'google' | 'microsoft' | 'zoho';
  mobile?: boolean;
};

type OAuthState = ConnectState | LoginState;

type SocialConnectState = {
  mode: 'social-connect';
  provider: SocialPlatform;
  user: AuthUser;
  mobile?: boolean;
  codeVerifier?: string;
};

function isMobileRequest(req: Request) {
  return req.query.mobile === '1' || req.query.platform === 'mobile';
}

function signConnectState(user: AuthUser, provider: 'google' | 'microsoft' | 'zoho', mobile = false) {
  return jwt.sign({ mode: 'connect', provider, user, mobile }, env.JWT_SECRET, { expiresIn: '10m' });
}

function signLoginState(provider: 'google' | 'microsoft' | 'zoho', mobile = false) {
  return jwt.sign({ mode: 'login', provider, mobile }, env.JWT_SECRET, { expiresIn: '10m' });
}

function signSocialConnectState(user: AuthUser, provider: SocialPlatform, mobile = false, codeVerifier?: string) {
  return jwt.sign({ mode: 'social-connect', provider, user, mobile, codeVerifier }, env.JWT_SECRET, { expiresIn: '10m' });
}

function readOAuthState(value: unknown, provider: 'google' | 'microsoft' | 'zoho') {
  if (!value) return null;
  try {
    const state = jwt.verify(String(value), env.JWT_SECRET) as OAuthState;
    return state.provider === provider ? state : null;
  } catch {
    return null;
  }
}

function readConnectState(value: unknown, provider: 'google' | 'microsoft' | 'zoho') {
  const state = readOAuthState(value, provider);
  return state?.mode === 'connect' ? state : null;
}

function readSocialConnectState(value: unknown, provider: SocialPlatform) {
  if (!value) return null;
  try {
    const state = jwt.verify(String(value), env.JWT_SECRET) as SocialConnectState;
    return state.mode === 'social-connect' && state.provider === provider ? state : null;
  } catch {
    return null;
  }
}

function isMobileState(value: unknown, provider: 'google' | 'microsoft' | 'zoho') {
  return Boolean(readOAuthState(value, provider)?.mobile);
}

function redirectAfterConnect(provider: 'google' | 'microsoft' | 'zoho', mobile = false) {
  const baseUrl = mobile ? env.MOBILE_APP_URL : env.FRONTEND_URL;
  return `${baseUrl}/settings?connected=${provider}`;
}

function redirectAfterSocialConnect(provider: SocialPlatform, mobile = false) {
  const baseUrl = mobile ? env.MOBILE_APP_URL : env.FRONTEND_URL;
  return `${baseUrl}/settings?connected=${provider}`;
}

function isPrimaryAccount(user: AuthUser, provider: 'google' | 'microsoft' | 'zoho', email: string) {
  return user.provider === provider && user.email.toLowerCase() === email.toLowerCase();
}

function visibleConnectedAccounts(user: AuthUser, accounts: any[]) {
  const seen = new Set<string>();
  return accounts.filter((account) => {
    if (isPrimaryAccount(user, account.provider, account.email)) return false;
    const key = `${account.provider}:${account.email.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function imapConfig(input: ImapConnectionInput) {
  return {
    imapHost: input.imapHost || 'imappro.zoho.in',
    imapPort: Number(input.imapPort ?? 993),
    imapSecure: input.imapSecure ?? true,
    smtpHost: input.smtpHost || 'smtp.zoho.in',
    smtpPort: Number(input.smtpPort ?? 465),
    smtpSecure: input.smtpSecure ?? true
  };
}

export function googleLogin(req: Request, res: Response) {
  const mobile = isMobileRequest(req);
  res.redirect(getGoogleAuthUrl(mobile ? signLoginState('google', true) : undefined));
}

export function googleConnect(req: Request, res: Response) {
  send(res, { url: getGoogleAuthUrl(signConnectState(req.user!, 'google', isMobileRequest(req))) });
}

export async function googleCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { profile, tokens } = await exchangeCode(String(req.query.code ?? ''));
    const connectState = readConnectState(req.query.state, 'google');
    if (connectState) {
      if (isPrimaryAccount(connectState.user, 'google', profile.email!)) {
        res.redirect(redirectAfterConnect('google', connectState.mobile));
        return;
      }
      await upsertConnectedAccount({
        tenantId: connectState.user.tenantId,
        userId: connectState.user.id,
        provider: 'google',
        providerAccountId: profile.id!,
        email: profile.email!,
        name: profile.name!,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null
      });
      res.redirect(redirectAfterConnect('google', connectState.mobile));
      return;
    }

    const user = await upsertGoogleUser({
      googleId: profile.id!,
      email: profile.email!,
      name: profile.name!,
      avatarUrl: profile.picture,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null
    });
    const tenant = await ensureDefaultTenant(user.id, user.email);
    const token = signSession({ id: user.id, tenantId: tenant.id, email: user.email, name: user.name, role: tenant.role, provider: 'google' });
    res.redirect(redirectWithSession(token, isMobileState(req.query.state, 'google')));
  } catch (error) {
    next(error);
  }
}

export function microsoftLogin(req: Request, res: Response) {
  const mobile = isMobileRequest(req);
  res.redirect(getMicrosoftAuthUrl(mobile ? signLoginState('microsoft', true) : undefined));
}

export function microsoftConnect(req: Request, res: Response) {
  send(res, { url: getMicrosoftAuthUrl(signConnectState(req.user!, 'microsoft', isMobileRequest(req))) });
}

export async function microsoftCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { profile, tokens } = await exchangeMicrosoftCode(String(req.query.code ?? ''));
    const connectState = readConnectState(req.query.state, 'microsoft');
    if (connectState) {
      if (isPrimaryAccount(connectState.user, 'microsoft', profile.email)) {
        res.redirect(redirectAfterConnect('microsoft', connectState.mobile));
        return;
      }
      await upsertConnectedAccount({
        tenantId: connectState.user.tenantId,
        userId: connectState.user.id,
        provider: 'microsoft',
        providerAccountId: profile.id,
        email: profile.email,
        name: profile.name,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: tokens.expiry
      });
      res.redirect(redirectAfterConnect('microsoft', connectState.mobile));
      return;
    }

    const user = await upsertMicrosoftUser({
      microsoftId: profile.id,
      email: profile.email,
      name: profile.name,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiry: tokens.expiry
    });
    const tenant = await ensureDefaultTenant(user.id, user.email);
    const token = signSession({ id: user.id, tenantId: tenant.id, email: user.email, name: user.name, role: tenant.role, provider: 'microsoft' });
    res.redirect(redirectWithMicrosoftSession(token, isMobileState(req.query.state, 'microsoft')));
  } catch (error) {
    next(error);
  }
}

export function zohoLogin(req: Request, res: Response) {
  const mobile = isMobileRequest(req);
  res.redirect(getZohoAuthUrl(mobile ? signLoginState('zoho', true) : undefined));
}

export function zohoConnect(req: Request, res: Response) {
  send(res, { url: getZohoAuthUrl(signConnectState(req.user!, 'zoho', isMobileRequest(req))) });
}

export async function zohoCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { profile, tokens } = await exchangeZohoCode(String(req.query.code ?? ''));
    const connectState = readConnectState(req.query.state, 'zoho');
    if (connectState) {
      if (isPrimaryAccount(connectState.user, 'zoho', profile.email)) {
        res.redirect(redirectAfterConnect('zoho', connectState.mobile));
        return;
      }
      await upsertConnectedAccount({
        tenantId: connectState.user.tenantId,
        userId: connectState.user.id,
        provider: 'zoho',
        providerAccountId: profile.id,
        email: profile.email,
        name: profile.name,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: tokens.expiry
      });
      res.redirect(redirectAfterConnect('zoho', connectState.mobile));
      return;
    }

    const user = await upsertZohoUser({
      zohoId: profile.id,
      email: profile.email,
      name: profile.name,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiry: tokens.expiry
    });
    const tenant = await ensureDefaultTenant(user.id, user.email);
    const token = signSession({ id: user.id, tenantId: tenant.id, email: user.email, name: user.name, role: tenant.role, provider: 'zoho' });
    res.redirect(redirectWithZohoSession(token, isMobileState(req.query.state, 'zoho')));
  } catch (error) {
    next(error);
  }
}

export function me(req: Request, res: Response) {
  send(res, req.user);
}

export async function connectedAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    send(res, visibleConnectedAccounts(req.user!, await listConnectedAccounts(req.user!.tenantId, req.user!.id)));
  } catch (error) {
    next(error);
  }
}

export async function connectImapAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as ImapConnectionInput;
    const email = input.email.trim().toLowerCase();
    const account = await upsertConnectedAccount({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      provider: 'imap',
      providerAccountId: email,
      email,
      name: input.name?.trim() || email,
      accessToken: JSON.stringify(imapConfig(input)),
      refreshToken: input.password,
      tokenExpiry: null
    });
    send(res, account, 201);
  } catch (error) {
    next(error);
  }
}

export function socialConnect(req: Request, res: Response, next: NextFunction) {
  try {
    const platform = String(req.params.platform ?? '');
    if (!supportedSocialPlatform(platform)) throw new HttpError(404, 'Unsupported social platform.');
    const verifier = platform === 'x' ? socialCodeVerifier() : undefined;
    const state = signSocialConnectState(req.user!, platform, isMobileRequest(req), verifier);
    send(res, { url: getSocialAuthUrl(platform, state, verifier) });
  } catch (error) {
    next(error);
  }
}

export async function socialCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const platform = String(req.params.platform ?? '');
    if (!supportedSocialPlatform(platform)) throw new HttpError(404, 'Unsupported social platform.');
    const connectState = readSocialConnectState(req.query.state, platform);
    if (!connectState) throw new HttpError(401, 'Social connect session expired. Please try again.');
    const { tokens, profile } = await exchangeSocialCode(platform, String(req.query.code ?? ''), connectState.codeVerifier);
    const connection = await upsertSocialConnection({
      tenantId: connectState.user.tenantId,
      userId: connectState.user.id,
      platform,
      providerAccountId: profile.providerAccountId,
      username: profile.username,
      displayName: profile.displayName,
      profileUrl: profile.profileUrl,
      avatarUrl: profile.avatarUrl,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiry: socialTokenExpiry(tokens)
    });
    await createDashboardCard(connectState.user.tenantId, connectState.user.id, {
      cardType: 'social',
      platform,
      label: profile.displayName,
      url: profile.profileUrl,
      metadata: {
        imageUrl: profile.avatarUrl,
        socialConnectionId: connection.id,
        providerAccountId: profile.providerAccountId,
        connectedViaOAuth: true
      }
    });
    res.redirect(redirectAfterSocialConnect(platform, connectState.mobile));
  } catch (error) {
    next(error);
  }
}

export async function disconnectAccount(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteConnectedAccount(req.user!.tenantId, req.user!.id, req.params.id);
    send(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}
