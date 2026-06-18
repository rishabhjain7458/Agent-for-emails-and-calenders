import type { NextFunction, Request, Response } from 'express';
import {
  checkFreeBusy,
  createEvent,
  createEventForConnectedAccount,
  deleteEvent,
  deleteEventForConnectedAccount,
  listEvents,
  listEventsForConnectedAccount,
  detectConflicts,
  suggestAlternativeSlots,
  updateEvent
} from '../services/calendarService.js';
import {
  createMicrosoftEvent,
  createMicrosoftEventForConnectedAccount,
  deleteMicrosoftEvent,
  deleteMicrosoftEventForConnectedAccount,
  listMicrosoftEvents,
  listMicrosoftEventsForConnectedAccount,
  updateMicrosoftEvent
} from '../services/microsoftCalendarService.js';
import { listAccountContexts, resolveAccountContext } from '../services/accountContextService.js';
import { HttpError, send } from '../utils/http.js';

function sortEvents(events: any[]) {
  return events.sort((a, b) => {
    const aValue = a.start?.dateTime ?? a.start?.date ?? a.start?.dateTime;
    const bValue = b.start?.dateTime ?? b.start?.date ?? b.start?.dateTime;
    return new Date(aValue).getTime() - new Date(bValue).getTime();
  });
}

function splitConnectedEventId(id: string) {
  const [accountId, ...rest] = id.split(':');
  return rest.length ? { accountId, eventId: rest.join(':') } : null;
}

export async function events(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = String(req.query.accountId ?? 'all');
    const accounts = accountId === 'all'
      ? await listAccountContexts(req.user!)
      : [await resolveAccountContext(req.user!, accountId)];

    const grouped = await Promise.all(accounts.map(async (account) => {
      if (account.provider === 'zoho' || account.provider === 'imap') return [];
      const eventsForAccount = account.provider === 'microsoft'
        ? account.isPrimary
          ? await listMicrosoftEvents(req.user!.id, req.query.timeMin as string, req.query.timeMax as string)
          : await listMicrosoftEventsForConnectedAccount(req.user!.tenantId, req.user!.id, account.accountId, account.email, req.query.timeMin as string, req.query.timeMax as string)
        : account.isPrimary
          ? await listEvents(req.user!.id, req.query.timeMin as string, req.query.timeMax as string)
          : await listEventsForConnectedAccount(req.user!.tenantId, req.user!.id, account.accountId, account.email, req.query.timeMin as string, req.query.timeMax as string);
      return eventsForAccount.map((event: any) => ({
        ...event,
        accountId: account.accountId,
        accountEmail: account.email,
        provider: account.provider
      }));
    }));

    send(res, sortEvents(grouped.flat()));
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const account = await resolveAccountContext(req.user!, req.body.accountId);
    if (account.provider === 'zoho' || account.provider === 'imap') throw new HttpError(400, 'Mail-only spaces do not support calendar events yet. Choose a Gmail or Outlook space.');
    const result = account.provider === 'microsoft'
      ? account.isPrimary
        ? await createMicrosoftEvent(req.user!.id, req.body)
        : await createMicrosoftEventForConnectedAccount(req.user!.tenantId, req.user!.id, account.accountId, req.body)
      : account.isPrimary
        ? await createEvent(req.user!.id, req.body, Boolean(req.body.force))
        : await createEventForConnectedAccount(req.user!.tenantId, req.user!.id, account.accountId, req.body);
    send(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const connectedId = splitConnectedEventId(req.params.id);
    if (connectedId) {
      const account = await resolveAccountContext(req.user!, connectedId.accountId);
      if (account.provider === 'zoho' || account.provider === 'imap') throw new HttpError(400, 'Mail-only spaces do not support calendar events yet.');
      if (account.provider === 'microsoft') await deleteMicrosoftEventForConnectedAccount(req.user!.tenantId, req.user!.id, account.accountId, connectedId.eventId);
      else await deleteEventForConnectedAccount(req.user!.tenantId, req.user!.id, account.accountId, connectedId.eventId);
      send(res, { deleted: true });
      return;
    }

    if (req.user!.provider === 'zoho') throw new HttpError(400, 'Zoho Mail spaces do not support calendar events yet.');
    if (req.user!.provider === 'microsoft') await deleteMicrosoftEvent(req.user!.id, req.params.id);
    else await deleteEvent(req.user!.id, req.params.id);
    send(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.provider === 'zoho') throw new HttpError(400, 'Zoho Mail spaces do not support calendar events yet.');
    if (req.user!.provider === 'microsoft') {
      send(res, await updateMicrosoftEvent(req.user!.id, req.params.id, req.body));
      return;
    }
    send(res, await updateEvent(req.user!.id, req.params.id, req.body, Boolean(req.body.force)));
  } catch (error) {
    next(error);
  }
}

export async function availability(req: Request, res: Response, next: NextFunction) {
  try {
    const { start, end } = req.body;
    send(res, {
      conflicts: await detectConflicts(req.user!.id, start, end),
      suggestions: await suggestAlternativeSlots(req.user!.id, start, end)
    });
  } catch (error) {
    next(error);
  }
}

export async function freeBusy(req: Request, res: Response, next: NextFunction) {
  try {
    send(res, await checkFreeBusy(req.user!.id, req.body.start, req.body.end, req.body.attendees));
  } catch (error) {
    next(error);
  }
}
