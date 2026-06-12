import { Router } from 'express';
import Joi from 'joi';
import { show, update } from '../controllers/settingsController.js';
import { validateBody } from '../middleware/validate.js';
export const settingsRoutes = Router();
settingsRoutes.get('/', show);
settingsRoutes.put('/', validateBody(Joi.object({
    geminiApiKey: Joi.string().allow('').optional(),
    timezone: Joi.string().optional(),
    emailPreferences: Joi.object().optional()
})), update);
