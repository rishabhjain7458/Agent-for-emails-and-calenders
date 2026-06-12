import { api } from './client';
import type { CalendarEvent, EmailMessage, Task, User } from '../types';

export async function getMe() {
  const { data } = await api.get<{ data: User }>('/auth/me');
  return data.data;
}

type EmailsApiResponse =
  | { data: EmailMessage[] }
  | { data: { messages: EmailMessage[]; nextPageToken?: string; resultSizeEstimate?: number } };

export async function getEmails(q = 'in:inbox') {
  const { data } = await api.get<EmailsApiResponse>('/emails', { params: { q } });
  return Array.isArray(data.data) ? data.data : data.data.messages;
}

export async function getEmail(id: string) {
  const { data } = await api.get<{ data: EmailMessage }>(`/emails/${id}`);
  return data.data;
}

export async function generateReply(id: string) {
  const { data } = await api.post<{ data: { draft: string; email: EmailMessage } }>(`/emails/${id}/ai-reply`);
  return data.data;
}

export async function sendReply(payload: { threadId: string; to: string; subject: string; body: string }) {
  const { data } = await api.post('/emails/send-reply', payload);
  return data.data;
}

export async function saveDraft(id: string, payload: { threadId: string; subject: string; body: string }) {
  const { data } = await api.post(`/emails/${id}/drafts`, payload);
  return data.data;
}

export async function archiveEmail(id: string) {
  const { data } = await api.post(`/emails/${id}/archive`);
  return data.data;
}

export async function deleteEmail(id: string) {
  const { data } = await api.delete(`/emails/${id}`);
  return data.data;
}

export async function getEmailSummary() {
  const { data } = await api.get<{ data: { summary: string } }>('/emails/summary');
  return data.data.summary;
}

export async function getEvents() {
  const { data } = await api.get<{ data: CalendarEvent[] }>('/calendar/events');
  return data.data;
}

export async function createEvent(payload: Record<string, unknown>) {
  const { data } = await api.post('/calendar/events', payload);
  return data.data;
}

export async function deleteEvent(id: string) {
  const { data } = await api.delete(`/calendar/events/${id}`);
  return data.data;
}

export async function getTasks() {
  const { data } = await api.get<{ data: Task[] }>('/tasks');
  return data.data;
}

export async function createTask(payload: { title: string; dueDate?: string }) {
  const { data } = await api.post<{ data: Task }>('/tasks', payload);
  return data.data;
}

export async function completeTask(id: string) {
  const { data } = await api.patch<{ data: Task }>(`/tasks/${id}/complete`);
  return data.data;
}

export async function removeTask(id: string) {
  const { data } = await api.delete(`/tasks/${id}`);
  return data.data;
}

export async function chat(message: string, conversationId?: string) {
  const { data } = await api.post('/assistant/chat', { message, conversationId });
  return data.data;
}

export async function getSettings() {
  const { data } = await api.get('/settings');
  return data.data;
}

export async function updateSettings(payload: Record<string, unknown>) {
  const { data } = await api.put('/settings', payload);
  return data.data;
}
