import axios from 'axios';
import { getMicrosoftAccessToken, getMicrosoftAccessTokenForConnectedAccount } from './microsoftAuthService.js';

const graph = 'https://graph.microsoft.com/v1.0';

async function listMicrosoftTasksWithToken(token: string) {
  const { data: lists } = await axios.get(`${graph}/me/todo/lists`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const items = [];

  for (const list of lists.value ?? []) {
    const { data } = await axios.get(`${graph}/me/todo/lists/${list.id}/tasks`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { '$top': 100 }
    });
    items.push(...(data.value ?? []).map((item: any) => ({ ...item, taskListId: list.id })));
  }

  return items;
}

export async function listMicrosoftTasks(userId: string) {
  const token = await getMicrosoftAccessToken(userId);
  return listMicrosoftTasksWithToken(token);
}

export async function listMicrosoftTasksForConnectedAccount(tenantId: string, userId: string, accountId: string) {
  const token = await getMicrosoftAccessTokenForConnectedAccount(tenantId, userId, accountId);
  return listMicrosoftTasksWithToken(token);
}

async function createMicrosoftTaskWithToken(token: string, title: string, dueDate?: string | null) {
  const { data: lists } = await axios.get(`${graph}/me/todo/lists`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const defaultList = lists.value?.[0];
  if (!defaultList?.id) throw new Error('No Microsoft To Do list was found.');
  const { data } = await axios.post(`${graph}/me/todo/lists/${defaultList.id}/tasks`, {
    title,
    dueDateTime: dueDate ? { dateTime: `${dueDate}T00:00:00`, timeZone: 'UTC' } : undefined
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
}

export async function createMicrosoftTask(userId: string, title: string, dueDate?: string | null) {
  const token = await getMicrosoftAccessToken(userId);
  return createMicrosoftTaskWithToken(token, title, dueDate);
}

export async function createMicrosoftTaskForConnectedAccount(tenantId: string, userId: string, accountId: string, title: string, dueDate?: string | null) {
  const token = await getMicrosoftAccessTokenForConnectedAccount(tenantId, userId, accountId);
  return createMicrosoftTaskWithToken(token, title, dueDate);
}

async function completeMicrosoftTaskWithToken(token: string, taskId: string, taskListId: string) {
  const { data } = await axios.patch(`${graph}/me/todo/lists/${taskListId}/tasks/${taskId}`, {
    status: 'completed'
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
}

export async function completeMicrosoftTask(userId: string, taskId: string, taskListId: string) {
  const token = await getMicrosoftAccessToken(userId);
  return completeMicrosoftTaskWithToken(token, taskId, taskListId);
}

export async function completeMicrosoftTaskForConnectedAccount(tenantId: string, userId: string, accountId: string, taskId: string, taskListId: string) {
  const token = await getMicrosoftAccessTokenForConnectedAccount(tenantId, userId, accountId);
  return completeMicrosoftTaskWithToken(token, taskId, taskListId);
}

async function deleteMicrosoftTaskWithToken(token: string, taskId: string, taskListId: string) {
  await axios.delete(`${graph}/me/todo/lists/${taskListId}/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function deleteMicrosoftTask(userId: string, taskId: string, taskListId: string) {
  const token = await getMicrosoftAccessToken(userId);
  await deleteMicrosoftTaskWithToken(token, taskId, taskListId);
}

export async function deleteMicrosoftTaskForConnectedAccount(tenantId: string, userId: string, accountId: string, taskId: string, taskListId: string) {
  const token = await getMicrosoftAccessTokenForConnectedAccount(tenantId, userId, accountId);
  await deleteMicrosoftTaskWithToken(token, taskId, taskListId);
}
