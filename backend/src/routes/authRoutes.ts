import { Router } from 'express';
import { connectedAccounts, disconnectAccount, googleCallback, googleConnect, googleLogin, me, microsoftCallback, microsoftConnect, microsoftLogin, zohoCallback, zohoConnect, zohoLogin } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

export const authRoutes = Router();

authRoutes.get('/google', googleLogin);
authRoutes.get('/google/connect', requireAuth, googleConnect);
authRoutes.get('/google/callback', googleCallback);
authRoutes.get('/microsoft', microsoftLogin);
authRoutes.get('/microsoft/connect', requireAuth, microsoftConnect);
authRoutes.get('/microsoft/callback', microsoftCallback);
authRoutes.get('/zoho', zohoLogin);
authRoutes.get('/zoho/connect', requireAuth, zohoConnect);
authRoutes.get('/zoho/callback', zohoCallback);
authRoutes.get('/me', requireAuth, me);
authRoutes.get('/connected-accounts', requireAuth, connectedAccounts);
authRoutes.delete('/connected-accounts/:id', requireAuth, disconnectAccount);
