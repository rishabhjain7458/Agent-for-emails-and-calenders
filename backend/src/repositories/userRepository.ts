import { pool } from '../db/pool.js';
import { encrypt } from '../utils/crypto.js';

type UpsertUserInput = {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiry?: Date | null;
};

type UpsertMicrosoftUserInput = {
  microsoftId: string;
  email: string;
  name: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiry?: Date | null;
};

export async function upsertGoogleUser(input: UpsertUserInput) {
  const result = await pool.query(
    `
    INSERT INTO users (google_id, auth_provider, email, name, avatar_url, access_token, refresh_token, token_expiry)
    VALUES ($1, 'google', $2, $3, $4, $5, $6, $7)
    ON CONFLICT (google_id) DO UPDATE SET
      auth_provider = 'google',
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      avatar_url = EXCLUDED.avatar_url,
      access_token = COALESCE(EXCLUDED.access_token, users.access_token),
      refresh_token = COALESCE(EXCLUDED.refresh_token, users.refresh_token),
      token_expiry = EXCLUDED.token_expiry,
      updated_at = NOW()
    RETURNING *
    `,
    [
      input.googleId,
      input.email,
      input.name,
      input.avatarUrl,
      encrypt(input.accessToken),
      encrypt(input.refreshToken),
      input.tokenExpiry
    ]
  );
  return result.rows[0];
}

export async function upsertMicrosoftUser(input: UpsertMicrosoftUserInput) {
  const result = await pool.query(
    `
    INSERT INTO users (microsoft_id, auth_provider, email, name, access_token, refresh_token, token_expiry)
    VALUES ($1, 'microsoft', $2, $3, $4, $5, $6)
    ON CONFLICT (microsoft_id) DO UPDATE SET
      auth_provider = 'microsoft',
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      access_token = COALESCE(EXCLUDED.access_token, users.access_token),
      refresh_token = COALESCE(EXCLUDED.refresh_token, users.refresh_token),
      token_expiry = EXCLUDED.token_expiry,
      updated_at = NOW()
    RETURNING *
    `,
    [
      input.microsoftId,
      input.email,
      input.name,
      encrypt(input.accessToken),
      encrypt(input.refreshToken),
      input.tokenExpiry
    ]
  );
  return result.rows[0];
}

export async function getUserById(userId: string) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows[0];
}

export async function updateUserTokens(userId: string, accessToken?: string | null, refreshToken?: string | null, expiry?: Date | null) {
  await pool.query(
    `
    UPDATE users
    SET access_token = COALESCE($2, access_token),
        refresh_token = COALESCE($3, refresh_token),
        token_expiry = COALESCE($4, token_expiry),
        updated_at = NOW()
    WHERE id = $1
    `,
    [userId, encrypt(accessToken), encrypt(refreshToken), expiry]
  );
}
