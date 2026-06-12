import { handleAssistantMessage } from '../services/assistantService.js';
import { appendConversationMessages, getConversation, listConversations } from '../repositories/conversationRepository.js';
import { send } from '../utils/http.js';
export async function chat(req, res, next) {
    try {
        const handled = await handleAssistantMessage(req.user.tenantId, req.user.id, req.body.message);
        const assistantContent = typeof handled.result === 'string' ? handled.result : JSON.stringify(handled.result, null, 2);
        const conversation = await appendConversationMessages({
            tenantId: req.user.tenantId,
            userId: req.user.id,
            conversationId: req.body.conversationId,
            title: req.body.message.slice(0, 80),
            messages: [
                { role: 'user', content: req.body.message, createdAt: new Date().toISOString() },
                { role: 'assistant', content: assistantContent, createdAt: new Date().toISOString() }
            ]
        });
        send(res, { ...handled, conversation });
    }
    catch (error) {
        next(error);
    }
}
export async function index(req, res, next) {
    try {
        send(res, await listConversations(req.user.tenantId, req.user.id));
    }
    catch (error) {
        next(error);
    }
}
export async function show(req, res, next) {
    try {
        send(res, await getConversation(req.user.tenantId, req.user.id, req.params.id));
    }
    catch (error) {
        next(error);
    }
}
