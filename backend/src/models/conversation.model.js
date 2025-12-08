const pool = require('../config/database');

class ConversationModel {
  // Create new conversation
  async create(conversationData) {
    const { user_id, title, chat_mode, system_prompt_id } = conversationData;

    const query = `
      INSERT INTO conversations (user_id, title, mode, system_prompt_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id as conversation_id, user_id, title, mode as chat_mode, system_prompt_id, is_pinned, created_at, updated_at
    `;

    const result = await pool.query(query, [
      user_id,
      title || 'New Conversation',
      chat_mode,
      system_prompt_id || null
    ]);

    return result.rows[0];
  }

  // Get conversation by ID
  async findById(conversationId, userId) {
    const query = `
      SELECT
        c.id as conversation_id,
        c.user_id,
        c.title,
        c.mode as chat_mode,
        c.system_prompt_id,
        c.is_pinned,
        c.created_at,
        c.updated_at,
        sp.name as system_prompt_name,
        COUNT(m.id) as message_count
      FROM conversations c
      LEFT JOIN system_prompts sp ON c.system_prompt_id = sp.id
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE c.id = $1 AND c.user_id = $2
      GROUP BY c.id, sp.name
    `;

    const result = await pool.query(query, [conversationId, userId]);
    return result.rows[0];
  }

  // Get all conversations for a user
  async findByUserId(userId, filters = {}) {
    const { chat_mode, search, pinned_only, limit = 50, offset = 0 } = filters;

    let query = `
      SELECT
        c.id as conversation_id,
        c.user_id,
        c.title,
        c.mode as chat_mode,
        c.system_prompt_id,
        c.is_pinned,
        c.created_at,
        c.updated_at,
        sp.name as system_prompt_name,
        COUNT(m.id) as message_count,
        MAX(m.created_at) as last_message_at
      FROM conversations c
      LEFT JOIN system_prompts sp ON c.system_prompt_id = sp.id
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE c.user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    // Filter by chat mode
    if (chat_mode) {
      query += ` AND c.mode = $${paramIndex}`;
      params.push(chat_mode);
      paramIndex++;
    }

    // Filter by pinned
    if (pinned_only) {
      query += ` AND c.is_pinned = true`;
    }

    // Search in title
    if (search) {
      query += ` AND c.title ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += `
      GROUP BY c.id, sp.name
      ORDER BY c.is_pinned DESC, c.updated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Update conversation
  async update(conversationId, userId, updates) {
    const { title, system_prompt_id, is_pinned } = updates;

    // Build dynamic query based on what fields are provided
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    if (title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      params.push(title);
    }

    if (system_prompt_id !== undefined) {
      setClauses.push(`system_prompt_id = $${paramIndex++}`);
      params.push(system_prompt_id);
    }

    if (is_pinned !== undefined) {
      setClauses.push(`is_pinned = $${paramIndex++}`);
      params.push(is_pinned);
    }

    // Always update timestamp
    setClauses.push(`updated_at = NOW()`);

    // Add WHERE clause parameters
    params.push(conversationId, userId);

    const query = `
      UPDATE conversations
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
      RETURNING id as conversation_id, user_id, title, mode as chat_mode, system_prompt_id, is_pinned, updated_at
    `;

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  // Delete conversation (cascade deletes messages)
  async delete(conversationId, userId) {
    const query = `
      DELETE FROM conversations
      WHERE id = $1 AND user_id = $2
      RETURNING id as conversation_id
    `;

    const result = await pool.query(query, [conversationId, userId]);
    return result.rows[0];
  }

  // Toggle pin status
  async togglePin(conversationId, userId) {
    const query = `
      UPDATE conversations
      SET is_pinned = NOT is_pinned, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id as conversation_id, is_pinned
    `;

    const result = await pool.query(query, [conversationId, userId]);
    return result.rows[0];
  }

  // Get conversation count by mode
  async getStatsByUserId(userId) {
    const query = `
      SELECT
        mode as chat_mode,
        COUNT(*) as count,
        COUNT(CASE WHEN is_pinned THEN 1 END) as pinned_count
      FROM conversations
      WHERE user_id = $1
      GROUP BY mode
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  // Update conversation timestamp (called when new message is added)
  async touch(conversationId) {
    const query = `
      UPDATE conversations
      SET updated_at = NOW()
      WHERE id = $1
      RETURNING updated_at
    `;

    const result = await pool.query(query, [conversationId]);
    return result.rows[0];
  }
}

module.exports = new ConversationModel();
