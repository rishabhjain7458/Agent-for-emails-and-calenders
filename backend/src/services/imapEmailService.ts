import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import { getConnectedAccount } from '../repositories/connectedAccountRepository.js';
import { decrypt } from '../utils/crypto.js';
import { HttpError } from '../utils/http.js';
import type { EmailMessage } from '../types.js';

type ImapConfig = {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
};

type ImapAccount = {
  id: string;
  email: string;
  password: string;
  config: ImapConfig;
};

function parseConfig(value?: string | null): ImapConfig {
  const config = value ? JSON.parse(value) : {};
  return {
    imapHost: config.imapHost || 'imappro.zoho.in',
    imapPort: Number(config.imapPort ?? 993),
    imapSecure: config.imapSecure ?? true,
    smtpHost: config.smtpHost || 'smtp.zoho.in',
    smtpPort: Number(config.smtpPort ?? 465),
    smtpSecure: config.smtpSecure ?? true
  };
}

async function getImapAccount(tenantId: string, userId: string, accountId: string): Promise<ImapAccount> {
  const account = await getConnectedAccount(tenantId, userId, accountId);
  if (!account || account.provider !== 'imap') throw new HttpError(404, 'Connected IMAP account not found');
  const password = decrypt(account.refresh_token);
  if (!password) throw new HttpError(401, 'IMAP app password is missing. Reconnect this mailbox.');
  return {
    id: account.id,
    email: account.email,
    password,
    config: parseConfig(decrypt(account.access_token))
  };
}

async function withClient<T>(account: ImapAccount, handler: (client: ImapFlow) => Promise<T>) {
  const client = new ImapFlow({
    host: account.config.imapHost,
    port: account.config.imapPort,
    secure: account.config.imapSecure,
    auth: { user: account.email, pass: account.password },
    logger: false
  });
  await client.connect();
  try {
    return await handler(client);
  } finally {
    await client.logout().catch(() => undefined);
  }
}

function parseQuery(query: string) {
  return {
    mailbox: /\bin:sent\b/i.test(query) ? 'Sent' : 'INBOX',
    unread: /\bis:unread\b/i.test(query),
    hasAttachment: /\bhas:attachment\b/i.test(query),
    from: query.match(/\bfrom:(?:"([^"]+)"|([^\s]+))/i)?.[1] ?? query.match(/\bfrom:(?:"([^"]+)"|([^\s]+))/i)?.[2] ?? '',
    subject: query.match(/\bsubject:(?:"([^"]+)"|([^\s]+))/i)?.[1] ?? query.match(/\bsubject:(?:"([^"]+)"|([^\s]+))/i)?.[2] ?? '',
    text: query
      .replace(/\bfrom:(?:"[^"]+"|[^\s]+)/gi, ' ')
      .replace(/\bsubject:(?:"[^"]+"|[^\s]+)/gi, ' ')
      .replace(/\bin:(inbox|sent|trash|spam|drafts|all|anywhere)\b/gi, ' ')
      .replace(/\bis:(unread|important)\b/gi, ' ')
      .replace(/\bhas:attachment\b/gi, ' ')
      .replace(/\b(newer_than|older_than):\d+d\b/gi, ' ')
      .replace(/\b(after|before):\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/gi, ' ')
      .trim()
      .toLowerCase()
  };
}

function addressText(value: any) {
  return (value ?? [])
    .map((item: any) => item.name ? `${item.name} <${item.address}>` : item.address)
    .filter(Boolean)
    .join(', ');
}

function compact(value?: string | null, limit = 220) {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1).trim()}...` : normalized;
}

function matches(message: EmailMessage, parsed: ReturnType<typeof parseQuery>) {
  const sender = message.sender.toLowerCase();
  const subject = message.subject.toLowerCase();
  const body = `${message.snippet ?? ''} ${message.body ?? ''}`.toLowerCase();
  if (parsed.from && !sender.includes(parsed.from.toLowerCase())) return false;
  if (parsed.subject && !subject.includes(parsed.subject.toLowerCase())) return false;
  if (parsed.text && !body.includes(parsed.text)) return false;
  if (parsed.hasAttachment && !message.attachments?.length) return false;
  if (parsed.unread && !message.unread) return false;
  return true;
}

function splitImapMessageId(value: string) {
  const [mailbox, uid] = value.includes(':') ? value.split(':') : ['INBOX', value];
  return { mailbox: mailbox || 'INBOX', uid: uid || value };
}

async function mapFetchedMessage(account: ImapAccount, item: any, mailbox = 'INBOX'): Promise<EmailMessage> {
  if (!item.source) throw new HttpError(500, 'IMAP message source was empty');
  const parsed: any = await simpleParser(item.source as any);
  const rawUid = String(item.uid);
  return {
    id: `${account.id}:${mailbox}:${rawUid}`,
    threadId: `${mailbox}:${rawUid}`,
    accountId: account.id,
    accountEmail: account.email,
    provider: 'imap',
    subject: parsed.subject || '(No subject)',
    sender: parsed.from?.text || addressText(parsed.from?.value),
    date: parsed.date?.toISOString() ?? '',
    unread: !item.flags?.has('\\Seen'),
    snippet: compact(parsed.text),
    body: parsed.text ?? compact(parsed.html?.toString()),
    originalBody: parsed.html ? String(parsed.html) : undefined,
    attachments: (parsed.attachments ?? []).map((attachment: any) => ({
      filename: attachment.filename ?? 'attachment',
      mimeType: attachment.contentType,
      attachmentId: attachment.checksum || attachment.contentId || attachment.filename || 'attachment',
      size: attachment.size
    }))
  };
}

export async function listImapEmailsForConnectedAccount(tenantId: string, userId: string, accountId: string, query = 'in:inbox', maxResults = 20) {
  const account = await getImapAccount(tenantId, userId, accountId);
  const parsed = parseQuery(query);
  return withClient(account, async (client) => {
    const lock = await client.getMailboxLock(parsed.mailbox);
    try {
      const exists = client.mailbox ? client.mailbox.exists : 0;
      if (!exists) return { messages: [], resultSizeEstimate: 0 };
      const start = Math.max(1, exists - Math.max(maxResults * 4, 40));
      const messages: EmailMessage[] = [];
      for await (const item of client.fetch(`${start}:*`, { uid: true, source: true, flags: true })) {
        messages.push(await mapFetchedMessage(account, item, parsed.mailbox));
      }
      const filtered = messages.reverse().filter((message) => matches(message, parsed)).slice(0, maxResults);
      return { messages: filtered, resultSizeEstimate: filtered.length };
    } finally {
      lock.release();
    }
  });
}

export async function getImapEmailForConnectedAccount(tenantId: string, userId: string, accountId: string, messageId: string) {
  const account = await getImapAccount(tenantId, userId, accountId);
  const { mailbox, uid } = splitImapMessageId(messageId);
  return withClient(account, async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      for await (const item of client.fetch(uid, { uid: true, source: true, flags: true }, { uid: true })) {
        return mapFetchedMessage(account, item, mailbox);
      }
      throw new HttpError(404, 'Email not found');
    } finally {
      lock.release();
    }
  });
}

export async function getImapAttachmentForConnectedAccount(tenantId: string, userId: string, accountId: string, messageId: string, attachmentId: string) {
  const email = await getImapEmailForConnectedAccount(tenantId, userId, accountId, messageId);
  const account = await getImapAccount(tenantId, userId, accountId);
  const { mailbox, uid } = splitImapMessageId(messageId);
  return withClient(account, async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      for await (const item of client.fetch(uid, { source: true }, { uid: true })) {
        if (!item.source) throw new HttpError(500, 'IMAP message source was empty');
        const parsed: any = await simpleParser(item.source as any);
        const attachment = (parsed.attachments ?? []).find((file: any) => (
          file.checksum === attachmentId || file.contentId === attachmentId || file.filename === attachmentId
        )) ?? (parsed.attachments ?? []).find((file: any) => file.filename === email.attachments?.[0]?.filename);
        if (!attachment) throw new HttpError(404, 'Attachment not found');
        return attachment.content;
      }
      throw new HttpError(404, 'Email not found');
    } finally {
      lock.release();
    }
  });
}

export async function archiveImapEmailForConnectedAccount(tenantId: string, userId: string, accountId: string, messageId: string) {
  const account = await getImapAccount(tenantId, userId, accountId);
  const { mailbox, uid } = splitImapMessageId(messageId);
  await withClient(account, async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      await client.messageMove(uid, 'Archive', { uid: true });
    } finally {
      lock.release();
    }
  });
}

export async function deleteImapEmailForConnectedAccount(tenantId: string, userId: string, accountId: string, messageId: string) {
  const account = await getImapAccount(tenantId, userId, accountId);
  const { mailbox, uid } = splitImapMessageId(messageId);
  await withClient(account, async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      await client.messageDelete(uid, { uid: true });
    } finally {
      lock.release();
    }
  });
}

export async function sendImapReplyForConnectedAccount(tenantId: string, userId: string, accountId: string, input: { to: string; subject: string; body: string }) {
  const account = await getImapAccount(tenantId, userId, accountId);
  const transport = nodemailer.createTransport({
    host: account.config.smtpHost,
    port: account.config.smtpPort,
    secure: account.config.smtpSecure,
    auth: { user: account.email, pass: account.password }
  });
  await transport.sendMail({
    from: account.email,
    to: input.to,
    subject: `Re: ${input.subject.replace(/^Re:\s*/i, '')}`,
    text: input.body
  });
  return { sent: true };
}
