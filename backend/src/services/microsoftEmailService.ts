import axios from 'axios';
import { getMicrosoftAccessToken, getMicrosoftAccessTokenForConnectedAccount } from './microsoftAuthService.js';
import type { EmailMessage } from '../types.js';
import { htmlToText, looksLikeHtml } from '../utils/htmlToText.js';

const graph = 'https://graph.microsoft.com/v1.0';

type ParsedSearch = {
  folder: string;
  filter: string;
  senderTerms: string[];
  subjectTerms: string[];
  bodyTerms: string[];
};

function unquote(value: string) {
  return value.replace(/^"|"$/g, '').replace(/\\"/g, '"').trim().toLowerCase();
}

function extractOperatorTerms(query: string, operator: 'from' | 'subject') {
  const terms: string[] = [];
  const pattern = new RegExp(`${operator}:(?:"([^"]+)"|([^\\s]+))`, 'gi');
  let match = pattern.exec(query);
  while (match) {
    const value = match[1] ?? match[2] ?? '';
    if (value.trim()) terms.push(unquote(value));
    match = pattern.exec(query);
  }
  return terms;
}

function extractBodyTerms(query: string) {
  const withoutOperators = query
    .replace(/\bfrom:(?:"[^"]+"|[^\s]+)/gi, ' ')
    .replace(/\bsubject:(?:"[^"]+"|[^\s]+)/gi, ' ')
    .replace(/\bin:(inbox|sent|trash|spam|drafts|all|anywhere)\b/gi, ' ')
    .replace(/\bis:(unread|important)\b/gi, ' ')
    .replace(/\bhas:attachment\b/gi, ' ')
    .replace(/\b(newer_than|older_than):\d+d\b/gi, ' ')
    .replace(/\b(after|before):\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/gi, ' ')
    .replace(/-?\bcategory:[^\s]+\b/gi, ' ')
    .replace(/\b(filename|larger):[^\s]+\b/gi, ' ');

  const quoted = Array.from(withoutOperators.matchAll(/"([^"]+)"/g)).map((match) => unquote(match[1]));
  const unquoted = withoutOperators
    .replace(/"[^"]+"/g, ' ')
    .split(/\s+/)
    .map(unquote)
    .filter((term) => term.length >= 2);

  return [...quoted, ...unquoted];
}

function mapQuery(query: string) {
  const filters: string[] = [];
  if (query.includes('is:unread')) filters.push('isRead eq false');
  if (query.includes('has:attachment')) filters.push('hasAttachments eq true');
  const newerThan = query.match(/newer_than:(\d+)d/);
  if (newerThan) {
    const date = new Date(Date.now() - Number(newerThan[1]) * 24 * 60 * 60 * 1000).toISOString();
    filters.push(`receivedDateTime ge ${date}`);
  }
  const after = query.match(/\bafter:(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b/i);
  if (after) {
    const date = new Date(Number(after[1]), Number(after[2]) - 1, Number(after[3])).toISOString();
    filters.push(`receivedDateTime ge ${date}`);
  }
  const before = query.match(/\bbefore:(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b/i);
  if (before) {
    const date = new Date(Number(before[1]), Number(before[2]) - 1, Number(before[3])).toISOString();
    filters.push(`receivedDateTime le ${date}`);
  }

  return {
    folder: query.includes('in:sent') ? 'sentitems' : 'inbox',
    filter: filters.join(' and '),
    senderTerms: extractOperatorTerms(query, 'from'),
    subjectTerms: extractOperatorTerms(query, 'subject'),
    bodyTerms: extractBodyTerms(query)
  } satisfies ParsedSearch;
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
    body: looksLikeHtml(body) ? htmlToText(body) : body,
    originalBody: looksLikeHtml(body) ? body : undefined,
    attachments: (message.attachments ?? [])
      .filter((attachment: any) => attachment.id && attachment.name)
      .map((attachment: any) => ({
        filename: attachment.name,
        mimeType: attachment.contentType ?? 'application/octet-stream',
        attachmentId: attachment.id,
        size: attachment.size
      }))
  };
}

async function listMicrosoftEmailsWithToken(token: string, query = 'in:inbox', maxResults = 20, meta: Partial<EmailMessage> = {}) {
  const mapped = mapQuery(query);
  const params: Record<string, string | number> = {
    '$top': Math.max(maxResults, mapped.senderTerms.length || mapped.subjectTerms.length || mapped.bodyTerms.length ? 50 : maxResults),
    '$orderby': 'receivedDateTime desc',
    '$select': 'id,conversationId,subject,from,sender,receivedDateTime,sentDateTime,isRead,bodyPreview,hasAttachments'
  };
  if (mapped.filter) params.$filter = mapped.filter;

  const { data } = await axios.get(`${graph}/me/mailFolders/${mapped.folder}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
    params
  });
  const matchesTerm = (value: string | undefined, terms: string[]) => {
    if (!terms.length) return true;
    const haystack = (value ?? '').toLowerCase();
    return terms.every((term) => haystack.includes(term));
  };
  const matchesMessage = (message: any) => {
    const sender = [
      message.from?.emailAddress?.address,
      message.from?.emailAddress?.name,
      message.sender?.emailAddress?.address,
      message.sender?.emailAddress?.name
    ].filter(Boolean).join(' ');
    const bodySearch = [message.bodyPreview, message.subject].filter(Boolean).join(' ');
    return matchesTerm(sender, mapped.senderTerms)
      && matchesTerm(message.subject, mapped.subjectTerms)
      && matchesTerm(bodySearch, mapped.bodyTerms);
  };

  const messages = (data.value ?? [])
    .filter(matchesMessage)
    .slice(0, maxResults)
    .map((message: any) => mapMessage(message, meta));
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
    params: { '$select': 'id,subject,from,sender,receivedDateTime,isRead,bodyPreview,body,hasAttachments', '$expand': 'attachments' }
  });
  return mapMessage(data, meta);
}

export async function getMicrosoftEmailForConnectedAccount(tenantId: string, userId: string, accountId: string, accountEmail: string, messageId: string): Promise<EmailMessage> {
  const token = await getMicrosoftAccessTokenForConnectedAccount(tenantId, userId, accountId);
  return getMicrosoftEmailWithToken(token, messageId, { accountId, accountEmail, provider: 'microsoft' });
}

async function getMicrosoftAttachmentWithToken(token: string, messageId: string, attachmentId: string) {
  const { data } = await axios.get(`${graph}/me/messages/${messageId}/attachments/${attachmentId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return Buffer.from(data.contentBytes ?? '', 'base64');
}

export async function getMicrosoftAttachment(userId: string, messageId: string, attachmentId: string) {
  const token = await getMicrosoftAccessToken(userId);
  return getMicrosoftAttachmentWithToken(token, messageId, attachmentId);
}

export async function getMicrosoftAttachmentForConnectedAccount(tenantId: string, userId: string, accountId: string, messageId: string, attachmentId: string) {
  const token = await getMicrosoftAccessTokenForConnectedAccount(tenantId, userId, accountId);
  return getMicrosoftAttachmentWithToken(token, messageId, attachmentId);
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

async function setMicrosoftEmailUnreadWithToken(token: string, messageId: string, unread: boolean) {
  await axios.patch(`${graph}/me/messages/${messageId}`, {
    isRead: !unread
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function setMicrosoftEmailUnread(userId: string, messageId: string, unread: boolean) {
  const token = await getMicrosoftAccessToken(userId);
  await setMicrosoftEmailUnreadWithToken(token, messageId, unread);
}

export async function setMicrosoftEmailUnreadForConnectedAccount(tenantId: string, userId: string, accountId: string, messageId: string, unread: boolean) {
  const token = await getMicrosoftAccessTokenForConnectedAccount(tenantId, userId, accountId);
  await setMicrosoftEmailUnreadWithToken(token, messageId, unread);
}
