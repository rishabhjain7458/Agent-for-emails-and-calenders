import type { NextFunction, Request, Response } from 'express';
import { getSettings, updateSettings } from '../repositories/settingsRepository.js';
import { send } from '../utils/http.js';

export async function show(req: Request, res: Response, next: NextFunction) {
  try {
    send(res, await getSettings(req.user!.tenantId, req.user!.id));
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    send(res, await updateSettings(req.user!.tenantId, req.user!.id, req.body));
  } catch (error) {
    next(error);
  }
}
