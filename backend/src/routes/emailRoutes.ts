import { Router } from 'express';
import Joi from 'joi';
import { archive, attachment, detail, draftReply, emailSummary, inbox, refineReply, remove, saveEmailDraft, sendEmailReply, summary, thread } from '../controllers/emailController.js';
import { validateBody } from '../middleware/validate.js';
import { cacheGet } from '../middleware/responseCache.js';

export const emailRoutes = Router();

emailRoutes.get('/', cacheGet(45, (req) => req.query.dashboard === '1'), inbox);
emailRoutes.get('/summary', summary);
emailRoutes.get('/threads/:threadId', thread);
emailRoutes.post('/send-reply', validateBody(Joi.object({
  messageId: Joi.string().optional(),
  threadId: Joi.string().required(),
  to: Joi.string().required(),
  subject: Joi.string().required(),
  body: Joi.string().required()
})), sendEmailReply);
emailRoutes.get('/:id/attachments/:attachmentId', attachment);
emailRoutes.get('/:id', detail);
emailRoutes.post('/:id/summary', emailSummary);
emailRoutes.post('/:id/ai-reply', validateBody(Joi.object({
  tone: Joi.string().valid('professional', 'short', 'friendly', 'firm').default('professional')
})), draftReply);
emailRoutes.post('/:id/refine-reply', validateBody(Joi.object({
  draft: Joi.string().required(),
  instruction: Joi.string().required()
})), refineReply);
emailRoutes.post('/:id/drafts', validateBody(Joi.object({
  threadId: Joi.string().required(),
  subject: Joi.string().required(),
  body: Joi.string().required()
})), saveEmailDraft);
emailRoutes.post('/:id/archive', archive);
emailRoutes.delete('/:id', remove);
