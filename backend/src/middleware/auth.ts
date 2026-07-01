import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http.js';
import type { AuthUser } from '../types.js';

export const sessionCookieName = 'aea_session';
const sessionMaxAgeMs = 7 * 24 * 60 * 60 * 1000;

export function signSession(user: AuthUser) {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: '7d' });
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: sessionMaxAgeMs,
    path: '/'
  };
}

function readCookie(req: Request, name: string) {
  const cookies = req.headers.cookie?.split(';') ?? [];
  for (const cookie of cookies) {
    const [rawKey, ...valueParts] = cookie.trim().split('=');
    if (rawKey === name) return decodeURIComponent(valueParts.join('='));
  }
  return '';
}

function readSessionToken(req: Request) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return readCookie(req, sessionCookieName);
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readSessionToken(req);
  if (!token) {
    return next(new HttpError(401, 'Authentication required'));
  }

  try {
    req.user = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    return next();
  } catch {
    return next(new HttpError(401, 'Invalid or expired session'));
  }
}
