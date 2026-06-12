import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http.js';
export function signSession(user) {
    return jwt.sign(user, env.JWT_SECRET, { expiresIn: '7d' });
}
export function requireAuth(req, _res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return next(new HttpError(401, 'Authentication required'));
    }
    try {
        req.user = jwt.verify(header.slice(7), env.JWT_SECRET);
        return next();
    }
    catch {
        return next(new HttpError(401, 'Invalid or expired session'));
    }
}
