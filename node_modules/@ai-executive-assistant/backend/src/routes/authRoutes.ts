import { Router } from 'express';
import { googleCallback, googleLogin, me, microsoftCallback, microsoftLogin } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

export const authRoutes = Router();

authRoutes.get('/google', googleLogin);
authRoutes.get('/google/callback', googleCallback);
authRoutes.get('/microsoft', microsoftLogin);
authRoutes.get('/microsoft/callback', microsoftCallback);
authRoutes.get('/me', requireAuth, me);
