import type { NextFunction, Request, Response } from 'express';
import { archiveEmail, archiveEmailForConnectedAccount, deleteEmail, deleteEmailForConnectedAccount, getEmail, getEmailForConnectedAccount, getThread, listEmails, listEmailsForConnectedAccount, sendReply } from '../services/emailService.js';
import { archiveMicrosoftEmail, archiveMicrosoftEmailForConnectedAccount, deleteMicrosoftEmail, deleteMicrosoftEmailForConnectedAccount, getMicrosoftEmail, getMicrosoftEmailForConnectedAccount, listMicrosoftEmails, listMicrosoftEmailsForConnectedAccount, sendMicrosoftReply } from '../services/microsoftEmailService.js';
import { generateEmailReply, generateEmailSummary, generateSingleEmailSummary } from '../services/geminiService.js';
import { saveDraft } from '../repositories/draftRepository.js';
import { getConnectedAccount, listConnectedAccounts } from '../repositories/connectedAccountRepository.js';
import { send } from '../utils/http.js';
import type { EmailMessage } from '../types.js';
import { normalizeInboxQuery } from '../utils/emailQuery.js';

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
  }

  return req.user!.provider === 'microsoft'
    ? getMicrosoftEmail(req.user!.id, id)
    : getEmail(req.user!.id, id);
}

async function archiveEmailForRequest(req: Request, id: string) {
  const connectedId = splitConnectedMessageId(id);
  if (connectedId) {
    const account = await getConnectedAccount(req.user!.tenantId, req.user!.id, connectedId.accountId);
    if (account?.provider === 'microsoft') return archiveMicrosoftEmailForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, connectedId.messageId);
    if (account?.provider === 'google') return archiveEmailForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, connectedId.messageId);
  }

  return req.user!.provider === 'microsoft'
    ? archiveMicrosoftEmail(req.user!.id, id)
    : archiveEmail(req.user!.id, id);
}

async function deleteEmailForRequest(req: Request, id: string) {
  const connectedId = splitConnectedMessageId(id);
  if (connectedId) {
    const account = await getConnectedAccount(req.user!.tenantId, req.user!.id, connectedId.accountId);
    if (account?.provider === 'microsoft') return deleteMicrosoftEmailForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, connectedId.messageId);
    if (account?.provider === 'google') return deleteEmailForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, connectedId.messageId);
  }

  return req.user!.provider === 'microsoft'
    ? deleteMicrosoftEmail(req.user!.id, id)
    : deleteEmail(req.user!.id, id);
}

export async function inbox(req: Request, res: Response, next: NextFunction) {
  try {
    const query = normalizeInboxQuery(String(req.query.q ?? 'in:inbox'));
    const limit = Number(req.query.limit ?? 20);
    const selectedAccountId = String(req.query.accountId ?? 'all');
    const connectedAccounts = await listConnectedAccounts(req.user!.tenantId, req.user!.id);
    const includePrimary = selectedAccountId === 'all' || selectedAccountId === 'primary';
    const selectedConnected = selectedAccountId === 'all'
      ? connectedAccounts
      : connectedAccounts.filter((account) => account.id === selectedAccountId);
    const mailboxes: Promise<EmailMessage[]>[] = [];

    if (includePrimary) {
      mailboxes.push((async () => {
        const result = req.user!.provider === 'microsoft'
          ? await listMicrosoftEmails(req.user!.id, query, limit)
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
          ? await listMicrosoftEmailsForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, account.email, query, limit)
          : await listEmailsForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, account.email, query, limit);
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

export async function summary(req: Request, res: Response, next: NextFunction) {
  try {
    const query = normalizeInboxQuery(String(req.query.q ?? 'newer_than:14d'));
    const connectedAccounts = await listConnectedAccounts(req.user!.tenantId, req.user!.id);
    const primary = req.user!.provider === 'microsoft'
      ? await listMicrosoftEmails(req.user!.id, query, 20)
      : await listEmails(req.user!.id, query, 20);
    const connected = await Promise.all(connectedAccounts.map(async (account) => {
      const result = account.provider === 'microsoft'
        ? await listMicrosoftEmailsForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, account.email, query, 20)
        : await listEmailsForConnectedAccount(req.user!.tenantId, req.user!.id, account.id, account.email, query, 20);
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

export async function emailSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const email = await getEmailForRequest(req, req.params.id);
    send(res, { summary: await generateSingleEmailSummary(req.user!.tenantId, req.user!.id, email) });
  } catch (error) {
    next(error);
  }
}

export async function thread(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.provider === 'microsoft') {
      send(res, [await getMicrosoftEmail(req.user!.id, req.params.threadId)]);
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
    if (req.user!.provider === 'microsoft') {
      send(res, await sendMicrosoftReply(req.user!.id, req.body));
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
