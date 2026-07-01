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
  updateEvent,
  updateEventForConnectedAccount
} from '../services/calendarService.js';
import {
  createMicrosoftEvent,
  createMicrosoftEventForConnectedAccount,
  deleteMicrosoftEvent,
  deleteMicrosoftEventForConnectedAccount,
  listMicrosoftEvents,
  listMicrosoftEventsForConnectedAccount,
  updateMicrosoftEvent,
  updateMicrosoftEventForConnectedAccount
} from '../services/microsoftCalendarService.js';
import { listAccountContexts, resolveAccountContext } from '../services/accountContextService.js';
import { HttpError, send } from '../utils/http.js';

function sortEvents(events: any[]) {
  return events.sort((a, b) => {
    const aValue = a.start?.dateTime ?? a.start?.date;
    const bValue = b.start?.dateTime ?? b.start?.date;
    return new Date(aValue).getTime() - new Date(bValue).getTime();
  });
}

function splitConnectedEventId(id: string) {
  const [accountId, ...rest] = id.split(':');
  return rest.length ? { accountId, eventId: rest.join(':') } : null;
}

async function deleteCalendarEventForAccount(user: NonNullable<Express.Request['user']>, accountId: string, eventId: string) {
  const account = await resolveAccountContext(user, accountId);
  if (account.provider === 'zoho' || account.provider === 'imap') throw new HttpError(400, 'Mail-only spaces do not support calendar events yet.');
  if (account.provider === 'microsoft') {
    if (account.isPrimary) await deleteMicrosoftEvent(user.id, eventId);
    else await deleteMicrosoftEventForConnectedAccount(user.tenantId, user.id, account.accountId, eventId);
    return;
  }
  if (account.isPrimary) await deleteEvent(user.id, eventId);
  else await deleteEventForConnectedAccount(user.tenantId, user.id, account.accountId, eventId);
}

async function updateCalendarEventForAccount(user: NonNullable<Express.Request['user']>, accountId: string, eventId: string, input: any) {
  const account = await resolveAccountContext(user, accountId);
  if (account.provider === 'zoho' || account.provider === 'imap') throw new HttpError(400, 'Mail-only spaces do not support calendar events yet.');
  if (account.provider === 'microsoft') {
    return account.isPrimary
      ? updateMicrosoftEvent(user.id, eventId, input)
      : updateMicrosoftEventForConnectedAccount(user.tenantId, user.id, account.accountId, eventId, input);
  }
  return account.isPrimary
    ? updateEvent(user.id, eventId, input, Boolean(input.force))
    : updateEventForConnectedAccount(user.tenantId, user.id, account.accountId, eventId, input);
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
    const requestedAccountId = req.query.accountId ? String(req.query.accountId) : '';
    if (requestedAccountId && requestedAccountId !== 'all') {
      const connectedId = splitConnectedEventId(req.params.id);
      const eventId = connectedId?.accountId === requestedAccountId ? connectedId.eventId : req.params.id;
      await deleteCalendarEventForAccount(req.user!, requestedAccountId, eventId);
      send(res, { deleted: true });
      return;
    }

    const connectedId = splitConnectedEventId(req.params.id);
    if (connectedId) {
      await deleteCalendarEventForAccount(req.user!, connectedId.accountId, connectedId.eventId);
      send(res, { deleted: true });
      return;
    }

    await deleteCalendarEventForAccount(req.user!, 'primary', req.params.id);
    send(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const requestedAccountId = req.body.accountId ? String(req.body.accountId) : '';
    const connectedId = splitConnectedEventId(req.params.id);
    const accountId = requestedAccountId || connectedId?.accountId || 'primary';
    const eventId = connectedId?.accountId === accountId ? connectedId.eventId : req.params.id;
    send(res, await updateCalendarEventForAccount(req.user!, accountId, eventId, req.body));
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
