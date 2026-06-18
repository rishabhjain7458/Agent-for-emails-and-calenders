import { Router } from 'express';
import Joi from 'joi';
import { chat, index, show } from '../controllers/assistantController.js';
import { validateBody } from '../middleware/validate.js';

export const assistantRoutes = Router();

assistantRoutes.get('/conversations', index);
assistantRoutes.get('/conversations/:id', show);
assistantRoutes.post('/chat', validateBody(Joi.object({
  message: Joi.string().required(),
  conversationId: Joi.string().optional(),
  accountId: Joi.string().optional()
})), chat);
