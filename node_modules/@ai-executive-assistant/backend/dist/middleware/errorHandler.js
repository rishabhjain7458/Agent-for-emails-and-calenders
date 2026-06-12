import { HttpError } from '../utils/http.js';
export function notFound(req, _res, next) {
    next(new HttpError(404, `Route not found: ${req.method} ${req.path}`));
}
export function errorHandler(error, _req, res, _next) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Unexpected error';
    if (status >= 500)
        console.error(error);
    res.status(status).json({ error: { message } });
}
