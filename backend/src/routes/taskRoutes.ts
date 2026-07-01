import { Router } from 'express';
import Joi from 'joi';
import { complete, create, index, remove } from '../controllers/taskController.js';
import { validateBody } from '../middleware/validate.js';
import { cacheGet, invalidateResponseCache } from '../middleware/responseCache.js';

export const taskRoutes = Router();

taskRoutes.get('/', cacheGet(30, (req) => req.query.dashboard === '1'), index);
taskRoutes.post('/', invalidateResponseCache, validateBody(Joi.object({
  title: Joi.string().required(),
  dueDate: Joi.string().allow(null, '').optional(),
  accountId: Joi.string().default('primary')
})), create);
taskRoutes.patch('/:id/complete', invalidateResponseCache, complete);
taskRoutes.delete('/:id', invalidateResponseCache, remove);
