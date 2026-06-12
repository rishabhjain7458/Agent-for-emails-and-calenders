import { google } from 'googleapis';
import { getAuthorizedGoogleClient } from './googleAuthService.js';
import type { EmailMessage } from '../types.js';

function decodeBody(data?: string | null) {
  if (!data) return '';
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function header(headers: { name?: string | null; value?: string | null }[] = [], name: string) {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function bodyFromPayload(payload: any): string {
  if (payload?.body?.data) return decodeBody(payload.body.data);
  const parts = payload?.parts ?? [];
  const text = parts.find((part: any) => part.mimeType === 'text/plain') ?? parts.find((part: any) => part.mimeType === 'text/html');
  return decodeBody(text?.body?.data);
}

function attachmentsFromPayload(payload: any) {
  return (payload?.parts ?? [])
    .filter((part: any) => part.filename && part.body?.attachmentId)
    .map((part: any) => ({
      filename: part.filename,
      mimeType: part.mimeType,
      attachmentId: part.body.attachmentId
    }));
}

export async function listEmails(userId: string, query = 'in:inbox', maxResults = 20, pageToken?: string) {
  const auth = await getAuthorizedGoogleClient(userId);
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
    return {
      id: detail.data.id!,
      threadId: detail.data.threadId!,
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

export async function getEmail(userId: string, messageId: string): Promise<EmailMessage> {
  const auth = await getAuthorizedGoogleClient(userId);
  const gmail = google.gmail({ version: 'v1', auth });
  const detail = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  const headers = detail.data.payload?.headers ?? [];
  return {
    id: detail.data.id!,
    threadId: detail.data.threadId!,
    subject: header(headers, 'Subject') || '(No subject)',
    sender: header(headers, 'From'),
    date: header(headers, 'Date'),
    unread: detail.data.labelIds?.includes('UNREAD') ?? false,
    snippet: detail.data.snippet ?? '',
    body: bodyFromPayload(detail.data.payload),
    attachments: attachmentsFromPayload(detail.data.payload)
  };
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
  const gmail = google.gmail({ version: 'v1', auth });
  await gmail.users.messages.modify({ userId: 'me', id: messageId, requestBody: { removeLabelIds: ['INBOX'] } });
}

export async function deleteEmail(userId: string, messageId: string) {
  const auth = await getAuthorizedGoogleClient(userId);
  const gmail = google.gmail({ version: 'v1', auth });
  await gmail.users.messages.trash({ userId: 'me', id: messageId });
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
