import { Router } from 'express';
import Joi from 'joi';
import { create, index, remove, updateOrder } from '../controllers/dashboardCardController.js';
import { validateBody } from '../middleware/validate.js';

export const dashboardCardRoutes = Router();

dashboardCardRoutes.get('/', index);
dashboardCardRoutes.post('/', validateBody(Joi.object({
  cardType: Joi.string().valid('social', 'news', 'custom_link').required(),
  platform: Joi.string().allow('', null).optional(),
  label: Joi.string().trim().min(1).max(120).required(),
  url: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
  metadata: Joi.object().optional()
})), create);
dashboardCardRoutes.put('/order', validateBody(Joi.object({
  cardOrder: Joi.array().items(Joi.string()).required()
})), updateOrder);
dashboardCardRoutes.delete('/:id', remove);
