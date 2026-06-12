import { pool } from '../db/pool.js';
import { encrypt, decrypt } from '../utils/crypto.js';
export async function getSettings(tenantId, userId) {
    const result = await pool.query(`
    INSERT INTO settings (tenant_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET updated_at = settings.updated_at
    RETURNING *
    `, [tenantId, userId]);
    const row = result.rows[0];
    return { ...row, gemini_api_key: decrypt(row.gemini_api_key) };
}
export async function updateSettings(tenantId, userId, input) {
    const result = await pool.query(`
    INSERT INTO settings (tenant_id, user_id, gemini_api_key, timezone, email_preferences)
    VALUES ($1, $2, $3, COALESCE($4, 'UTC'), COALESCE($5::jsonb, '{"priorityCategories":["security","financial","work","meetings"],"ignorePromotions":true}'::jsonb))
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET
        gemini_api_key = COALESCE(EXCLUDED.gemini_api_key, settings.gemini_api_key),
        timezone = COALESCE($4, settings.timezone),
        email_preferences = COALESCE($5::jsonb, settings.email_preferences),
        updated_at = NOW()
    RETURNING *
    `, [
        tenantId,
        userId,
        input.geminiApiKey ? encrypt(input.geminiApiKey) : null,
        input.timezone ?? null,
        input.emailPreferences ? JSON.stringify(input.emailPreferences) : null
    ]);
    return result.rows[0];
}
