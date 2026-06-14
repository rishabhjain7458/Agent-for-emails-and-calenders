import axios from 'axios';
import { getMicrosoftAccessToken, getMicrosoftAccessTokenForConnectedAccount } from './microsoftAuthService.js';
import type { EmailMessage } from '../types.js';
import { htmlToText, looksLikeHtml } from '../utils/htmlToText.js';

const graph = 'https://graph.microsoft.com/v1.0';

function mapQuery(query: string) {
  const filters: string[] = [];
  if (query.includes('is:unread')) filters.push('isRead eq false');
  if (query.includes('has:attachment')) filters.push('hasAttachments eq true');
  const newerThan = query.match(/newer_than:(\d+)d/);
  if (newerThan) {
    const date = new Date(Date.now() - Number(newerThan[1]) * 24 * 60 * 60 * 1000).toISOString();
    filters.push(`receivedDateTime ge ${date}`);
  }

  return {
    folder: query.includes('in:sent') ? 'sentitems' : 'inbox',
    filter: filters.join(' and ')
  };
}

function mapMessage(message: any, meta: Partial<EmailMessage> = {}): EmailMessage {
  const body = message.body?.content ?? '';
  return {
    id: meta.accountId ? `${meta.accountId}:${message.id}` : message.id,
    threadId: message.id,
    provider: 'microsoft',
    ...meta,
    subject: message.subject || '(No subject)',
    sender: message.from?.emailAddress?.address ?? message.sender?.emailAddress?.address ?? '',
    date: message.receivedDateTime ?? message.sentDateTime ?? '',
    unread: message.isRead === false,
    snippet: message.bodyPreview ?? '',
    body: looksLikeHtml(body) ? htmlToText(body) : body
  };
}

async function listMicrosoftEmailsWithToken(token: string, query = 'in:inbox', maxResults = 20, meta: Partial<EmailMessage> = {}) {
  const mapped = mapQuery(query);
  const params: Record<string, string | number> = {
    '$top': maxResults,
    '$orderby': 'receivedDateTime desc',
    '$select': 'id,conversationId,subject,from,sender,receivedDateTime,sentDateTime,isRead,bodyPreview,hasAttachments'
  };
  if (mapped.filter) params.$filter = mapped.filter;

  const { data } = await axios.get(`${graph}/me/mailFolders/${mapped.folder}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
    params
  });
  const messages = (data.value ?? []).map((message: any) => mapMessage(message, meta));
  return { messages, nextPageToken: data['@odata.nextLink'], resultSizeEstimate: messages.length };
}

export async function listMicrosoftEmails(userId: string, query = 'in:inbox', maxResults = 20) {
  const token = await getMicrosoftAccessToken(userId);
  return listMicrosoftEmailsWithToken(token, query, maxResults, { provider: 'microsoft' });
}

export async function listMicrosoftEmailsForConnectedAccount(tenantId: string, userId: string, accountId: string, accountEmail: string, query = 'in:inbox', maxResults = 20) {
  const token = await getMicrosoftAccessTokenForConnectedAccount(tenantId, userId, accountId);
  return listMicrosoftEmailsWithToken(token, query, maxResults, { accountId, accountEmail, provider: 'microsoft' });
}

export async function getMicrosoftEmail(userId: string, messageId: string): Promise<EmailMessage> {
  const token = await getMicrosoftAccessToken(userId);
  return getMicrosoftEmailWithToken(token, messageId, { provider: 'microsoft' });
}

async function getMicrosoftEmailWithToken(token: string, messageId: string, meta: Partial<EmailMessage> = {}): Promise<EmailMessage> {
  const { data } = await axios.get(`${graph}/me/messages/${messageId}`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { '$select': 'id,subject,from,sender,receivedDateTime,isRead,bodyPreview,body,hasAttachments' }
  });
  return mapMessage(data, meta);
}

export async function getMicrosoftEmailForConnectedAccount(tenantId: string, userId: string, accountId: string, accountEmail: string, messageId: string): Promise<EmailMessage> {
  const token = await getMicrosoftAccessTokenForConnectedAccount(tenantId, userId, accountId);
  return getMicrosoftEmailWithToken(token, messageId, { accountId, accountEmail, provider: 'microsoft' });
}

export async function sendMicrosoftReply(userId: string, input: { threadId: string; body: string }) {
  const token = await getMicrosoftAccessToken(userId);
  await axios.post(`${graph}/me/messages/${input.threadId}/reply`, {
    message: { body: { contentType: 'Text', content: input.body } }
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return { sent: true };
}

export async function archiveMicrosoftEmail(userId: string, messageId: string) {
  const token = await getMicrosoftAccessToken(userId);
  await archiveMicrosoftEmailWithToken(token, messageId);
}

async function archiveMicrosoftEmailWithToken(token: string, messageId: string) {
  const { data: archiveFolder } = await axios.get(`${graph}/me/mailFolders/archive`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  await axios.post(`${graph}/me/messages/${messageId}/move`, {
    destinationId: archiveFolder.id
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function archiveMicrosoftEmailForConnectedAccount(tenantId: string, userId: string, accountId: string, messageId: string) {
  const token = await getMicrosoftAccessTokenForConnectedAccount(tenantId, userId, accountId);
  await archiveMicrosoftEmailWithToken(token, messageId);
}

export async function deleteMicrosoftEmail(userId: string, messageId: string) {
  const token = await getMicrosoftAccessToken(userId);
  await deleteMicrosoftEmailWithToken(token, messageId);
}

async function deleteMicrosoftEmailWithToken(token: string, messageId: string) {
  await axios.delete(`${graph}/me/messages/${messageId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function deleteMicrosoftEmailForConnectedAccount(tenantId: string, userId: string, accountId: string, messageId: string) {
  const token = await getMicrosoftAccessTokenForConnectedAccount(tenantId, userId, accountId);
  await deleteMicrosoftEmailWithToken(token, messageId);
}
