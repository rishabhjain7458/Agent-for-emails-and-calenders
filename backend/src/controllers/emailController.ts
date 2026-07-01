import type { NextFunction, Request, Response } from 'express';
import { archiveEmail, archiveEmailForConnectedAccount, deleteEmail, deleteEmailForConnectedAccount, getEmail, getEmailAttachment, getEmailAttachmentForConnectedAccount, getEmailForConnectedAccount, getThread, getThreadForConnectedAccount, listEmails, listEmailsForConnectedAccount, sendReply, sendReplyForConnectedAccount, setEmailUnread, setEmailUnreadForConnectedAccount } from '../services/emailService.js';
import { archiveMicrosoftEmail, archiveMicrosoftEmailForConnectedAccount, deleteMicrosoftEmail, deleteMicrosoftEmailForConnectedAccount, getMicrosoftAttachment, getMicrosoftAttachmentForConnectedAccount, getMicrosoftEmail, getMicrosoftEmailForConnectedAccount, listMicrosoftEmails, listMicrosoftEmailsForConnectedAccount, sendMicrosoftReply, setMicrosoftEmailUnread, setMicrosoftEmailUnreadForConnectedAccount } from '../services/microsoftEmailService.js';
import { archiveZohoEmail, archiveZohoEmailForConnectedAccount, deleteZohoEmail, deleteZohoEmailForConnectedAccount, getZohoAttachment, getZohoAttachmentForConnectedAccount, getZohoEmail, getZohoEmailForConnectedAccount, listZohoEmails, listZohoEmailsForConnectedAccount, sendZohoReply, sendZohoReplyForConnectedAccount, setZohoEmailUnread, setZohoEmailUnreadForConnectedAccount } from '../services/zohoEmailService.js';
import { archiveImapEmailForConnectedAccount, deleteImapEmailForConnectedAccount, getImapAttachmentForConnectedAccount, getImapEmailForConnectedAccount, listImapEmailsForConnectedAccount, sendImapReplyForConnectedAccount, setImapEmailUnreadForConnectedAccount } from '../services/imapEmailService.js';
import { extractMeetingFromEmail, generateEmailReply, generateEmailSummary, generateSingleEmailSummary, refineEmailReply } from '../services/geminiService.js';
import { saveDraft } from '../repositories/draftRepository.js';
import { getSettings } from '../repositories/settingsRepository.js';
import { getConnectedAccount } from '../repositories/connectedAccountRepository.js';
import { HttpError, send } from '../utils/http.js';
import type { EmailMessage } from '../types.js';
import { normalizeInboxQuery } from '../utils/emailQuery.js';
import { listAccountContexts } from '../services/accountContextService.js';

function sortByDateDesc(messages: EmailMessage[]) {
  return messages.sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });
}

function splitConnectedMessageId(id: string) {
  const [accountId, ...rest] = id.split(':');
  return rest.length ? { accountId, messageId: rest.join(':') } : null;
}

async function getEmailForRequest(req: Request, id: string) {
  const connectedId = splitConnectedMessageId(id);
  if (connectedId) {
    const account = await getConnectedAccount(req.user!.tenantId, req.user!.id, connectedId.accountId);
    if (account?.provider === 'microsoft') {
      return getMicrosoftEmailForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, account.email, connectedId.messageId);
    }
    if (account?.provider === 'google') {
      return getEmailForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, account.email, connectedId.messageId);
    }
    if (account?.provider === 'zoho') {
      return getZohoEmailForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, account.email, account.provider_account_id, connectedId.messageId);
    }
    if (account?.provider === 'imap') {
      return getImapEmailForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, connectedId.messageId);
    }
  }

  if (req.user!.provider === 'microsoft') return getMicrosoftEmail(req.user!.id, id);
  if (req.user!.provider === 'zoho') return getZohoEmail(req.user!.id, id);
  return getEmail(req.user!.id, id);
}

async function archiveEmailForRequest(req: Request, id: string) {
  const connectedId = splitConnectedMessageId(id);
  if (connectedId) {
    const account = await getConnectedAccount(req.user!.tenantId, req.user!.id, connectedId.accountId);
    if (account?.provider === 'microsoft') return archiveMicrosoftEmailForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, connectedId.messageId);
    if (account?.provider === 'google') return archiveEmailForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, connectedId.messageId);
    if (account?.provider === 'zoho') return archiveZohoEmailForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, account.provider_account_id, connectedId.messageId);
    if (account?.provider === 'imap') return archiveImapEmailForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, connectedId.messageId);
  }

  if (req.user!.provider === 'microsoft') return archiveMicrosoftEmail(req.user!.id, id);
  if (req.user!.provider === 'zoho') return archiveZohoEmail(req.user!.id, id);
  return archiveEmail(req.user!.id, id);
}

async function deleteEmailForRequest(req: Request, id: string) {
  const connectedId = splitConnectedMessageId(id);
  if (connectedId) {
    const account = await getConnectedAccount(req.user!.tenantId, req.user!.id, connectedId.accountId);
    if (account?.provider === 'microsoft') return deleteMicrosoftEmailForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, connectedId.messageId);
    if (account?.provider === 'google') return deleteEmailForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, connectedId.messageId);
    if (account?.provider === 'zoho') return deleteZohoEmailForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, account.provider_account_id, connectedId.messageId);
    if (account?.provider === 'imap') return deleteImapEmailForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, connectedId.messageId);
  }

  if (req.user!.provider === 'microsoft') return deleteMicrosoftEmail(req.user!.id, id);
  if (req.user!.provider === 'zoho') return deleteZohoEmail(req.user!.id, id);
  return deleteEmail(req.user!.id, id);
}

async function setEmailUnreadForRequest(req: Request, id: string, unread: boolean) {
  const connectedId = splitConnectedMessageId(id);
  if (connectedId) {
    const account = await getConnectedAccount(req.user!.tenantId, req.user!.id, connectedId.accountId);
    if (account?.provider === 'microsoft') return setMicrosoftEmailUnreadForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, connectedId.messageId, unread);
    if (account?.provider === 'google') return setEmailUnreadForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, connectedId.messageId, unread);
    if (account?.provider === 'zoho') return setZohoEmailUnreadForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, account.provider_account_id, connectedId.messageId, unread);
    if (account?.provider === 'imap') return setImapEmailUnreadForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, connectedId.messageId, unread);
  }

  if (req.user!.provider === 'microsoft') return setMicrosoftEmailUnread(req.user!.id, id, unread);
  if (req.user!.provider === 'zoho') return setZohoEmailUnread(req.user!.id, id, unread);
  if (req.user!.provider === 'imap') throw new HttpError(400, 'Primary IMAP accounts are not supported for read-state changes.');
  return setEmailUnread(req.user!.id, id, unread);
}

function emailReceivingAccount(req: Request, id: string) {
  const connectedId = splitConnectedMessageId(id);
  return connectedId ? connectedId.accountId : 'primary';
}

function preferredTimezone(value?: string | null) {
  return !value || value === 'UTC' ? 'Asia/Kolkata' : value;
}

function validMeetingDraft(draft: any) {
  return Boolean(
    draft?.title &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(draft.date ?? '')) &&
    /^\d{2}:\d{2}$/.test(String(draft.startTime ?? '')) &&
    /^\d{2}:\d{2}$/.test(String(draft.endTime ?? ''))
  );
}

async function getAttachmentForRequest(req: Request, id: string, attachmentId: string) {
  const connectedId = splitConnectedMessageId(id);
  if (connectedId) {
    const account = await getConnectedAccount(req.user!.tenantId, req.user!.id, connectedId.accountId);
    if (account?.provider === 'microsoft') return getMicrosoftAttachmentForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, connectedId.messageId, attachmentId);
    if (account?.provider === 'google') return getEmailAttachmentForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, connectedId.messageId, attachmentId);
    if (account?.provider === 'zoho') return getZohoAttachmentForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, account.provider_account_id, connectedId.messageId, attachmentId);
    if (account?.provider === 'imap') return getImapAttachmentForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, connectedId.messageId, attachmentId);
  }

  if (req.user!.provider === 'microsoft') return getMicrosoftAttachment(req.user!.id, id, attachmentId);
  if (req.user!.provider === 'zoho') return getZohoAttachment(req.user!.id, id, attachmentId);
  return getEmailAttachment(req.user!.id, id, attachmentId);
}

export async function inbox(req: Request, res: Response, next: NextFunction) {
  try {
    const query = normalizeInboxQuery(String(req.query.q ?? 'in:inbox'));
    const limit = Number(req.query.limit ?? 20);
    const selectedAccountId = String(req.query.accountId ?? 'all');
    const accounts = await listAccountContexts(req.user!);
    const includePrimary = selectedAccountId === 'all' || selectedAccountId === 'primary';
    const selectedConnected = selectedAccountId === 'all'
      ? accounts.filter((account) => !account.isPrimary)
      : accounts.filter((account) => account.accountId === selectedAccountId && !account.isPrimary);
    const mailboxes: Promise<EmailMessage[]>[] = [];

    if (includePrimary) {
      mailboxes.push((async () => {
        const result = req.user!.provider === 'microsoft'
          ? await listMicrosoftEmails(req.user!.id, query, limit)
          : req.user!.provider === 'zoho'
            ? await listZohoEmails(req.user!.id, query, limit)
          : await listEmails(req.user!.id, query, limit, req.query.pageToken as string | undefined);
        return result.messages.map((message: EmailMessage) => ({
          ...message,
          accountEmail: req.user!.email,
          provider: req.user!.provider
        }));
      })());
    }

    for (const account of selectedConnected) {
      mailboxes.push((async () => {
        const result = account.provider === 'microsoft'
          ? await listMicrosoftEmailsForConnectedAccount(req.user!.tenantId, req.user!.id, account.accountId, account.email, query, limit)
          : account.provider === 'zoho'
            ? await listZohoEmailsForConnectedAccount(req.user!.tenantId, req.user!.id, account.accountId, account.email, account.providerAccountId!, query, limit)
          : account.provider === 'imap'
            ? await listImapEmailsForConnectedAccount(req.user!.tenantId, req.user!.id, account.accountId, query, limit)
          : await listEmailsForConnectedAccount(req.user!.tenantId, req.user!.id, account.accountId, account.email, query, limit);
        return result.messages;
      })());
    }

    if (mailboxes.length) {
      const messages = sortByDateDesc((await Promise.all(mailboxes)).flat()).slice(0, limit * Math.max(mailboxes.length, 1));
      send(res, { messages, resultSizeEstimate: messages.length });
      return;
    }

    if (req.user!.provider === 'microsoft') {
      send(res, await listMicrosoftEmails(req.user!.id, query, limit));
      return;
    }
    if (req.user!.provider === 'zoho') {
      send(res, await listZohoEmails(req.user!.id, query, limit));
      return;
    }
    send(res, await listEmails(req.user!.id, query, limit, req.query.pageToken as string | undefined));
  } catch (error) {
    next(error);
  }
}

export async function detail(req: Request, res: Response, next: NextFunction) {
  try {
    send(res, await getEmailForRequest(req, req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function attachment(req: Request, res: Response, next: NextFunction) {
  try {
    const email = await getEmailForRequest(req, req.params.id);
    const file = email.attachments?.find((item) => item.attachmentId === req.params.attachmentId);
    const bytes = await getAttachmentForRequest(req, req.params.id, req.params.attachmentId);
    const filename = file?.filename ?? 'attachment';
    res.setHeader('Content-Type', file?.mimeType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`);
    res.send(bytes);
  } catch (error) {
    next(error);
  }
}

export async function summary(req: Request, res: Response, next: NextFunction) {
  try {
    const query = normalizeInboxQuery(String(req.query.q ?? 'newer_than:14d'));
    const connectedAccounts = (await listAccountContexts(req.user!)).filter((account) => !account.isPrimary);
    const primary = req.user!.provider === 'microsoft'
      ? await listMicrosoftEmails(req.user!.id, query, 20)
      : req.user!.provider === 'zoho'
        ? await listZohoEmails(req.user!.id, query, 20)
        : await listEmails(req.user!.id, query, 20);
    const connected = await Promise.all(connectedAccounts.map(async (account) => {
      const result = account.provider === 'microsoft'
        ? await listMicrosoftEmailsForConnectedAccount(req.user!.tenantId, req.user!.id, account.accountId, account.email, query, 20)
        : account.provider === 'zoho'
          ? await listZohoEmailsForConnectedAccount(req.user!.tenantId, req.user!.id, account.accountId, account.email, account.providerAccountId!, query, 20)
        : account.provider === 'imap'
          ? await listImapEmailsForConnectedAccount(req.user!.tenantId, req.user!.id, account.accountId, query, 20)
        : await listEmailsForConnectedAccount(req.user!.tenantId, req.user!.id, account.accountId, account.email, query, 20);
      return result.messages;
    }));
    send(res, { summary: await generateEmailSummary(req.user!.tenantId, req.user!.id, sortByDateDesc([...primary.messages, ...connected.flat()]).slice(0, 30)) });
  } catch (error) {
    next(error);
  }
}

export async function draftReply(req: Request, res: Response, next: NextFunction) {
  try {
    const email = await getEmailForRequest(req, req.params.id);
    send(res, { draft: await generateEmailReply(req.user!.tenantId, req.user!.id, email, req.body.tone), email });
  } catch (error) {
    next(error);
  }
}

export async function refineReply(req: Request, res: Response, next: NextFunction) {
  try {
    const email = await getEmailForRequest(req, req.params.id);
    send(res, {
      draft: await refineEmailReply(req.user!.tenantId, req.user!.id, email, req.body.draft, req.body.instruction),
      email
    });
  } catch (error) {
    next(error);
  }
}

export async function emailSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const email = await getEmailForRequest(req, req.params.id);
    send(res, { summary: await generateSingleEmailSummary(req.user!.tenantId, req.user!.id, email) });
  } catch (error) {
    next(error);
  }
}

export async function aiMeetingDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const email = await getEmailForRequest(req, req.params.id);
    const settings = await getSettings(req.user!.tenantId, req.user!.id);
    const timezone = preferredTimezone(settings.timezone);
    const rawDraft = await extractMeetingFromEmail(req.user!.tenantId, req.user!.id, email, timezone);
    const accountId = emailReceivingAccount(req, req.params.id);
    const provider = email.provider ?? req.user!.provider;
    const calendarSupported = provider !== 'zoho' && provider !== 'imap';
    const draft = {
      title: rawDraft.title || email.subject || 'Meeting from email',
      date: rawDraft.date || '',
      startTime: rawDraft.startTime || '',
      endTime: rawDraft.endTime || '',
      timezone: rawDraft.timezone && rawDraft.timezone !== 'UTC' ? rawDraft.timezone : timezone,
      description: rawDraft.description || [
        `Created from email: ${email.subject}`,
        `From: ${email.sender}`,
        email.snippet ? `Preview: ${email.snippet}` : ''
      ].filter(Boolean).join('\n'),
      attendees: Array.isArray(rawDraft.attendees) ? rawDraft.attendees.filter((item: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)) : [],
      missing: Array.isArray(rawDraft.missing) ? rawDraft.missing.filter((item: string) => item !== 'timezone') : [],
      confidence: Number(rawDraft.confidence ?? 0.6),
      reason: calendarSupported
        ? rawDraft.reason || 'Drafted from the selected email.'
        : 'This email belongs to a mail-only account. The meeting details can be reviewed, but calendar creation is only available for Gmail or Outlook spaces.'
    };
    send(res, {
      accountId,
      accountEmail: email.accountEmail ?? req.user!.email,
      provider,
      canCreate: calendarSupported && validMeetingDraft(draft) && draft.confidence >= 0.35 && draft.missing.length === 0,
      draft,
      sourceEmail: {
        id: email.id,
        subject: email.subject,
        sender: email.sender,
        date: email.date
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function thread(req: Request, res: Response, next: NextFunction) {
  try {
    const connectedId = splitConnectedMessageId(req.params.threadId);
    if (connectedId) {
      const account = await getConnectedAccount(req.user!.tenantId, req.user!.id, connectedId.accountId);
      if (account?.provider === 'google') {
        send(res, await getThreadForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, account.email, connectedId.messageId));
        return;
      }
      send(res, [await getEmailForRequest(req, req.params.threadId)]);
      return;
    }
    if (req.user!.provider === 'microsoft') {
      send(res, [await getMicrosoftEmail(req.user!.id, req.params.threadId)]);
      return;
    }
    if (req.user!.provider === 'zoho') {
      send(res, [await getZohoEmail(req.user!.id, req.params.threadId)]);
      return;
    }
    send(res, await getThread(req.user!.id, req.params.threadId));
  } catch (error) {
    next(error);
  }
}

export async function saveEmailDraft(req: Request, res: Response, next: NextFunction) {
  try {
    send(res, await saveDraft({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      gmailMessageId: req.params.id,
      gmailThreadId: req.body.threadId,
      subject: req.body.subject,
      body: req.body.body
    }), 201);
  } catch (error) {
    next(error);
  }
}

export async function sendEmailReply(req: Request, res: Response, next: NextFunction) {
  try {
    const sourceId = String(req.body.messageId ?? '');
    const connectedId = sourceId ? splitConnectedMessageId(sourceId) : null;
    if (connectedId) {
      const account = await getConnectedAccount(req.user!.tenantId, req.user!.id, connectedId.accountId);
      if (account?.provider === 'microsoft') {
        send(res, await sendMicrosoftReply(req.user!.id, { ...req.body, threadId: connectedId.messageId }));
        return;
      }
      if (account?.provider === 'google') {
        send(res, await sendReplyForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, { ...req.body, threadId: connectedId.messageId }));
        return;
      }
      if (account?.provider === 'zoho') {
        send(res, await sendZohoReplyForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, account.provider_account_id, req.body));
        return;
      }
      if (account?.provider === 'imap') {
        send(res, await sendImapReplyForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, req.body));
        return;
      }
    }

    if (req.user!.provider === 'microsoft') {
      send(res, await sendMicrosoftReply(req.user!.id, req.body));
      return;
    }
    if (req.user!.provider === 'zoho') {
      send(res, await sendZohoReply(req.user!.id, req.body));
      return;
    }
    send(res, await sendReply(req.user!.id, req.body));
  } catch (error) {
    next(error);
  }
}

export async function archive(req: Request, res: Response, next: NextFunction) {
  try {
    await archiveEmailForRequest(req, req.params.id);
    send(res, { archived: true });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteEmailForRequest(req, req.params.id);
    send(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

export async function readState(req: Request, res: Response, next: NextFunction) {
  try {
    await setEmailUnreadForRequest(req, req.params.id, Boolean(req.body.unread));
    send(res, { unread: Boolean(req.body.unread) });
  } catch (error) {
    next(error);
  }
}
