import { google } from 'googleapis';
import { getAuthorizedGoogleClient, getAuthorizedGoogleClientForConnectedAccount } from './googleAuthService.js';
import type { EmailMessage } from '../types.js';
import { htmlToText, looksLikeHtml } from '../utils/htmlToText.js';

function decodeBody(data?: string | null) {
  if (!data) return '';
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function header(headers: { name?: string | null; value?: string | null }[] = [], name: string) {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function bodyFromPayload(payload: any): string {
  const parts: any[] = [];
  const collectParts = (part: any) => {
    if (!part) return;
    parts.push(part);
    for (const child of part.parts ?? []) collectParts(child);
  };
  collectParts(payload);

  const plain = parts.find((part) => part.mimeType === 'text/plain' && part.body?.data);
  if (plain) return decodeBody(plain.body.data);

  const html = parts.find((part) => part.mimeType === 'text/html' && part.body?.data);
  const decoded = html ? decodeBody(html.body.data) : decodeBody(payload?.body?.data);
  return looksLikeHtml(decoded) ? htmlToText(decoded) : decoded;
}

function htmlFromPayload(payload: any): string | undefined {
  const parts: any[] = [];
  const collectParts = (part: any) => {
    if (!part) return;
    parts.push(part);
    for (const child of part.parts ?? []) collectParts(child);
  };
  collectParts(payload);
  const html = parts.find((part) => part.mimeType === 'text/html' && part.body?.data);
  const decoded = html ? decodeBody(html.body.data) : decodeBody(payload?.body?.data);
  return looksLikeHtml(decoded) ? decoded : undefined;
}

function attachmentsFromPayload(payload: any) {
  const parts: any[] = [];
  const collectParts = (part: any) => {
    if (!part) return;
    parts.push(part);
    for (const child of part.parts ?? []) collectParts(child);
  };
  collectParts(payload);

  return parts
    .filter((part: any) => part.filename && part.body?.attachmentId)
    .map((part: any) => ({
      filename: part.filename,
      mimeType: part.mimeType,
      attachmentId: part.body.attachmentId,
      size: part.body.size
    }));
}

async function listEmailsWithAuth(auth: any, query = 'in:inbox', maxResults = 20, pageToken?: string, meta: Partial<EmailMessage> = {}) {
  const gmail = google.gmail({ version: 'v1', auth });
  const response = await gmail.users.messages.list({ userId: 'me', q: query, maxResults, pageToken });
  const messages = response.data.messages ?? [];

  const hydrated = await Promise.all(messages.map(async (message) => {
    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: message.id!,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date']
    });
    const headers = detail.data.payload?.headers ?? [];
    const rawId = detail.data.id!;
    return {
      id: meta.accountId ? `${meta.accountId}:${rawId}` : rawId,
      threadId: detail.data.threadId!,
      provider: 'google' as const,
      ...meta,
      subject: header(headers, 'Subject') || '(No subject)',
      sender: header(headers, 'From'),
      date: header(headers, 'Date'),
      unread: detail.data.labelIds?.includes('UNREAD') ?? false,
      snippet: detail.data.snippet ?? ''
    };
  }));

  return {
    messages: hydrated,
    nextPageToken: response.data.nextPageToken,
    resultSizeEstimate: response.data.resultSizeEstimate ?? hydrated.length
  };
}

export async function listEmails(userId: string, query = 'in:inbox', maxResults = 20, pageToken?: string) {
  const auth = await getAuthorizedGoogleClient(userId);
  return listEmailsWithAuth(auth, query, maxResults, pageToken, { provider: 'google' });
}

export async function listEmailsForConnectedAccount(tenantId: string, userId: string, accountId: string, accountEmail: string, query = 'in:inbox', maxResults = 20) {
  const auth = await getAuthorizedGoogleClientForConnectedAccount(tenantId, userId, accountId);
  return listEmailsWithAuth(auth, query, maxResults, undefined, { accountId, accountEmail, provider: 'google' });
}

async function getEmailWithAuth(auth: any, messageId: string, meta: Partial<EmailMessage> = {}): Promise<EmailMessage> {
  const gmail = google.gmail({ version: 'v1', auth });
  const detail = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  const headers = detail.data.payload?.headers ?? [];
  return {
    id: meta.accountId ? `${meta.accountId}:${detail.data.id!}` : detail.data.id!,
    threadId: detail.data.threadId!,
    provider: 'google',
    ...meta,
    subject: header(headers, 'Subject') || '(No subject)',
    sender: header(headers, 'From'),
    date: header(headers, 'Date'),
    unread: detail.data.labelIds?.includes('UNREAD') ?? false,
    snippet: detail.data.snippet ?? '',
    body: bodyFromPayload(detail.data.payload),
    originalBody: htmlFromPayload(detail.data.payload),
    attachments: attachmentsFromPayload(detail.data.payload)
  };
}

export async function getEmail(userId: string, messageId: string): Promise<EmailMessage> {
  const auth = await getAuthorizedGoogleClient(userId);
  return getEmailWithAuth(auth, messageId, { provider: 'google' });
}

export async function getEmailForConnectedAccount(tenantId: string, userId: string, accountId: string, accountEmail: string, messageId: string): Promise<EmailMessage> {
  const auth = await getAuthorizedGoogleClientForConnectedAccount(tenantId, userId, accountId);
  return getEmailWithAuth(auth, messageId, { accountId, accountEmail, provider: 'google' });
}

async function getAttachmentWithAuth(auth: any, messageId: string, attachmentId: string) {
  const gmail = google.gmail({ version: 'v1', auth });
  const { data } = await gmail.users.messages.attachments.get({ userId: 'me', messageId, id: attachmentId });
  return Buffer.from((data.data ?? '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export async function getEmailAttachment(userId: string, messageId: string, attachmentId: string) {
  const auth = await getAuthorizedGoogleClient(userId);
  return getAttachmentWithAuth(auth, messageId, attachmentId);
}

export async function getEmailAttachmentForConnectedAccount(tenantId: string, userId: string, accountId: string, messageId: string, attachmentId: string) {
  const auth = await getAuthorizedGoogleClientForConnectedAccount(tenantId, userId, accountId);
  return getAttachmentWithAuth(auth, messageId, attachmentId);
}

export async function getThread(userId: string, threadId: string): Promise<EmailMessage[]> {
  const auth = await getAuthorizedGoogleClient(userId);
  const gmail = google.gmail({ version: 'v1', auth });
  const thread = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });
  return (thread.data.messages ?? []).map((message) => {
    const headers = message.payload?.headers ?? [];
    return {
      id: message.id!,
      threadId: message.threadId!,
      subject: header(headers, 'Subject') || '(No subject)',
      sender: header(headers, 'From'),
      date: header(headers, 'Date'),
      unread: message.labelIds?.includes('UNREAD') ?? false,
      snippet: message.snippet ?? '',
      body: bodyFromPayload(message.payload),
      attachments: attachmentsFromPayload(message.payload)
    };
  });
}

export async function archiveEmail(userId: string, messageId: string) {
  const auth = await getAuthorizedGoogleClient(userId);
  await archiveEmailWithAuth(auth, messageId);
}

async function archiveEmailWithAuth(auth: any, messageId: string) {
  const gmail = google.gmail({ version: 'v1', auth });
  await gmail.users.messages.modify({ userId: 'me', id: messageId, requestBody: { removeLabelIds: ['INBOX'] } });
}

export async function archiveEmailForConnectedAccount(tenantId: string, userId: string, accountId: string, messageId: string) {
  const auth = await getAuthorizedGoogleClientForConnectedAccount(tenantId, userId, accountId);
  await archiveEmailWithAuth(auth, messageId);
}

export async function deleteEmail(userId: string, messageId: string) {
  const auth = await getAuthorizedGoogleClient(userId);
  await deleteEmailWithAuth(auth, messageId);
}

async function deleteEmailWithAuth(auth: any, messageId: string) {
  const gmail = google.gmail({ version: 'v1', auth });
  await gmail.users.messages.trash({ userId: 'me', id: messageId });
}

export async function deleteEmailForConnectedAccount(tenantId: string, userId: string, accountId: string, messageId: string) {
  const auth = await getAuthorizedGoogleClientForConnectedAccount(tenantId, userId, accountId);
  await deleteEmailWithAuth(auth, messageId);
}

export async function sendReply(userId: string, input: { threadId: string; to: string; subject: string; body: string }) {
  const auth = await getAuthorizedGoogleClient(userId);
  const gmail = google.gmail({ version: 'v1', auth });
  const raw = Buffer.from([
    `To: ${input.to}`,
    `Subject: Re: ${input.subject.replace(/^Re:\s*/i, '')}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    input.body
  ].join('\r\n')).toString('base64url');

  return gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, threadId: input.threadId }
  });
}
