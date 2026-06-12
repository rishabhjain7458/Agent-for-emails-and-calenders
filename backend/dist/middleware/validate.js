import { HttpError } from '../utils/http.js';
export function validateBody(schema) {
    return (req, _res, next) => {
        const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error)
            return next(new HttpError(400, error.message));
        req.body = value;
        next();
    };
}
