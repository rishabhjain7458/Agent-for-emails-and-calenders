import { pool } from '../db/pool.js';

export type DashboardCardType = 'social' | 'news' | 'custom_link' | 'portal' | 'media';

export type DashboardCardInput = {
  cardType: DashboardCardType;
  platform?: string | null;
  label: string;
  url: string;
  metadata?: Record<string, unknown>;
};

function normalizeCard(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    cardType: row.card_type,
    platform: row.platform,
    label: row.label,
    url: row.url,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listDashboardCards(tenantId: string, userId: string) {
  const result = await pool.query(
    `
    SELECT *
    FROM dashboard_cards
    WHERE tenant_id = $1 AND user_id = $2
    ORDER BY created_at ASC
    `,
    [tenantId, userId]
  );
  return result.rows.map(normalizeCard);
}

export async function createDashboardCard(tenantId: string, userId: string, input: DashboardCardInput) {
  const result = await pool.query(
    `
    INSERT INTO dashboard_cards (tenant_id, user_id, card_type, platform, label, url, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::jsonb, '{}'::jsonb))
    RETURNING *
    `,
    [
      tenantId,
      userId,
      input.cardType,
      input.platform ?? null,
      input.label,
      input.url,
      input.metadata ? JSON.stringify(input.metadata) : null
    ]
  );
  return normalizeCard(result.rows[0]);
}

export async function deleteDashboardCard(tenantId: string, userId: string, id: string) {
  await pool.query(
    'DELETE FROM dashboard_cards WHERE tenant_id = $1 AND user_id = $2 AND id = $3',
    [tenantId, userId, id]
  );
}

export async function getDashboardCardOrder(tenantId: string, userId: string) {
  const result = await pool.query(
    `
    INSERT INTO dashboard_card_preferences (tenant_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET updated_at = dashboard_card_preferences.updated_at
    RETURNING card_order
    `,
    [tenantId, userId]
  );
  return Array.isArray(result.rows[0]?.card_order) ? result.rows[0].card_order : [];
}

export async function updateDashboardCardOrder(tenantId: string, userId: string, cardOrder: string[]) {
  const result = await pool.query(
    `
    INSERT INTO dashboard_card_preferences (tenant_id, user_id, card_order)
    VALUES ($1, $2, $3::jsonb)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET
      card_order = EXCLUDED.card_order,
      updated_at = NOW()
    RETURNING card_order
    `,
    [tenantId, userId, JSON.stringify(cardOrder)]
  );
  return Array.isArray(result.rows[0]?.card_order) ? result.rows[0].card_order : [];
}
