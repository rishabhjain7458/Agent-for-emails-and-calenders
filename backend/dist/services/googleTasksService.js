import { google } from 'googleapis';
import { getAuthorizedGoogleClient } from './googleAuthService.js';
export async function listGoogleTasks(userId) {
    const auth = await getAuthorizedGoogleClient(userId);
    const tasks = google.tasks({ version: 'v1', auth });
    const taskListsResponse = await tasks.tasklists.list({ maxResults: 100 });
    const taskLists = taskListsResponse.data.items?.length ? taskListsResponse.data.items : [{ id: '@default' }];
    const items = [];
    for (const taskList of taskLists) {
        if (!taskList.id)
            continue;
        let pageToken;
        do {
            const response = await tasks.tasks.list({
                tasklist: taskList.id,
                maxResults: 100,
                pageToken,
                showCompleted: true,
                showDeleted: false,
                showHidden: true
            });
            items.push(...(response.data.items ?? []));
            pageToken = response.data.nextPageToken ?? undefined;
        } while (pageToken);
    }
    return items;
}
export async function createGoogleTask(userId, title, dueDate) {
    const auth = await getAuthorizedGoogleClient(userId);
    const tasks = google.tasks({ version: 'v1', auth });
    const response = await tasks.tasks.insert({
        tasklist: '@default',
        requestBody: {
            title,
            due: dueDate ? new Date(dueDate).toISOString() : undefined
        }
    });
    return response.data;
}
