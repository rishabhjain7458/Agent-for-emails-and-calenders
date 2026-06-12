import { Router } from 'express';
import Joi from 'joi';
import { complete, create, index, remove } from '../controllers/taskController.js';
import { validateBody } from '../middleware/validate.js';
export const taskRoutes = Router();
taskRoutes.get('/', index);
taskRoutes.post('/', validateBody(Joi.object({
    title: Joi.string().required(),
    dueDate: Joi.string().allow(null, '').optional()
})), create);
taskRoutes.patch('/:id/complete', complete);
taskRoutes.delete('/:id', remove);
