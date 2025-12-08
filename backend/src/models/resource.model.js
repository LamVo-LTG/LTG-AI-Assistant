const pool = require('../config/database');

class ResourceModel {
  // Create new resource (file or URL)
  async create(resourceData) {
    const { user_id, resource_type, name, url, file_path, file_size, mime_type, description, metadata } = resourceData;

    // For files: file_path is required (Gemini URI)
    // For URLs: url is required
    const query = `
      INSERT INTO resources (user_id, resource_type, name, description, file_path, file_size, mime_type, url, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id as resource_id, user_id, resource_type, name, description, file_path, file_size, mime_type, url, metadata, created_at
    `;

    const result = await pool.query(query, [
      user_id,
      resource_type,
      name,
      description || null,
      file_path || null,  // For files: Gemini URI
      file_size || null,
      mime_type || null,
      url || null,  // For URLs: actual URL
      JSON.stringify(metadata || {})  // Store metadata as JSON string
    ]);

    return result.rows[0];
  }

  // Get resource by ID
  async findById(resourceId, userId) {
    const query = `
      SELECT
        id as resource_id,
        user_id,
        resource_type,
        name,
        description,
        file_path,
        url,
        file_size,
        mime_type,
        created_at
      FROM resources
      WHERE id = $1 AND user_id = $2
    `;

    const result = await pool.query(query, [resourceId, userId]);
    return result.rows[0];
  }

  // Get all resources for user
  async findByUserId(userId, filters = {}) {
    const { resource_type, limit = 50, offset = 0 } = filters;

    let query = `
      SELECT
        id as resource_id,
        user_id,
        resource_type,
        name,
        description,
        file_path,
        url,
        file_size,
        mime_type,
        created_at
      FROM resources
      WHERE user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    // Filter by resource type
    if (resource_type) {
      query += ` AND resource_type = $${paramIndex}`;
      params.push(resource_type);
      paramIndex++;
    }

    query += `
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get resources for a conversation
  async findByConversationId(conversationId) {
    const query = `
      SELECT
        r.id as resource_id,
        r.user_id,
        r.resource_type,
        r.name,
        r.file_path,
        r.url,
        r.file_size,
        r.mime_type,
        r.created_at,
        cr.added_at
      FROM resources r
      JOIN conversation_resources cr ON r.id = cr.resource_id
      WHERE cr.conversation_id = $1
      ORDER BY cr.added_at ASC
    `;

    const result = await pool.query(query, [conversationId]);
    return result.rows;
  }

  // Add resource to conversation
  async addToConversation(conversationId, resourceId) {
    const query = `
      INSERT INTO conversation_resources (conversation_id, resource_id)
      VALUES ($1, $2)
      ON CONFLICT (conversation_id, resource_id) DO NOTHING
      RETURNING *
    `;

    const result = await pool.query(query, [conversationId, resourceId]);
    return result.rows[0];
  }

  // Remove resource from conversation
  async removeFromConversation(conversationId, resourceId) {
    const query = `
      DELETE FROM conversation_resources
      WHERE conversation_id = $1 AND resource_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [conversationId, resourceId]);
    return result.rows[0];
  }

  // Delete resource
  async delete(resourceId, userId) {
    const query = `
      DELETE FROM resources
      WHERE id = $1 AND user_id = $2
      RETURNING id as resource_id
    `;

    const result = await pool.query(query, [resourceId, userId]);
    return result.rows[0];
  }

  // Get resource statistics
  async getStatsByUserId(userId) {
    const query = `
      SELECT
        resource_type,
        COUNT(*) as count,
        SUM(file_size) as total_size
      FROM resources
      WHERE user_id = $1
      GROUP BY resource_type
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }
}

module.exports = new ResourceModel();
