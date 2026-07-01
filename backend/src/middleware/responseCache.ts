import type { NextFunction, Request, Response } from 'express';

type CacheEntry = {
  expiresAt: number;
  status: number;
  body: unknown;
};

const cache = new Map<string, CacheEntry>();
const maxEntries = 500;

function cacheKey(req: Request) {
  return `${req.user?.tenantId}:${req.user?.id}:${req.method}:${req.originalUrl}`;
}

function cacheOwnerPrefix(req: Request) {
  return `${req.user?.tenantId}:${req.user?.id}:`;
}

function pruneExpired() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}

function setCacheEntry(key: string, entry: CacheEntry) {
  pruneExpired();
  if (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, entry);
}

export function clearResponseCacheForUser(req: Request) {
  const prefix = cacheOwnerPrefix(req);
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function invalidateResponseCache(req: Request, res: Response, next: NextFunction) {
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) clearResponseCacheForUser(req);
  });
  next();
}

export function cacheGet(seconds: number, enabled: (req: Request) => boolean = () => true) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || !enabled(req)) {
      next();
      return;
    }

    const key = cacheKey(req);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      cache.delete(key);
      cache.set(key, cached);
      res.status(cached.status).json(cached.body);
      return;
    }
    if (cached) cache.delete(key);

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setCacheEntry(key, { body, expiresAt: Date.now() + seconds * 1000, status: res.statusCode });
      }
      return originalJson(body);
    };

    next();
  };
}
