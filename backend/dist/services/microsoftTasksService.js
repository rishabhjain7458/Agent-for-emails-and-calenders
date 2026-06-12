import axios from 'axios';
import { getMicrosoftAccessToken } from './microsoftAuthService.js';
const graph = 'https://graph.microsoft.com/v1.0';
export async function listMicrosoftTasks(userId) {
    const token = await getMicrosoftAccessToken(userId);
    const { data: lists } = await axios.get(`${graph}/me/todo/lists`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const items = [];
    for (const list of lists.value ?? []) {
        const { data } = await axios.get(`${graph}/me/todo/lists/${list.id}/tasks`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { '$top': 100 }
        });
        items.push(...(data.value ?? []));
    }
    return items;
}
export async function createMicrosoftTask(userId, title, dueDate) {
    const token = await getMicrosoftAccessToken(userId);
    const { data: lists } = await axios.get(`${graph}/me/todo/lists`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const defaultList = lists.value?.[0];
    if (!defaultList?.id)
        throw new Error('No Microsoft To Do list was found.');
    const { data } = await axios.post(`${graph}/me/todo/lists/${defaultList.id}/tasks`, {
        title,
        dueDateTime: dueDate ? { dateTime: `${dueDate}T00:00:00`, timeZone: 'UTC' } : undefined
    }, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return data;
}
