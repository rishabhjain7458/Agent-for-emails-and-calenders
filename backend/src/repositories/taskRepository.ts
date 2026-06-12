import { pool } from '../db/pool.js';

export type ExternalTask = {
  googleTaskId: string;
  title: string;
  dueDate?: string | null;
  status?: string | null;
};

export async function listTasks(tenantId: string) {
  const result = await pool.query(
    'SELECT * FROM tasks WHERE tenant_id = $1 ORDER BY due_date NULLS LAST, created_at DESC',
    [tenantId]
  );
  return result.rows;
}

export async function createTask(tenantId: string, userId: string, title: string, dueDate?: string | null, googleTaskId?: string | null) {
  const result = await pool.query(
    'INSERT INTO tasks (tenant_id, user_id, title, due_date, google_task_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [tenantId, userId, title, dueDate ?? null, googleTaskId ?? null]
  );
  return result.rows[0];
}

export async function upsertExternalTasks(tenantId: string, userId: string, tasks: ExternalTask[]) {
  for (const task of tasks) {
    const existing = await pool.query(
      'SELECT id FROM tasks WHERE tenant_id = $1 AND google_task_id = $2 LIMIT 1',
      [tenantId, task.googleTaskId]
    );

    if (existing.rowCount) {
      await pool.query(
        'UPDATE tasks SET title = $1, due_date = $2, status = $3, updated_at = NOW() WHERE id = $4',
        [task.title, task.dueDate ?? null, task.status ?? 'pending', existing.rows[0].id]
      );
      continue;
    }

    await pool.query(
      'INSERT INTO tasks (tenant_id, user_id, title, due_date, status, google_task_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [tenantId, userId, task.title, task.dueDate ?? null, task.status ?? 'pending', task.googleTaskId]
    );
  }
}

export async function completeTask(tenantId: string, id: string) {
  const result = await pool.query(
    "UPDATE tasks SET status = 'completed', updated_at = NOW() WHERE tenant_id = $1 AND id = $2 RETURNING *",
    [tenantId, id]
  );
  return result.rows[0];
}

export async function deleteTask(tenantId: string, id: string) {
  await pool.query('DELETE FROM tasks WHERE tenant_id = $1 AND id = $2', [tenantId, id]);
}
