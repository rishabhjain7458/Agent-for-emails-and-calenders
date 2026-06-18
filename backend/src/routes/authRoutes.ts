import { Router } from 'express';
import { connectedAccounts, connectImapAccount, disconnectAccount, googleCallback, googleConnect, googleLogin, me, microsoftCallback, microsoftConnect, microsoftLogin, zohoCallback, zohoConnect, zohoLogin } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import Joi from 'joi';
import { validateBody } from '../middleware/validate.js';

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
authRoutes.post('/imap/connect', requireAuth, validateBody(Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
  name: Joi.string().allow('').optional(),
  imapHost: Joi.string().default('imappro.zoho.in'),
  imapPort: Joi.number().integer().min(1).max(65535).default(993),
  imapSecure: Joi.boolean().default(true),
  smtpHost: Joi.string().default('smtp.zoho.in'),
  smtpPort: Joi.number().integer().min(1).max(65535).default(465),
  smtpSecure: Joi.boolean().default(true)
})), connectImapAccount);
authRoutes.delete('/connected-accounts/:id', requireAuth, disconnectAccount);
