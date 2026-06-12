import type { NextFunction, Request, Response } from 'express';
import { createTask, deleteTask, completeTask, listTasks, upsertExternalTasks } from '../repositories/taskRepository.js';
import { createGoogleTask, listGoogleTasks } from '../services/googleTasksService.js';
import { createMicrosoftTask, listMicrosoftTasks } from '../services/microsoftTasksService.js';
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
    send(res, await completeTask(req.user!.tenantId, req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteTask(req.user!.tenantId, req.params.id);
    send(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}
