const pool = require('../config/database');

class MessageModel {
  // Create new message
  async create(messageData) {
    const { conversation_id, role, content, metadata = {} } = messageData;

    const query = `
      INSERT INTO messages (conversation_id, role, content, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING id as message_id, conversation_id, role, content, metadata, created_at
    `;

    const result = await pool.query(query, [conversation_id, role, content, JSON.stringify(metadata)]);
    return result.rows[0];
  }

  // Get all messages for a conversation
  async findByConversationId(conversationId, userId, options = {}) {
    const { limit = 100, offset = 0 } = options;

    // First verify user owns this conversation
    const authQuery = `
      SELECT 1 FROM conversations
      WHERE id = $1 AND user_id = $2
    `;

    const authResult = await pool.query(authQuery, [conversationId, userId]);

    if (authResult.rows.length === 0) {
      throw new Error('Conversation not found or access denied');
    }

    // Get messages
    const query = `
      SELECT
        id as message_id,
        conversation_id,
        role,
        content,
        metadata,
        created_at
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [conversationId, limit, offset]);
    return result.rows;
  }

  // Get message by ID
  async findById(messageId) {
    const query = `
      SELECT id as message_id, conversation_id, role, content, metadata, created_at
      FROM messages
      WHERE id = $1
    `;

    const result = await pool.query(query, [messageId]);
    return result.rows[0];
  }

  // Get message count for conversation
  async countByConversationId(conversationId) {
    const query = `
      SELECT COUNT(*) as count
      FROM messages
      WHERE conversation_id = $1
    `;

    const result = await pool.query(query, [conversationId]);
    return parseInt(result.rows[0].count);
  }

  // Delete message
  async delete(messageId, conversationId, userId) {
    // Verify user owns the conversation
    const authQuery = `
      SELECT 1 FROM conversations
      WHERE id = $1 AND user_id = $2
    `;

    const authResult = await pool.query(authQuery, [conversationId, userId]);

    if (authResult.rows.length === 0) {
      throw new Error('Conversation not found or access denied');
    }

    // Delete message
    const query = `
      DELETE FROM messages
      WHERE id = $1 AND conversation_id = $2
      RETURNING id as message_id
    `;

    const result = await pool.query(query, [messageId, conversationId]);
    return result.rows[0];
  }

  // Delete all messages in a conversation
  async deleteAllByConversationId(conversationId, userId) {
    // Verify user owns the conversation
    const authQuery = `
      SELECT 1 FROM conversations
      WHERE id = $1 AND user_id = $2
    `;

    const authResult = await pool.query(authQuery, [conversationId, userId]);

    if (authResult.rows.length === 0) {
      throw new Error('Conversation not found or access denied');
    }

    const query = `
      DELETE FROM messages
      WHERE conversation_id = $1
      RETURNING COUNT(*) as deleted_count
    `;

    const result = await pool.query(query, [conversationId]);
    return result.rows[0];
  }

  // Get last N messages for context (for AI)
  async getRecentMessages(conversationId, limit = 10) {
    const query = `
      SELECT role, content, created_at
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [conversationId, limit]);
    // Return in chronological order
    return result.rows.reverse();
  }
}

module.exports = new MessageModel();
