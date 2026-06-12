import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http.js';
import type { AuthUser } from '../types.js';

export function signSession(user: AuthUser) {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: '7d' });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Authentication required'));
  }

  try {
    req.user = jwt.verify(header.slice(7), env.JWT_SECRET) as AuthUser;
    return next();
  } catch {
    return next(new HttpError(401, 'Invalid or expired session'));
  }
}
