import axios from 'axios';
import { env } from '../config/env.js';
import type { EmailMessage } from '../types.js';
import { htmlToText, looksLikeHtml } from '../utils/htmlToText.js';
import { getZohoAccessToken, getZohoAccessTokenForConnectedAccount } from './zohoAuthService.js';

const mailBase = () => `${env.ZOHO_MAIL_API_URL.replace(/\/$/, '')}/api`;

type ZohoAccountMeta = {
  accountId: string;
  accountEmail?: string;
  providerAccountId?: string;
};

type ParsedZohoSearch = {
  folderName: 'Inbox' | 'Sent';
  unread: boolean;
  hasAttachment: boolean;
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
    .replace(/\b(after|before):\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/gi, ' ');

  const quoted = Array.from(withoutOperators.matchAll(/"([^"]+)"/g)).map((match) => unquote(match[1]));
  const unquoted = withoutOperators
    .replace(/"[^"]+"/g, ' ')
    .split(/\s+/)
    .map(unquote)
    .filter((term) => term.length >= 2);

  return [...quoted, ...unquoted];
}

function parseSearch(query: string): ParsedZohoSearch {
  return {
    folderName: /\bin:sent\b/i.test(query) ? 'Sent' : 'Inbox',
    unread: /\bis:unread\b/i.test(query),
    hasAttachment: /\bhas:attachment\b/i.test(query),
    senderTerms: extractOperatorTerms(query, 'from'),
    subjectTerms: extractOperatorTerms(query, 'subject'),
    bodyTerms: extractBodyTerms(query)
  };
}

function normalizeDate(value: unknown) {
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value !== 'string') return '';
  if (/^\d+$/.test(value)) return new Date(Number(value)).toISOString();
  return value;
}

function messageId(message: any) {
  return String(message.messageId ?? message.mailId ?? message.id ?? '');
}

function senderOf(message: any) {
  return message.fromAddress ?? message.sender ?? message.from ?? message.fromEmailAddress ?? '';
}

function mapMessage(message: any, meta: Partial<EmailMessage> = {}): EmailMessage {
  const rawId = messageId(message);
  const body = message.content ?? message.body ?? message.htmlBody ?? message.messageContent ?? '';
  const hasHtml = looksLikeHtml(body);
  return {
    id: meta.accountId ? `${meta.accountId}:${rawId}` : rawId,
    threadId: String(message.threadId ?? message.conversationId ?? rawId),
    provider: 'zoho',
    ...meta,
    subject: message.subject || '(No subject)',
    sender: senderOf(message),
    date: normalizeDate(message.receivedTime ?? message.sentDateInGMT ?? message.receivedDateTime ?? message.date),
    unread: message.status === 'unread' || message.readStatus === false || message.isRead === false,
    snippet: message.summary ?? message.snippet ?? message.bodyPreview ?? '',
    body: hasHtml ? htmlToText(body) : body,
    originalBody: hasHtml ? body : undefined,
    attachments: (message.attachments ?? message.attachmentInfo ?? [])
      .filter((attachment: any) => attachment.attachmentId || attachment.id)
      .map((attachment: any) => ({
        filename: attachment.attachmentName ?? attachment.name ?? attachment.fileName ?? 'attachment',
        mimeType: attachment.contentType ?? attachment.mimeType ?? 'application/octet-stream',
        attachmentId: String(attachment.attachmentId ?? attachment.id),
        size: attachment.size
      }))
  };
}

async function getZohoAccountId(token: string) {
  const { data } = await axios.get<{ data?: any[] }>(`${mailBase()}/accounts`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  return String(data.data?.[0]?.accountId ?? '');
}

async function getFolderId(token: string, accountId: string, folderName: string) {
  const { data } = await axios.get<{ data?: any[] }>(`${mailBase()}/accounts/${accountId}/folders`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  const folder = data.data?.find((item) => String(item.folderName ?? item.name).toLowerCase() === folderName.toLowerCase());
  return String(folder?.folderId ?? folder?.id ?? '');
}

function matchesTerm(value: string | undefined, terms: string[]) {
  if (!terms.length) return true;
  const haystack = (value ?? '').toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

async function listZohoEmailsWithToken(token: string, query = 'in:inbox', maxResults = 20, meta: Partial<EmailMessage> & Partial<ZohoAccountMeta> = {}) {
  const accountId = meta.accountId && meta.accountId !== 'primary' ? meta.providerAccountId ?? '' : await getZohoAccountId(token);
  const actualAccountId = accountId || await getZohoAccountId(token);
  const parsed = parseSearch(query);
  const folderId = await getFolderId(token, actualAccountId, parsed.folderName);
  const params: Record<string, string | number> = {
    limit: Math.max(maxResults, parsed.senderTerms.length || parsed.subjectTerms.length || parsed.bodyTerms.length ? 50 : maxResults),
    start: 1
  };
  if (folderId) params.folderId = folderId;

  const { data } = await axios.get<{ data?: any[] }>(`${mailBase()}/accounts/${actualAccountId}/messages/view`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
    params
  });

  const messages = (data.data ?? [])
    .filter((message) => {
      const sender = senderOf(message);
      const subject = message.subject ?? '';
      const searchableBody = [message.summary, message.snippet, message.bodyPreview, subject].filter(Boolean).join(' ');
      const unreadOk = !parsed.unread || mapMessage(message).unread;
      const attachmentOk = !parsed.hasAttachment || Boolean(message.hasAttachment || message.attachments?.length || message.attachmentInfo?.length);
      return unreadOk
        && attachmentOk
        && matchesTerm(sender, parsed.senderTerms)
        && matchesTerm(subject, parsed.subjectTerms)
        && matchesTerm(searchableBody, parsed.bodyTerms);
    })
    .slice(0, maxResults)
    .map((message) => mapMessage(message, meta));

  return { messages, resultSizeEstimate: messages.length };
}

export async function listZohoEmails(userId: string, query = 'in:inbox', maxResults = 20) {
  const token = await getZohoAccessToken(userId);
  return listZohoEmailsWithToken(token, query, maxResults, { provider: 'zoho' });
}

export async function listZohoEmailsForConnectedAccount(tenantId: string, userId: string, accountId: string, accountEmail: string, providerAccountId: string, query = 'in:inbox', maxResults = 20) {
  const token = await getZohoAccessTokenForConnectedAccount(tenantId, userId, accountId);
  return listZohoEmailsWithToken(token, query, maxResults, { accountId, accountEmail, providerAccountId, provider: 'zoho' } as any);
}

async function getZohoEmailWithToken(token: string, messageIdValue: string, meta: Partial<EmailMessage> & Partial<ZohoAccountMeta> = {}): Promise<EmailMessage> {
  const actualAccountId = meta.accountId && meta.accountId !== 'primary' ? meta.providerAccountId ?? '' : await getZohoAccountId(token);
  const { data } = await axios.get<{ data?: any }>(`${mailBase()}/accounts/${actualAccountId}/messages/${messageIdValue}/content`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  const message = Array.isArray(data.data) ? data.data[0] : data.data ?? data;
  return mapMessage({ ...message, messageId: messageIdValue }, meta);
}

export async function getZohoEmail(userId: string, messageIdValue: string): Promise<EmailMessage> {
  const token = await getZohoAccessToken(userId);
  return getZohoEmailWithToken(token, messageIdValue, { provider: 'zoho' });
}

export async function getZohoEmailForConnectedAccount(tenantId: string, userId: string, accountId: string, accountEmail: string, providerAccountId: string, messageIdValue: string): Promise<EmailMessage> {
  const token = await getZohoAccessTokenForConnectedAccount(tenantId, userId, accountId);
  return getZohoEmailWithToken(token, messageIdValue, { accountId, accountEmail, providerAccountId, provider: 'zoho' } as any);
}

async function getZohoAttachmentWithToken(token: string, accountId: string, messageIdValue: string, attachmentId: string) {
  const response = await axios.get(`${mailBase()}/accounts/${accountId}/messages/${messageIdValue}/attachments/${attachmentId}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
    responseType: 'arraybuffer'
  });
  return Buffer.from(response.data);
}

export async function getZohoAttachment(userId: string, messageIdValue: string, attachmentId: string) {
  const token = await getZohoAccessToken(userId);
  const accountId = await getZohoAccountId(token);
  return getZohoAttachmentWithToken(token, accountId, messageIdValue, attachmentId);
}

export async function getZohoAttachmentForConnectedAccount(tenantId: string, userId: string, accountId: string, providerAccountId: string, messageIdValue: string, attachmentId: string) {
  const token = await getZohoAccessTokenForConnectedAccount(tenantId, userId, accountId);
  return getZohoAttachmentWithToken(token, providerAccountId, messageIdValue, attachmentId);
}

async function updateZohoMessageStatus(token: string, accountId: string, messageIdValue: string, mode: 'archive' | 'delete') {
  const endpoint = mode === 'archive' ? 'archive' : 'delete';
  await axios.put(`${mailBase()}/accounts/${accountId}/messages/${messageIdValue}/${endpoint}`, {}, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
}

export async function archiveZohoEmail(userId: string, messageIdValue: string) {
  const token = await getZohoAccessToken(userId);
  await updateZohoMessageStatus(token, await getZohoAccountId(token), messageIdValue, 'archive');
}

export async function archiveZohoEmailForConnectedAccount(tenantId: string, userId: string, accountId: string, providerAccountId: string, messageIdValue: string) {
  const token = await getZohoAccessTokenForConnectedAccount(tenantId, userId, accountId);
  await updateZohoMessageStatus(token, providerAccountId, messageIdValue, 'archive');
}

export async function deleteZohoEmail(userId: string, messageIdValue: string) {
  const token = await getZohoAccessToken(userId);
  await updateZohoMessageStatus(token, await getZohoAccountId(token), messageIdValue, 'delete');
}

export async function deleteZohoEmailForConnectedAccount(tenantId: string, userId: string, accountId: string, providerAccountId: string, messageIdValue: string) {
  const token = await getZohoAccessTokenForConnectedAccount(tenantId, userId, accountId);
  await updateZohoMessageStatus(token, providerAccountId, messageIdValue, 'delete');
}

export async function sendZohoReply(userId: string, input: { to: string; subject: string; body: string }) {
  const token = await getZohoAccessToken(userId);
  const accountId = await getZohoAccountId(token);
  await sendZohoReplyWithToken(token, accountId, input);
  return { sent: true };
}

export async function sendZohoReplyForConnectedAccount(tenantId: string, userId: string, accountId: string, providerAccountId: string, input: { to: string; subject: string; body: string }) {
  const token = await getZohoAccessTokenForConnectedAccount(tenantId, userId, accountId);
  await sendZohoReplyWithToken(token, providerAccountId, input);
  return { sent: true };
}

async function sendZohoReplyWithToken(token: string, accountId: string, input: { to: string; subject: string; body: string }) {
  await axios.post(`${mailBase()}/accounts/${accountId}/messages`, {
    toAddress: input.to,
    subject: `Re: ${input.subject.replace(/^Re:\s*/i, '')}`,
    content: input.body,
    mailFormat: 'plaintext'
  }, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
}
