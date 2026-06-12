import { checkFreeBusy, createEvent, deleteEvent, listEvents, detectConflicts, suggestAlternativeSlots, updateEvent } from '../services/calendarService.js';
import { createMicrosoftEvent, deleteMicrosoftEvent, listMicrosoftEvents, updateMicrosoftEvent } from '../services/microsoftCalendarService.js';
import { send } from '../utils/http.js';
export async function events(req, res, next) {
    try {
        if (req.user.provider === 'microsoft') {
            send(res, await listMicrosoftEvents(req.user.id, req.query.timeMin, req.query.timeMax));
            return;
        }
        send(res, await listEvents(req.user.id, req.query.timeMin, req.query.timeMax));
    }
    catch (error) {
        next(error);
    }
}
export async function create(req, res, next) {
    try {
        if (req.user.provider === 'microsoft') {
            send(res, await createMicrosoftEvent(req.user.id, req.body), 201);
            return;
        }
        send(res, await createEvent(req.user.id, req.body, Boolean(req.body.force)), 201);
    }
    catch (error) {
        next(error);
    }
}
export async function remove(req, res, next) {
    try {
        if (req.user.provider === 'microsoft') {
            await deleteMicrosoftEvent(req.user.id, req.params.id);
            send(res, { deleted: true });
            return;
        }
        await deleteEvent(req.user.id, req.params.id);
        send(res, { deleted: true });
    }
    catch (error) {
        next(error);
    }
}
export async function update(req, res, next) {
    try {
        if (req.user.provider === 'microsoft') {
            send(res, await updateMicrosoftEvent(req.user.id, req.params.id, req.body));
            return;
        }
        send(res, await updateEvent(req.user.id, req.params.id, req.body, Boolean(req.body.force)));
    }
    catch (error) {
        next(error);
    }
}
export async function availability(req, res, next) {
    try {
        const { start, end } = req.body;
        send(res, {
            conflicts: await detectConflicts(req.user.id, start, end),
            suggestions: await suggestAlternativeSlots(req.user.id, start, end)
        });
    }
    catch (error) {
        next(error);
    }
}
export async function freeBusy(req, res, next) {
    try {
        send(res, await checkFreeBusy(req.user.id, req.body.start, req.body.end, req.body.attendees));
    }
    catch (error) {
        next(error);
    }
}
