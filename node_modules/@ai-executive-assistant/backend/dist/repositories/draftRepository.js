import { pool } from '../db/pool.js';
export async function saveDraft(input) {
    const result = await pool.query(`
    INSERT INTO email_drafts (tenant_id, user_id, gmail_message_id, gmail_thread_id, subject, body)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `, [input.tenantId, input.userId, input.gmailMessageId, input.gmailThreadId, input.subject, input.body]);
    return result.rows[0];
}
