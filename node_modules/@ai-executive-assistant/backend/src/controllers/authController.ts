import type { Request, Response, NextFunction } from 'express';
import { getGoogleAuthUrl, exchangeCode, redirectWithSession } from '../services/googleAuthService.js';
import { exchangeMicrosoftCode, getMicrosoftAuthUrl, redirectWithMicrosoftSession } from '../services/microsoftAuthService.js';
import { upsertGoogleUser, upsertMicrosoftUser } from '../repositories/userRepository.js';
import { ensureDefaultTenant } from '../repositories/tenantRepository.js';
import { signSession } from '../middleware/auth.js';
import { send } from '../utils/http.js';

export function googleLogin(_req: Request, res: Response) {
  res.redirect(getGoogleAuthUrl());
}

export async function googleCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { profile, tokens } = await exchangeCode(String(req.query.code ?? ''));
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

export async function microsoftCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { profile, tokens } = await exchangeMicrosoftCode(String(req.query.code ?? ''));
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
