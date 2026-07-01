import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { AuthUser } from '../types.js';

describe('requireAuth', () => {
  let signSession: (user: AuthUser) => string;
  let sessionCookieName: string;
  let requireAuth: typeof import('./auth.js').requireAuth;

  const user: AuthUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'rishabh@example.com',
    name: 'Rishabh',
    role: 'owner',
    provider: 'google'
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/test';
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
    process.env.TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY ?? '12345678901234567890123456789012';
    const auth = await import('./auth.js');
    signSession = auth.signSession;
    sessionCookieName = auth.sessionCookieName;
    requireAuth = auth.requireAuth;
  });

  function app() {
    const testApp = express();
    testApp.get('/private', requireAuth, (req, res) => res.json({ user: req.user }));
    return testApp;
  }

  it('accepts bearer tokens for native clients', async () => {
    const token = signSession(user);
    const response = await request(app()).get('/private').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(user.email);
  });

  it('accepts httpOnly session cookie tokens for web clients', async () => {
    const token = signSession(user);
    const response = await request(app()).get('/private').set('Cookie', `${sessionCookieName}=${encodeURIComponent(token)}`);
    expect(response.status).toBe(200);
    expect(response.body.user.tenantId).toBe(user.tenantId);
  });

  it('rejects missing sessions', async () => {
    const response = await request(app()).get('/private');
    expect(response.status).toBe(401);
  });
});
