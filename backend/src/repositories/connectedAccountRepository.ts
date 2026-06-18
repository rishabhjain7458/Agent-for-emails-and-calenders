import { pool } from '../db/pool.js';
import { encrypt } from '../utils/crypto.js';

export type ConnectedAccountProvider = 'google' | 'microsoft' | 'zoho';

export type ConnectedAccountInput = {
  tenantId: string;
  userId: string;
  provider: ConnectedAccountProvider;
  providerAccountId: string;
  email: string;
  name?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiry?: Date | null;
};

export async function upsertConnectedAccount(input: ConnectedAccountInput) {
  const result = await pool.query(
    `
    INSERT INTO connected_accounts
      (tenant_id, user_id, provider, provider_account_id, email, name, access_token, refresh_token, token_expiry)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (user_id, provider, provider_account_id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      access_token = COALESCE(EXCLUDED.access_token, connected_accounts.access_token),
      refresh_token = COALESCE(EXCLUDED.refresh_token, connected_accounts.refresh_token),
      token_expiry = EXCLUDED.token_expiry,
      updated_at = NOW()
    RETURNING id, tenant_id, user_id, provider, provider_account_id, email, name, token_expiry, created_at, updated_at
    `,
    [
      input.tenantId,
      input.userId,
      input.provider,
      input.providerAccountId,
      input.email,
      input.name ?? null,
      encrypt(input.accessToken),
      encrypt(input.refreshToken),
      input.tokenExpiry ?? null
    ]
  );
  return result.rows[0];
}

export async function listConnectedAccounts(tenantId: string, userId: string) {
  const result = await pool.query(
    `
    SELECT id, tenant_id, user_id, provider, provider_account_id, email, name, token_expiry, created_at, updated_at
    FROM connected_accounts
    WHERE tenant_id = $1 AND user_id = $2
    ORDER BY created_at DESC
    `,
    [tenantId, userId]
  );
  return result.rows;
}

export async function getConnectedAccount(tenantId: string, userId: string, id: string) {
  const result = await pool.query(
    'SELECT * FROM connected_accounts WHERE tenant_id = $1 AND user_id = $2 AND id = $3',
    [tenantId, userId, id]
  );
  return result.rows[0];
}

export async function updateConnectedAccountTokens(id: string, accessToken?: string | null, refreshToken?: string | null, expiry?: Date | null) {
  await pool.query(
    `
    UPDATE connected_accounts
    SET access_token = COALESCE($2, access_token),
        refresh_token = COALESCE($3, refresh_token),
        token_expiry = COALESCE($4, token_expiry),
        updated_at = NOW()
    WHERE id = $1
    `,
    [id, encrypt(accessToken), encrypt(refreshToken), expiry ?? null]
  );
}

export async function deleteConnectedAccount(tenantId: string, userId: string, id: string) {
  await pool.query(
    'DELETE FROM connected_accounts WHERE tenant_id = $1 AND user_id = $2 AND id = $3',
    [tenantId, userId, id]
  );
}
