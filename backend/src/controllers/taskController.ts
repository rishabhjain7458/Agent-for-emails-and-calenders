import type { NextFunction, Request, Response } from 'express';
import { createTask, deleteTask, completeTask, getTask, listTasks, upsertExternalTasks } from '../repositories/taskRepository.js';
import { completeGoogleTask, createGoogleTask, deleteGoogleTask, listGoogleTasks } from '../services/googleTasksService.js';
import { completeMicrosoftTask, createMicrosoftTask, deleteMicrosoftTask, listMicrosoftTasks } from '../services/microsoftTasksService.js';
import { send } from '../utils/http.js';

export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    try {
      const providerTasks = req.user!.provider === 'microsoft'
        ? await listMicrosoftTasks(req.user!.id)
        : await listGoogleTasks(req.user!.id);
      await upsertExternalTasks(
        req.user!.tenantId,
        req.user!.id,
        providerTasks
          .filter((task) => task.id && task.title)
          .map((task) => ({
            googleTaskId: task.id!,
            googleTaskListId: task.taskListId ?? null,
            title: task.title!,
            dueDate: task.due ? task.due.slice(0, 10) : task.dueDateTime?.dateTime?.slice(0, 10) ?? null,
            status: task.status ?? 'pending'
          }))
      );
    } catch (syncError) {
      console.error('Google Tasks sync failed:', syncError);
    }

    send(res, await listTasks(req.user!.tenantId));
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const googleTask = req.user!.provider === 'microsoft'
      ? await createMicrosoftTask(req.user!.id, req.body.title, req.body.dueDate)
      : await createGoogleTask(req.user!.id, req.body.title, req.body.dueDate);
    const task = await createTask(req.user!.tenantId, req.user!.id, req.body.title, req.body.dueDate, googleTask.id);
    send(res, task, 201);
  } catch (error) {
    next(error);
  }
}

export async function complete(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await getTask(req.user!.tenantId, req.params.id);
    if (task?.google_task_id) {
      if (req.user!.provider === 'microsoft') {
        if (task.google_task_list_id) await completeMicrosoftTask(req.user!.id, task.google_task_id, task.google_task_list_id);
      } else {
        await completeGoogleTask(req.user!.id, task.google_task_id, task.google_task_list_id ?? '@default');
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
      if (req.user!.provider === 'microsoft') {
        if (task.google_task_list_id) await deleteMicrosoftTask(req.user!.id, task.google_task_id, task.google_task_list_id);
      } else {
        await deleteGoogleTask(req.user!.id, task.google_task_id, task.google_task_list_id ?? '@default');
      }
    }
    await deleteTask(req.user!.tenantId, req.params.id);
    send(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}
