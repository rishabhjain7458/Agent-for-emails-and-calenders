import { pool } from '../db/pool.js';

export type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export async function listConversations(tenantId: string, userId: string) {
  const result = await pool.query(
    `
    SELECT id, title, messages, created_at, updated_at
    FROM assistant_conversations
    WHERE tenant_id = $1 AND user_id = $2
    ORDER BY updated_at DESC
    `,
    [tenantId, userId]
  );
  return result.rows;
}

export async function getConversation(tenantId: string, userId: string, id: string) {
  const result = await pool.query(
    `
    SELECT id, title, messages, created_at, updated_at
    FROM assistant_conversations
    WHERE tenant_id = $1 AND user_id = $2 AND id = $3
    `,
    [tenantId, userId, id]
  );
  return result.rows[0];
}

export async function appendConversationMessages(input: {
  tenantId: string;
  userId: string;
  conversationId?: string;
  title: string;
  messages: ConversationMessage[];
}) {
  if (!input.conversationId) {
    const created = await pool.query(
      `
      INSERT INTO assistant_conversations (tenant_id, user_id, title, messages)
      VALUES ($1, $2, $3, $4::jsonb)
      RETURNING id, title, messages, created_at, updated_at
      `,
      [input.tenantId, input.userId, input.title, JSON.stringify(input.messages)]
    );
    return created.rows[0];
  }

  const updated = await pool.query(
    `
    UPDATE assistant_conversations
    SET messages = messages || $4::jsonb,
        updated_at = NOW()
    WHERE tenant_id = $1 AND user_id = $2 AND id = $3
    RETURNING id, title, messages, created_at, updated_at
    `,
    [input.tenantId, input.userId, input.conversationId, JSON.stringify(input.messages)]
  );
  return updated.rows[0];
}
