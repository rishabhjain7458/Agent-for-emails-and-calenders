import type { NextFunction, Request, Response } from 'express';

type CacheEntry = {
  expiresAt: number;
  status: number;
  body: unknown;
};

const cache = new Map<string, CacheEntry>();

function cacheKey(req: Request) {
  return `${req.user?.tenantId}:${req.user?.id}:${req.method}:${req.originalUrl}`;
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
      res.status(cached.status).json(cached.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, { body, expiresAt: Date.now() + seconds * 1000, status: res.statusCode });
      }
      return originalJson(body);
    };

    next();
  };
}
