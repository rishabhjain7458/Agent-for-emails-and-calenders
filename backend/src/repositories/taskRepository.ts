import { pool } from '../db/pool.js';

export type ExternalTask = {
  googleTaskId: string;
  googleTaskListId?: string | null;
  provider?: 'google' | 'microsoft' | 'zoho';
  accountId?: string | null;
  accountEmail?: string | null;
  title: string;
  dueDate?: string | null;
  status?: string | null;
};

export async function listTasks(tenantId: string, accountId?: string | null) {
  const where = accountId && accountId !== 'all'
    ? 'WHERE tenant_id = $1 AND COALESCE(account_id, $2) = $2'
    : 'WHERE tenant_id = $1';
  const params = accountId && accountId !== 'all' ? [tenantId, accountId] : [tenantId];
  const result = await pool.query(
    `SELECT * FROM tasks ${where} ORDER BY due_date NULLS LAST, created_at DESC`,
    params
  );
  return result.rows;
}

export async function createTask(
  tenantId: string,
  userId: string,
  title: string,
  dueDate?: string | null,
  googleTaskId?: string | null,
  account?: { provider?: 'google' | 'microsoft' | 'zoho'; accountId?: string | null; accountEmail?: string | null; taskListId?: string | null }
) {
  const result = await pool.query(
    `
    INSERT INTO tasks
      (tenant_id, user_id, title, due_date, google_task_id, google_task_list_id, provider, account_id, account_email)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
    `,
    [
      tenantId,
      userId,
      title,
      dueDate ?? null,
      googleTaskId ?? null,
      account?.taskListId ?? null,
      account?.provider ?? null,
      account?.accountId ?? null,
      account?.accountEmail ?? null
    ]
  );
  return result.rows[0];
}

export async function upsertExternalTasks(tenantId: string, userId: string, tasks: ExternalTask[]) {
  for (const task of tasks) {
    const existing = await pool.query(
      'SELECT id FROM tasks WHERE tenant_id = $1 AND google_task_id = $2 AND COALESCE(account_id, $3) = $3 LIMIT 1',
      [tenantId, task.googleTaskId, task.accountId ?? 'primary']
    );

    if (existing.rowCount) {
      await pool.query(
        `
        UPDATE tasks
        SET title = $1,
            due_date = $2,
            status = $3,
            google_task_list_id = COALESCE($4, google_task_list_id),
            provider = COALESCE($5, provider),
            account_id = COALESCE($6, account_id),
            account_email = COALESCE($7, account_email),
            updated_at = NOW()
        WHERE id = $8
        `,
        [
          task.title,
          task.dueDate ?? null,
          task.status ?? 'pending',
          task.googleTaskListId ?? null,
          task.provider ?? null,
          task.accountId ?? null,
          task.accountEmail ?? null,
          existing.rows[0].id
        ]
      );
      continue;
    }

    await pool.query(
      `
      INSERT INTO tasks
        (tenant_id, user_id, title, due_date, status, google_task_id, google_task_list_id, provider, account_id, account_email)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        tenantId,
        userId,
        task.title,
        task.dueDate ?? null,
        task.status ?? 'pending',
        task.googleTaskId,
        task.googleTaskListId ?? null,
        task.provider ?? null,
        task.accountId ?? null,
        task.accountEmail ?? null
      ]
    );
  }
}

export async function getTask(tenantId: string, id: string) {
  const result = await pool.query('SELECT * FROM tasks WHERE tenant_id = $1 AND id = $2', [tenantId, id]);
  return result.rows[0];
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
