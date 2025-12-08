const userModel = require('../models/user.model');
const bcryptUtil = require('../utils/bcrypt');
const jwtConfig = require('../config/jwt');

// Standalone password validation function (avoids 'this' binding issues in Express routes)
function validatePasswordStrength(password) {
  const errors = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return errors;
}

class AuthController {
  // Register new user (requires admin approval)
  async register(req, res) {
    try {
      const { username, email, password, full_name } = req.body;

      // Validation
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      // Check if email already exists
      const emailExists = await userModel.emailExists(email);
      if (emailExists) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Check if username already exists
      const usernameExists = await userModel.usernameExists(username);
      if (usernameExists) {
        return res.status(409).json({ error: 'Username already taken' });
      }

      // Hash password
      const password_hash = await bcryptUtil.hash(password);

      // Create user with is_active = false (pending approval)
      const newUser = await userModel.create({
        username,
        email,
        password_hash,
        full_name: full_name || null,
        role: 'user',
        is_active: false
      });

      // Return pending approval message (no token - user cannot login yet)
      res.status(201).json({
        message: 'Registration successful! Your account is pending admin approval.',
        status: 'pending_approval',
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  // Login user
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Find user
      const user = await userModel.findByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Verify password
      const isValidPassword = await bcryptUtil.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Check if user is active
      if (user.is_active === false) {
        return res.status(403).json({
          error: 'Your account is pending approval. Please wait for an administrator to activate your account.',
          status: 'pending_approval'
        });
      }

      // Generate JWT token
      const token = jwtConfig.generateToken({
        user_id: user.id,
        email: user.email,
        role: user.role
      });

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  // Get current user profile
  async getProfile(req, res) {
    try {
      const user = await userModel.findById(req.user.user_id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ user });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  }

  // Update user profile (Username and Full Name)
  async updateProfile(req, res) {
    try {
      const { username, full_name } = req.body;
      const userId = req.user.user_id;

      // Validation
      if (!username || username.trim().length === 0) {
        return res.status(400).json({ error: 'Username is required' });
      }

      if (username.trim().length < 2) {
        return res.status(400).json({ error: 'Username must be at least 2 characters' });
      }

      // Update user
      const updatedUser = await userModel.update(userId, {
        username: username.trim(),
        full_name: full_name ? full_name.trim() : null
      });

      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        message: 'Profile updated successfully',
        user: updatedUser
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  // Update user password
  async updatePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.user_id;

      // Validation
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }

      // Password strength validation
      const passwordErrors = validatePasswordStrength(newPassword);
      if (passwordErrors.length > 0) {
        return res.status(400).json({
          error: 'Password does not meet requirements',
          details: passwordErrors
        });
      }

      // Get user with password hash
      const user = await userModel.findByEmail(req.user.email);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const isValidPassword = await bcryptUtil.compare(currentPassword, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const password_hash = await bcryptUtil.hash(newPassword);

      // Update password
      await userModel.update(userId, { password_hash });

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Update password error:', error.message);
      console.error('Stack:', error.stack);
      res.status(500).json({ error: 'Failed to update password', details: error.message });
    }
  }
}

module.exports = new AuthController();
