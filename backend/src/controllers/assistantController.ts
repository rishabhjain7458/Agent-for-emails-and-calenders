import type { NextFunction, Request, Response } from 'express';
import { handleAssistantMessage } from '../services/assistantService.js';
import { appendConversationMessages, getConversation, listConversations } from '../repositories/conversationRepository.js';
import { send } from '../utils/http.js';

export async function chat(req: Request, res: Response, next: NextFunction) {
  try {
    const existingConversation = req.body.conversationId
      ? await getConversation(req.user!.tenantId, req.user!.id, req.body.conversationId)
      : null;
    const handled = await handleAssistantMessage(req.user!, req.body.message, existingConversation?.messages ?? []);
    const assistantContent = typeof handled.result === 'string' ? handled.result : JSON.stringify(handled.result, null, 2);
    const conversation = await appendConversationMessages({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      conversationId: req.body.conversationId,
      title: req.body.message.slice(0, 80),
      messages: [
        { role: 'user', content: req.body.message, createdAt: new Date().toISOString() },
        { role: 'assistant', content: assistantContent, createdAt: new Date().toISOString() }
      ]
    });
    send(res, { ...handled, conversation });
  } catch (error) {
    next(error);
  }
}

export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    send(res, await listConversations(req.user!.tenantId, req.user!.id));
  } catch (error) {
    next(error);
  }
}

export async function show(req: Request, res: Response, next: NextFunction) {
  try {
    send(res, await getConversation(req.user!.tenantId, req.user!.id, req.params.id));
  } catch (error) {
    next(error);
  }
}
