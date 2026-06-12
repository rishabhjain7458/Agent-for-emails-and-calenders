import type { NextFunction, Request, Response } from 'express';
import { archiveEmail, deleteEmail, getEmail, getThread, listEmails, sendReply } from '../services/emailService.js';
import { archiveMicrosoftEmail, deleteMicrosoftEmail, getMicrosoftEmail, listMicrosoftEmails, sendMicrosoftReply } from '../services/microsoftEmailService.js';
import { generateEmailReply, generateEmailSummary, generateSingleEmailSummary } from '../services/geminiService.js';
import { saveDraft } from '../repositories/draftRepository.js';
import { send } from '../utils/http.js';

export async function inbox(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.provider === 'microsoft') {
      send(res, await listMicrosoftEmails(req.user!.id, String(req.query.q ?? 'in:inbox'), Number(req.query.limit ?? 20)));
      return;
    }
    send(res, await listEmails(req.user!.id, String(req.query.q ?? 'in:inbox'), Number(req.query.limit ?? 20), req.query.pageToken as string | undefined));
  } catch (error) {
    next(error);
  }
}

export async function detail(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.provider === 'microsoft') {
      send(res, await getMicrosoftEmail(req.user!.id, req.params.id));
      return;
    }
    send(res, await getEmail(req.user!.id, req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function summary(req: Request, res: Response, next: NextFunction) {
  try {
    const emails = req.user!.provider === 'microsoft'
      ? await listMicrosoftEmails(req.user!.id, String(req.query.q ?? 'in:inbox newer_than:14d'), 20)
      : await listEmails(req.user!.id, String(req.query.q ?? 'in:inbox newer_than:14d'), 20);
    send(res, { summary: await generateEmailSummary(req.user!.tenantId, req.user!.id, emails.messages) });
  } catch (error) {
    next(error);
  }
}

export async function draftReply(req: Request, res: Response, next: NextFunction) {
  try {
    const email = req.user!.provider === 'microsoft'
      ? await getMicrosoftEmail(req.user!.id, req.params.id)
      : await getEmail(req.user!.id, req.params.id);
    send(res, { draft: await generateEmailReply(req.user!.tenantId, req.user!.id, email, req.body.tone), email });
  } catch (error) {
    next(error);
  }
}

export async function emailSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const email = req.user!.provider === 'microsoft'
      ? await getMicrosoftEmail(req.user!.id, req.params.id)
      : await getEmail(req.user!.id, req.params.id);
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
    if (req.user!.provider === 'microsoft') {
      await archiveMicrosoftEmail(req.user!.id, req.params.id);
      send(res, { archived: true });
      return;
    }
    await archiveEmail(req.user!.id, req.params.id);
    send(res, { archived: true });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.provider === 'microsoft') {
      await deleteMicrosoftEmail(req.user!.id, req.params.id);
      send(res, { deleted: true });
      return;
    }
    await deleteEmail(req.user!.id, req.params.id);
    send(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}
