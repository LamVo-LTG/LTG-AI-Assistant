const systemPromptModel = require('../models/systemPrompt.model');

class SystemPromptController {
  // Create new system prompt
  async createPrompt(req, res) {
    try {
      const { name, description, prompt_text, category } = req.body;
      const user_id = req.user.user_id;

      // Validation
      if (!name || !prompt_text) {
        return res.status(400).json({
          error: 'Name and prompt text are required'
        });
      }

      if (prompt_text.length < 10) {
        return res.status(400).json({
          error: 'Prompt text must be at least 10 characters'
        });
      }

      const prompt = await systemPromptModel.create({
        user_id,
        name,
        description,
        prompt_text,
        category
      });

      res.status(201).json({
        message: 'System prompt created successfully',
        prompt
      });
    } catch (error) {
      console.error('Create prompt error:', error);
      res.status(500).json({ error: 'Failed to create system prompt' });
    }
  }

  // Get all prompts for current user
  async getPrompts(req, res) {
    try {
      const user_id = req.user.user_id;
      const { category, search, favorites_only, limit, offset } = req.query;

      const filters = {
        category,
        search,
        favorites_only: favorites_only === 'true',
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
      };

      const prompts = await systemPromptModel.findByUserId(user_id, filters);

      res.json({
        prompts,
        count: prompts.length
      });
    } catch (error) {
      console.error('Get prompts error:', error);
      res.status(500).json({ error: 'Failed to fetch system prompts' });
    }
  }

  // Get single prompt by ID
  async getPromptById(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.user_id;

      const prompt = await systemPromptModel.findById(id, user_id);

      if (!prompt) {
        return res.status(404).json({ error: 'System prompt not found' });
      }

      res.json({ prompt });
    } catch (error) {
      console.error('Get prompt error:', error);
      res.status(500).json({ error: 'Failed to fetch system prompt' });
    }
  }

  // Update system prompt
  async updatePrompt(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.user_id;
      const { name, description, prompt_text, category, is_favorite } = req.body;

      const updatedPrompt = await systemPromptModel.update(id, user_id, {
        name,
        description,
        prompt_text,
        category,
        is_favorite
      });

      if (!updatedPrompt) {
        return res.status(404).json({ error: 'System prompt not found' });
      }

      res.json({
        message: 'System prompt updated successfully',
        prompt: updatedPrompt
      });
    } catch (error) {
      console.error('Update prompt error:', error);
      res.status(500).json({ error: 'Failed to update system prompt' });
    }
  }

  // Delete system prompt
  async deletePrompt(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.user_id;

      const deletedPrompt = await systemPromptModel.delete(id, user_id);

      if (!deletedPrompt) {
        return res.status(404).json({ error: 'System prompt not found' });
      }

      res.json({
        message: 'System prompt deleted successfully',
        system_prompt_id: deletedPrompt.system_prompt_id
      });
    } catch (error) {
      console.error('Delete prompt error:', error);
      res.status(500).json({ error: 'Failed to delete system prompt' });
    }
  }

  // Toggle favorite status
  async toggleFavorite(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.user_id;

      const result = await systemPromptModel.toggleFavorite(id, user_id);

      if (!result) {
        return res.status(404).json({ error: 'System prompt not found' });
      }

      res.json({
        message: result.is_favorite ? 'Added to favorites' : 'Removed from favorites',
        system_prompt_id: result.system_prompt_id,
        is_favorite: result.is_favorite
      });
    } catch (error) {
      console.error('Toggle favorite error:', error);
      res.status(500).json({ error: 'Failed to toggle favorite' });
    }
  }

  // Get all categories
  async getCategories(req, res) {
    try {
      const user_id = req.user.user_id;
      const categories = await systemPromptModel.getCategories(user_id);

      res.json({ categories });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  }

  // Get statistics
  async getStats(req, res) {
    try {
      const user_id = req.user.user_id;
      const stats = await systemPromptModel.getStatsByUserId(user_id);

      res.json({ stats });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  }
}

module.exports = new SystemPromptController();
