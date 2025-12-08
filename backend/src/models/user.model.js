const pool = require('../config/database');

class UserModel {
  // Create new user (is_active defaults to false - requires admin approval)
  async create(userData) {
    const { username, email, password_hash, full_name, role, is_active = false } = userData;
    const query = `
      INSERT INTO users (username, email, password_hash, full_name, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, username, email, full_name, role, is_active, created_at
    `;
    const result = await pool.query(query, [username, email, password_hash, full_name || null, role || 'user', is_active]);
    return result.rows[0];
  }

  // Find user by email
  async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0];
  }

  // Find user by ID
  async findById(userId) {
    const query = 'SELECT id, username, email, full_name, role, created_at FROM users WHERE id = $1';
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }

  // Get all users (admin only)
  async findAll() {
    const query = 'SELECT id, username, email, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC';
    const result = await pool.query(query);
    return result.rows;
  }

  // Update user
  async update(userId, updates) {
    const { username, email, full_name, role, password_hash, is_active } = updates;
    const query = `
      UPDATE users
      SET username = COALESCE($1, username),
          email = COALESCE($2, email),
          full_name = COALESCE($3, full_name),
          role = COALESCE($4, role),
          password_hash = COALESCE($5, password_hash),
          is_active = COALESCE($6, is_active),
          updated_at = NOW()
      WHERE id = $7
      RETURNING id, username, email, full_name, role, is_active, updated_at
    `;
    const result = await pool.query(query, [username, email, full_name, role, password_hash, is_active, userId]);
    return result.rows[0];
  }

  // Delete user
  async delete(userId) {
    const query = 'DELETE FROM users WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }

  // Check if email exists
  async emailExists(email) {
    const query = 'SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)';
    const result = await pool.query(query, [email]);
    return result.rows[0].exists;
  }

  // Get pending users (is_active = false)
  async findPending() {
    const query = `
      SELECT id, username, email, full_name, role, is_active, created_at
      FROM users
      WHERE is_active = false
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  // Get pending users count
  async getPendingCount() {
    const query = 'SELECT COUNT(*) as count FROM users WHERE is_active = false';
    const result = await pool.query(query);
    return parseInt(result.rows[0].count);
  }

  // Approve user (set is_active to true)
  async approve(userId) {
    const query = `
      UPDATE users
      SET is_active = true, updated_at = NOW()
      WHERE id = $1
      RETURNING id, username, email, full_name, role, is_active, updated_at
    `;
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }

  // Check if username exists
  async usernameExists(username) {
    const query = 'SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)';
    const result = await pool.query(query, [username]);
    return result.rows[0].exists;
  }
}

module.exports = new UserModel();
