import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getGoogleAuthUrl, exchangeCode, redirectWithSession } from '../services/googleAuthService.js';
import { exchangeMicrosoftCode, getMicrosoftAuthUrl, redirectWithMicrosoftSession } from '../services/microsoftAuthService.js';
import { upsertGoogleUser, upsertMicrosoftUser } from '../repositories/userRepository.js';
import { ensureDefaultTenant } from '../repositories/tenantRepository.js';
import { signSession } from '../middleware/auth.js';
import { deleteConnectedAccount, listConnectedAccounts, upsertConnectedAccount } from '../repositories/connectedAccountRepository.js';
import { env } from '../config/env.js';
import { send } from '../utils/http.js';
import type { AuthUser } from '../types.js';

type ConnectState = {
  mode: 'connect';
  provider: 'google' | 'microsoft';
  user: AuthUser;
};

function signConnectState(user: AuthUser, provider: 'google' | 'microsoft') {
  return jwt.sign({ mode: 'connect', provider, user }, env.JWT_SECRET, { expiresIn: '10m' });
}

function readConnectState(value: unknown, provider: 'google' | 'microsoft') {
  if (!value) return null;
  try {
    const state = jwt.verify(String(value), env.JWT_SECRET) as ConnectState;
    return state.mode === 'connect' && state.provider === provider ? state : null;
  } catch {
    return null;
  }
}

function redirectAfterConnect(provider: 'google' | 'microsoft') {
  return `${env.FRONTEND_URL}/settings?connected=${provider}`;
}

export function googleLogin(_req: Request, res: Response) {
  res.redirect(getGoogleAuthUrl());
}

export function googleConnect(req: Request, res: Response) {
  send(res, { url: getGoogleAuthUrl(signConnectState(req.user!, 'google')) });
}

export async function googleCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { profile, tokens } = await exchangeCode(String(req.query.code ?? ''));
    const connectState = readConnectState(req.query.state, 'google');
    if (connectState) {
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
      res.redirect(redirectAfterConnect('google'));
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
    res.redirect(redirectWithSession(token));
  } catch (error) {
    next(error);
  }
}

export function microsoftLogin(_req: Request, res: Response) {
  res.redirect(getMicrosoftAuthUrl());
}

export function microsoftConnect(req: Request, res: Response) {
  send(res, { url: getMicrosoftAuthUrl(signConnectState(req.user!, 'microsoft')) });
}

export async function microsoftCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { profile, tokens } = await exchangeMicrosoftCode(String(req.query.code ?? ''));
    const connectState = readConnectState(req.query.state, 'microsoft');
    if (connectState) {
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
      res.redirect(redirectAfterConnect('microsoft'));
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
    res.redirect(redirectWithMicrosoftSession(token));
  } catch (error) {
    next(error);
  }
}

export function me(req: Request, res: Response) {
  send(res, req.user);
}

export async function connectedAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    send(res, await listConnectedAccounts(req.user!.tenantId, req.user!.id));
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
