import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http.js';

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.path}`));
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof Error ? error.message : 'Unexpected error';
  if (status >= 500) console.error(error);
  res.status(status).json({ error: { message } });
}
