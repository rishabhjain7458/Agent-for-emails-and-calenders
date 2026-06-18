import type { NextFunction, Request, Response } from 'express';
import { createTask, deleteTask, completeTask, getTask, listTasks, upsertExternalTasks } from '../repositories/taskRepository.js';
import {
  completeGoogleTask,
  completeGoogleTaskForConnectedAccount,
  createGoogleTask,
  createGoogleTaskForConnectedAccount,
  deleteGoogleTask,
  deleteGoogleTaskForConnectedAccount,
  listGoogleTasks,
  listGoogleTasksForConnectedAccount
} from '../services/googleTasksService.js';
import {
  completeMicrosoftTask,
  completeMicrosoftTaskForConnectedAccount,
  createMicrosoftTask,
  createMicrosoftTaskForConnectedAccount,
  deleteMicrosoftTask,
  deleteMicrosoftTaskForConnectedAccount,
  listMicrosoftTasks,
  listMicrosoftTasksForConnectedAccount
} from '../services/microsoftTasksService.js';
import { listAccountContexts, resolveAccountContext, type AccountContext } from '../services/accountContextService.js';
import { HttpError, send } from '../utils/http.js';

async function syncTasksForAccount(req: Request, account: AccountContext) {
  if (account.provider === 'zoho') return;
  const providerTasks = account.provider === 'microsoft'
    ? account.isPrimary
      ? await listMicrosoftTasks(req.user!.id)
      : await listMicrosoftTasksForConnectedAccount(req.user!.tenantId, req.user!.id, account.accountId)
    : account.isPrimary
      ? await listGoogleTasks(req.user!.id)
      : await listGoogleTasksForConnectedAccount(req.user!.tenantId, req.user!.id, account.accountId);

  await upsertExternalTasks(
    req.user!.tenantId,
    req.user!.id,
    providerTasks
      .filter((task) => task.id && task.title)
      .map((task) => ({
        googleTaskId: task.id!,
        googleTaskListId: task.taskListId ?? null,
        provider: account.provider,
        accountId: account.accountId,
        accountEmail: account.email,
        title: task.title!,
        dueDate: task.due ? task.due.slice(0, 10) : task.dueDateTime?.dateTime?.slice(0, 10) ?? null,
        status: task.status ?? 'pending'
      }))
  );
}

export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = String(req.query.accountId ?? 'all');
    const accounts = accountId === 'all'
      ? await listAccountContexts(req.user!)
      : [await resolveAccountContext(req.user!, accountId)];

    for (const account of accounts) {
      try {
        await syncTasksForAccount(req, account);
      } catch (syncError) {
        console.error(`Task sync failed for ${account.email}:`, syncError);
      }
    }

    send(res, await listTasks(req.user!.tenantId, accountId));
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const account = await resolveAccountContext(req.user!, req.body.accountId);
    if (account.provider === 'zoho') throw new HttpError(400, 'Zoho Mail spaces do not support tasks yet. Choose a Gmail or Outlook space.');
    const providerTask = account.provider === 'microsoft'
      ? account.isPrimary
        ? await createMicrosoftTask(req.user!.id, req.body.title, req.body.dueDate)
        : await createMicrosoftTaskForConnectedAccount(req.user!.tenantId, req.user!.id, account.accountId, req.body.title, req.body.dueDate)
      : account.isPrimary
        ? await createGoogleTask(req.user!.id, req.body.title, req.body.dueDate)
        : await createGoogleTaskForConnectedAccount(req.user!.tenantId, req.user!.id, account.accountId, req.body.title, req.body.dueDate);

    const task = await createTask(req.user!.tenantId, req.user!.id, req.body.title, req.body.dueDate, providerTask.id, {
      provider: account.provider,
      accountId: account.accountId,
      accountEmail: account.email,
      taskListId: providerTask.taskListId ?? null
    });
    send(res, task, 201);
  } catch (error) {
    next(error);
  }
}

export async function complete(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await getTask(req.user!.tenantId, req.params.id);
    if (task?.google_task_id) {
      const provider = task.provider ?? req.user!.provider;
      const accountId = task.account_id ?? 'primary';
      if (provider === 'zoho') {
        // Zoho Mail tasks are not synced, so only the local task record changes.
      } else if (provider === 'microsoft') {
        if (task.google_task_list_id) {
          if (accountId === 'primary') await completeMicrosoftTask(req.user!.id, task.google_task_id, task.google_task_list_id);
          else await completeMicrosoftTaskForConnectedAccount(req.user!.tenantId, req.user!.id, accountId, task.google_task_id, task.google_task_list_id);
        }
      } else if (accountId === 'primary') {
        await completeGoogleTask(req.user!.id, task.google_task_id, task.google_task_list_id ?? '@default');
      } else {
        await completeGoogleTaskForConnectedAccount(req.user!.tenantId, req.user!.id, accountId, task.google_task_id, task.google_task_list_id ?? '@default');
      }
    }
    send(res, await completeTask(req.user!.tenantId, req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await getTask(req.user!.tenantId, req.params.id);
    if (task?.google_task_id) {
      const provider = task.provider ?? req.user!.provider;
      const accountId = task.account_id ?? 'primary';
      if (provider === 'zoho') {
        // Zoho Mail tasks are not synced, so only the local task record changes.
      } else if (provider === 'microsoft') {
        if (task.google_task_list_id) {
          if (accountId === 'primary') await deleteMicrosoftTask(req.user!.id, task.google_task_id, task.google_task_list_id);
          else await deleteMicrosoftTaskForConnectedAccount(req.user!.tenantId, req.user!.id, accountId, task.google_task_id, task.google_task_list_id);
        }
      } else if (accountId === 'primary') {
        await deleteGoogleTask(req.user!.id, task.google_task_id, task.google_task_list_id ?? '@default');
      } else {
        await deleteGoogleTaskForConnectedAccount(req.user!.tenantId, req.user!.id, accountId, task.google_task_id, task.google_task_list_id ?? '@default');
      }
    }
    await deleteTask(req.user!.tenantId, req.params.id);
    send(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}
