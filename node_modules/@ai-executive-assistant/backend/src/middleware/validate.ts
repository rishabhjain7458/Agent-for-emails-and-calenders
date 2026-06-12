import type { NextFunction, Request, Response } from 'express';
import type Joi from 'joi';
import { HttpError } from '../utils/http.js';

export function validateBody(schema: Joi.ObjectSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return next(new HttpError(400, error.message));
    req.body = value;
    next();
  };
}
