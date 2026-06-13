import { google } from 'googleapis';
import { getAuthorizedGoogleClient } from './googleAuthService.js';

export async function listGoogleTasks(userId: string) {
  const auth = await getAuthorizedGoogleClient(userId);
  const tasks = google.tasks({ version: 'v1', auth });
  const taskListsResponse = await tasks.tasklists.list({ maxResults: 100 });
  const taskLists = taskListsResponse.data.items?.length ? taskListsResponse.data.items : [{ id: '@default' }];
  const items = [];

  for (const taskList of taskLists) {
    if (!taskList.id) continue;
    let pageToken: string | undefined;

    do {
      const response = await tasks.tasks.list({
        tasklist: taskList.id,
        maxResults: 100,
        pageToken,
        showCompleted: true,
        showDeleted: false,
        showHidden: true
      });
      items.push(...(response.data.items ?? []).map((item) => ({ ...item, taskListId: taskList.id })));
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
  }

  return items;
}

export async function createGoogleTask(userId: string, title: string, dueDate?: string | null) {
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

export async function completeGoogleTask(userId: string, taskId: string, taskListId = '@default') {
  const auth = await getAuthorizedGoogleClient(userId);
  const tasks = google.tasks({ version: 'v1', auth });
  const existing = await tasks.tasks.get({ tasklist: taskListId, task: taskId });
  const response = await tasks.tasks.update({
    tasklist: taskListId,
    task: taskId,
    requestBody: {
      ...existing.data,
      status: 'completed',
      completed: new Date().toISOString()
    }
  });
  return response.data;
}

export async function deleteGoogleTask(userId: string, taskId: string, taskListId = '@default') {
  const auth = await getAuthorizedGoogleClient(userId);
  const tasks = google.tasks({ version: 'v1', auth });
  await tasks.tasks.delete({ tasklist: taskListId, task: taskId });
}
