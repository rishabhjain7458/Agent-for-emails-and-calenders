ALTER TABLE tasks ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS account_email TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_account ON tasks(tenant_id, account_id);
