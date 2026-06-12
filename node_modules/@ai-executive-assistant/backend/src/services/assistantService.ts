import { classifyIntent, answerGeneralQuestion, generateEmailSummary } from './geminiService.js';
import { createEvent, deleteEvent, listEvents } from './calendarService.js';
import { listEmails } from './emailService.js';
import { createTask, listTasks } from '../repositories/taskRepository.js';
import { createGoogleTask } from './googleTasksService.js';

export async function handleAssistantMessage(tenantId: string, userId: string, message: string) {
  const intent = await classifyIntent(tenantId, userId, message);
  const params = intent.parameters as any;

  switch (intent.intent) {
    case 'calendar_create':
      return { intent, result: await createEvent(userId, params, false) };
    case 'calendar_check':
      return { intent, result: await listEvents(userId, params.timeMin, params.timeMax) };
    case 'calendar_delete':
      await deleteEvent(userId, params.eventId);
      return { intent, result: { deleted: true } };
    case 'email_search':
      return { intent, result: await listEmails(userId, params.query ?? message) };
    case 'email_summary':
      const emails = await listEmails(userId, params.query ?? 'in:inbox newer_than:14d');
      return { intent, result: await generateEmailSummary(tenantId, userId, emails.messages) };
    case 'task_create': {
      const googleTask = await createGoogleTask(userId, params.title ?? message, params.dueDate);
      return { intent, result: await createTask(tenantId, userId, params.title ?? message, params.dueDate, googleTask.id) };
    }
    case 'task_list':
      return { intent, result: await listTasks(tenantId) };
    default:
      return { intent, result: await answerGeneralQuestion(tenantId, userId, message) };
  }
}
