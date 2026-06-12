import type { Response } from 'express';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function send(res: Response, data: unknown, status = 200) {
  return res.status(status).json({ data });
}
