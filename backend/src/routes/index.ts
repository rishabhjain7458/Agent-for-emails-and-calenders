import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { authRoutes } from './authRoutes.js';
import { emailRoutes } from './emailRoutes.js';
import { calendarRoutes } from './calendarRoutes.js';
import { taskRoutes } from './taskRoutes.js';
import { assistantRoutes } from './assistantRoutes.js';
import { settingsRoutes } from './settingsRoutes.js';

export const apiRoutes = Router();

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/emails', requireAuth, emailRoutes);
apiRoutes.use('/calendar', requireAuth, calendarRoutes);
apiRoutes.use('/tasks', requireAuth, taskRoutes);
apiRoutes.use('/assistant', requireAuth, assistantRoutes);
apiRoutes.use('/settings', requireAuth, settingsRoutes);
