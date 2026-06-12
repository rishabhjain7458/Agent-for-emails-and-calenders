import { getSettings, updateSettings } from '../repositories/settingsRepository.js';
import { send } from '../utils/http.js';
export async function show(req, res, next) {
    try {
        send(res, await getSettings(req.user.tenantId, req.user.id));
    }
    catch (error) {
        next(error);
    }
}
export async function update(req, res, next) {
    try {
        send(res, await updateSettings(req.user.tenantId, req.user.id, req.body));
    }
    catch (error) {
        next(error);
    }
}
