import { api } from './client';
import type { AssistantConversation, CalendarEvent, ConnectedAccount, DashboardCard, EmailMessage, Task, User } from '../types';

export async function getMe() {
  const { data } = await api.get<{ data: User }>('/auth/me');
  return data.data;
}

type EmailsApiResponse =
  | { data: EmailMessage[] }
  | { data: { messages: EmailMessage[]; nextPageToken?: string; resultSizeEstimate?: number } };

export async function getEmails(q = 'in:inbox', accountId = 'all') {
  const { data } = await api.get<EmailsApiResponse>('/emails', { params: { q, accountId } });
  return Array.isArray(data.data) ? data.data : data.data.messages;
}

export async function getConnectedAccounts() {
  const { data } = await api.get<{ data: ConnectedAccount[] }>('/auth/connected-accounts');
  return data.data;
}

export async function getConnectAccountUrl(provider: 'google' | 'microsoft', mobile = false) {
  const { data } = await api.get<{ data: { url: string } }>(`/auth/${provider}/connect`, { params: mobile ? { mobile: '1' } : undefined });
  return data.data.url;
}

export async function disconnectAccount(id: string) {
  const { data } = await api.delete(`/auth/connected-accounts/${id}`);
  return data.data;
}

export async function getEmail(id: string) {
  const { data } = await api.get<{ data: EmailMessage }>(`/emails/${encodeURIComponent(id)}`);
  return data.data;
}

export async function getEmailAttachment(id: string, attachmentId: string) {
  const response = await api.get(`/emails/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`, { responseType: 'blob' });
  return response.data as Blob;
}

export async function generateReply(id: string) {
  const { data } = await api.post<{ data: { draft: string; email: EmailMessage } }>(`/emails/${encodeURIComponent(id)}/ai-reply`);
  return data.data;
}

export async function refineReply(id: string, payload: { draft: string; instruction: string }) {
  const { data } = await api.post<{ data: { draft: string; email: EmailMessage } }>(`/emails/${encodeURIComponent(id)}/refine-reply`, payload);
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
  const { data } = await api.post(`/emails/${encodeURIComponent(id)}/archive`);
  return data.data;
}

export async function deleteEmail(id: string) {
  const { data } = await api.delete(`/emails/${encodeURIComponent(id)}`);
  return data.data;
}

export async function getEmailSummary() {
  const { data } = await api.get<{ data: { summary: string } }>('/emails/summary');
  return data.data.summary;
}

export async function getEvents(accountId = 'all') {
  const { data } = await api.get<{ data: CalendarEvent[] }>('/calendar/events', { params: { accountId } });
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

export async function getTasks(accountId = 'all') {
  const { data } = await api.get<{ data: Task[] }>('/tasks', { params: { accountId } });
  return data.data;
}

export async function createTask(payload: { title: string; dueDate?: string; accountId?: string }) {
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

export async function chat(message: string, conversationId?: string, accountId?: string) {
  const { data } = await api.post('/assistant/chat', { message, conversationId, accountId });
  return data.data;
}

export async function getAssistantConversations() {
  const { data } = await api.get<{ data: AssistantConversation[] }>('/assistant/conversations');
  return data.data;
}

export async function getAssistantConversation(id: string) {
  const { data } = await api.get<{ data: AssistantConversation }>(`/assistant/conversations/${id}`);
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

export async function getDashboardCards() {
  const { data } = await api.get<{ data: { cards: DashboardCard[]; cardOrder: string[] } }>('/dashboard-cards');
  return data.data;
}

export async function createDashboardCard(payload: { cardType: DashboardCard['cardType']; platform?: string | null; label: string; url: string; metadata?: Record<string, unknown> }) {
  const { data } = await api.post<{ data: DashboardCard }>('/dashboard-cards', payload);
  return data.data;
}

export async function deleteDashboardCard(id: string) {
  const { data } = await api.delete(`/dashboard-cards/${id}`);
  return data.data;
}

export async function updateDashboardCardOrder(cardOrder: string[]) {
  const { data } = await api.put<{ data: { cardOrder: string[] } }>('/dashboard-cards/order', { cardOrder });
  return data.data.cardOrder;
}
