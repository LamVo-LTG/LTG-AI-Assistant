const userModel = require('../models/user.model');
const bcryptUtil = require('../utils/bcrypt');

class UsersController {
  // Get all users (admin only)
  async getAllUsers(req, res) {
    try {
      const users = await userModel.findAll();
      res.json({ users });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  // Get pending users (admin only)
  async getPendingUsers(req, res) {
    try {
      const users = await userModel.findPending();
      res.json({ users });
    } catch (error) {
      console.error('Get pending users error:', error);
      res.status(500).json({ error: 'Failed to fetch pending users' });
    }
  }

  // Get pending users count (admin only)
  async getPendingCount(req, res) {
    try {
      const count = await userModel.getPendingCount();
      res.json({ count });
    } catch (error) {
      console.error('Get pending count error:', error);
      res.status(500).json({ error: 'Failed to fetch pending count' });
    }
  }

  // Approve user (admin only)
  async approveUser(req, res) {
    try {
      const { id } = req.params;
      const approvedUser = await userModel.approve(id);

      if (!approvedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        message: 'User approved successfully',
        user: approvedUser
      });
    } catch (error) {
      console.error('Approve user error:', error);
      res.status(500).json({ error: 'Failed to approve user' });
    }
  }

  // Reject user (delete pending user - admin only)
  async rejectUser(req, res) {
    try {
      const { id } = req.params;
      const deletedUser = await userModel.delete(id);

      if (!deletedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User rejected and removed' });
    } catch (error) {
      console.error('Reject user error:', error);
      res.status(500).json({ error: 'Failed to reject user' });
    }
  }

  // Get user by ID (admin only)
  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const user = await userModel.findById(id);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  }

  // Create new user (admin only - users are active immediately)
  async createUser(req, res) {
    try {
      const { username, email, password, role } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      // Check if email exists
      const emailExists = await userModel.emailExists(email);
      if (emailExists) {
        return res.status(409).json({ error: 'Email already exists' });
      }

      // Check if username exists
      const usernameExists = await userModel.usernameExists(username);
      if (usernameExists) {
        return res.status(409).json({ error: 'Username already taken' });
      }

      // Hash password
      const password_hash = await bcryptUtil.hash(password);

      // Create user (admin-created users are active immediately)
      const newUser = await userModel.create({
        username,
        email,
        password_hash,
        role: role || 'user',
        is_active: true
      });

      res.status(201).json({
        message: 'User created successfully',
        user: newUser
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }

  // Update user (admin only)
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { username, email, role, password, is_active } = req.body;

      const updateData = { username, email, role, is_active };

      // Hash password if provided
      if (password && password.trim() !== '') {
        updateData.password_hash = await bcryptUtil.hash(password);
      }

      const updatedUser = await userModel.update(id, updateData);

      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        message: 'User updated successfully',
        user: updatedUser
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }

  // Delete user (admin only)
  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      // Prevent deleting yourself
      if (parseInt(id) === req.user.user_id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      const deletedUser = await userModel.delete(id);

      if (!deletedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
}

module.exports = new UsersController();
