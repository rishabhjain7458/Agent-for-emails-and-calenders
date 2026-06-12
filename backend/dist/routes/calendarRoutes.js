import { Router } from 'express';
import Joi from 'joi';
import { availability, create, events, freeBusy, remove, update } from '../controllers/calendarController.js';
import { validateBody } from '../middleware/validate.js';
export const calendarRoutes = Router();
calendarRoutes.get('/events', events);
calendarRoutes.post('/events', validateBody(Joi.object({
    title: Joi.string().required(),
    date: Joi.string().required(),
    startTime: Joi.string().required(),
    endTime: Joi.string().required(),
    timezone: Joi.string().required(),
    description: Joi.string().allow('').optional(),
    attendees: Joi.array().items(Joi.string().email()).default([]),
    force: Joi.boolean().default(false)
})), create);
calendarRoutes.put('/events/:id', validateBody(Joi.object({
    title: Joi.string().required(),
    date: Joi.string().required(),
    startTime: Joi.string().required(),
    endTime: Joi.string().required(),
    timezone: Joi.string().required(),
    description: Joi.string().allow('').optional(),
    attendees: Joi.array().items(Joi.string().email()).default([]),
    force: Joi.boolean().default(false)
})), update);
calendarRoutes.delete('/events/:id', remove);
calendarRoutes.post('/availability', validateBody(Joi.object({
    start: Joi.string().required(),
    end: Joi.string().required()
})), availability);
calendarRoutes.post('/freebusy', validateBody(Joi.object({
    start: Joi.string().required(),
    end: Joi.string().required(),
    attendees: Joi.array().items(Joi.string().email()).default([])
})), freeBusy);
