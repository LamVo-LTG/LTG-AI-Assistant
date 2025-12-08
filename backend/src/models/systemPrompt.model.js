const pool = require('../config/database');

class SystemPromptModel {
  // Create new system prompt
  async create(promptData) {
    const { user_id, name, description, prompt_text, category } = promptData;

    const query = `
      INSERT INTO system_prompts (user_id, name, description, prompt_text, category)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await pool.query(query, [
      user_id,
      name,
      description || null,
      prompt_text,
      category || null
    ]);

    const row = result.rows[0];
    return {
      system_prompt_id: row.id,
      user_id: row.user_id,
      name: row.name,
      description: row.description,
      prompt_text: row.prompt_text,
      category: row.category,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  // Get prompt by ID (allows viewing public system prompts)
  async findById(promptId, userId) {
    console.log('🔍 SystemPrompt.findById() called with:', {
      promptId,
      promptId_type: typeof promptId,
      userId,
      userId_type: typeof userId
    });

    // Allow viewing user's own prompts OR public system prompts
    const query = `
      SELECT
        id as system_prompt_id,
        user_id,
        name,
        description,
        prompt_text,
        category,
        is_public,
        is_system,
        created_at,
        updated_at,
        CASE WHEN user_id = $2 THEN true ELSE false END as is_owner
      FROM system_prompts
      WHERE id = $1
        AND deleted_at IS NULL
        AND (user_id = $2 OR (is_public = true AND is_system = true))
    `;

    const result = await pool.query(query, [promptId, userId]);

    console.log('🔍 SystemPrompt.findById() result:', {
      found: !!result.rows[0],
      rowCount: result.rowCount,
      promptName: result.rows[0]?.name,
      hasPromptText: !!result.rows[0]?.prompt_text,
      promptTextLength: result.rows[0]?.prompt_text?.length,
      isOwner: result.rows[0]?.is_owner
    });

    return result.rows[0];
  }

  // Get all prompts for user (including public system prompts)
  async findByUserId(userId, filters = {}) {
    const { category, search, limit = 50, offset = 0 } = filters;

    // Query to get user's own prompts AND public system prompts
    let query = `
      SELECT
        id as system_prompt_id,
        user_id,
        name,
        description,
        prompt_text,
        category,
        is_public,
        is_system,
        created_at,
        updated_at,
        CASE WHEN user_id = $1 THEN true ELSE false END as is_owner
      FROM system_prompts
      WHERE deleted_at IS NULL
        AND (user_id = $1 OR (is_public = true AND is_system = true))
    `;

    const params = [userId];
    let paramIndex = 2;

    // Filter by category
    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    // Search in name and description
    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Order: user's own prompts first, then public system prompts, both sorted by name ascending
    query += `
      ORDER BY
        CASE WHEN user_id = $1 THEN 0 ELSE 1 END,
        name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Update system prompt
  async update(promptId, userId, updates) {
    const { name, description, prompt_text, category } = updates;

    const query = `
      UPDATE system_prompts
      SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        prompt_text = COALESCE($3, prompt_text),
        category = COALESCE($4, category),
        updated_at = NOW()
      WHERE id = $5 AND user_id = $6
      RETURNING id as system_prompt_id, user_id, name, description, prompt_text, category, created_at, updated_at
    `;

    const result = await pool.query(query, [
      name,
      description,
      prompt_text,
      category,
      promptId,
      userId
    ]);

    return result.rows[0];
  }

  // Delete system prompt
  async delete(promptId, userId) {
    const query = `
      DELETE FROM system_prompts
      WHERE id = $1 AND user_id = $2
      RETURNING id as system_prompt_id
    `;

    const result = await pool.query(query, [promptId, userId]);
    return result.rows[0];
  }

  // Get all categories for user
  async getCategories(userId) {
    const query = `
      SELECT DISTINCT category
      FROM system_prompts
      WHERE user_id = $1 AND category IS NOT NULL
      ORDER BY category
    `;

    const result = await pool.query(query, [userId]);
    return result.rows.map(row => row.category);
  }

  // Get prompt statistics
  async getStatsByUserId(userId) {
    const query = `
      SELECT
        COUNT(*) as total_prompts,
        COUNT(DISTINCT category) as category_count
      FROM system_prompts
      WHERE user_id = $1
    `;

    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }
}

module.exports = new SystemPromptModel();
