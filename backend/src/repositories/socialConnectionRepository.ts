import { pool } from '../db/pool.js';
import { encrypt } from '../utils/crypto.js';

export type SocialPlatform = 'facebook' | 'instagram' | 'linkedin' | 'x' | 'reddit';

export type SocialConnectionInput = {
  tenantId: string;
  userId: string;
  platform: SocialPlatform;
  providerAccountId: string;
  username?: string | null;
  displayName: string;
  profileUrl: string;
  avatarUrl?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiry?: Date | null;
};

function normalize(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    platform: row.platform,
    providerAccountId: row.provider_account_id,
    username: row.username,
    displayName: row.display_name,
    profileUrl: row.profile_url,
    avatarUrl: row.avatar_url,
    tokenExpiry: row.token_expiry,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function upsertSocialConnection(input: SocialConnectionInput) {
  const result = await pool.query(
    `
    INSERT INTO social_connections
      (tenant_id, user_id, platform, provider_account_id, username, display_name, profile_url, avatar_url, access_token, refresh_token, token_expiry)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (tenant_id, user_id, platform, provider_account_id)
    DO UPDATE SET
      username = EXCLUDED.username,
      display_name = EXCLUDED.display_name,
      profile_url = EXCLUDED.profile_url,
      avatar_url = EXCLUDED.avatar_url,
      access_token = COALESCE(EXCLUDED.access_token, social_connections.access_token),
      refresh_token = COALESCE(EXCLUDED.refresh_token, social_connections.refresh_token),
      token_expiry = EXCLUDED.token_expiry,
      updated_at = NOW()
    RETURNING *
    `,
    [
      input.tenantId,
      input.userId,
      input.platform,
      input.providerAccountId,
      input.username ?? null,
      input.displayName,
      input.profileUrl,
      input.avatarUrl ?? null,
      encrypt(input.accessToken),
      encrypt(input.refreshToken),
      input.tokenExpiry ?? null
    ]
  );
  return normalize(result.rows[0]);
}
