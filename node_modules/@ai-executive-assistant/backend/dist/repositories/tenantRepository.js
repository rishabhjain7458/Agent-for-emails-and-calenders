import { pool } from '../db/pool.js';
import crypto from 'node:crypto';
function slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';
}
export async function ensureDefaultTenant(userId, email) {
    const existing = await pool.query(`
    SELECT t.*, tm.role
    FROM tenants t
    JOIN tenant_memberships tm ON tm.tenant_id = t.id
    WHERE tm.user_id = $1
    ORDER BY tm.created_at ASC
    LIMIT 1
    `, [userId]);
    if (existing.rows[0])
        return existing.rows[0];
    const baseSlug = slugify(email.split('@')[1] ?? email);
    const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
    const tenant = await pool.query('INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING *', [`${email}'s Workspace`, slug]);
    await pool.query('INSERT INTO tenant_memberships (tenant_id, user_id, role) VALUES ($1, $2, $3)', [tenant.rows[0].id, userId, 'owner']);
    return { ...tenant.rows[0], role: 'owner' };
}
