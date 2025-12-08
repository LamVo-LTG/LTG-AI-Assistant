const pool = require('../config/database');

class ApiUsageModel {
  // Log API usage
  async create(usageData) {
    const {
      user_id,
      conversation_id,
      message_id,
      ai_config_id,
      provider,
      model_name,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      cost_estimate,
      response_time_ms,
      status,
      error_message,
      metadata
    } = usageData;

    const query = `
      INSERT INTO api_usage_logs (
        user_id,
        conversation_id,
        message_id,
        ai_config_id,
        provider,
        model_name,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        cost_estimate,
        response_time_ms,
        status,
        error_message,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const result = await pool.query(query, [
      user_id,
      conversation_id || null,
      message_id || null,
      ai_config_id || null,
      provider,
      model_name,
      prompt_tokens || 0,
      completion_tokens || 0,
      total_tokens || 0,
      cost_estimate || 0,
      response_time_ms || null,
      status || 'success',
      error_message || null,
      metadata || {}
    ]);

    return result.rows[0];
  }

  // Get usage by user
  async findByUserId(userId, filters = {}) {
    const { start_date, end_date, limit = 50, offset = 0 } = filters;

    let query = `
      SELECT * FROM api_usage_logs
      WHERE user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    // Filter by date range
    if (start_date) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(end_date);
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

  // Get usage statistics for user
  async getStatsByUserId(userId, filters = {}) {
    const { start_date, end_date } = filters;

    let query = `
      SELECT
        COUNT(*) as total_requests,
        SUM(prompt_tokens) as total_prompt_tokens,
        SUM(completion_tokens) as total_completion_tokens,
        SUM(total_tokens) as total_tokens,
        SUM(cost_estimate) as total_cost,
        AVG(total_tokens) as avg_tokens_per_request,
        model_name
      FROM api_usage_logs
      WHERE user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    if (start_date) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    query += ` GROUP BY model_name`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get usage for conversation
  async findByConversationId(conversationId) {
    const query = `
      SELECT * FROM api_usage_logs
      WHERE conversation_id = $1
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [conversationId]);
    return result.rows;
  }
}

module.exports = new ApiUsageModel();
