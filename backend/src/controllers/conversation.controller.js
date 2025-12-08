const conversationModel = require('../models/conversation.model');
const messageModel = require('../models/message.model');

class ConversationController {
  // Create new conversation
  async createConversation(req, res) {
    try {
      const { title, chat_mode, system_prompt_id } = req.body;
      const user_id = req.user.user_id;

      // Validate chat_mode
      const validModes = ['ai_agent', 'custom_prompt', 'url_context'];
      if (!chat_mode || !validModes.includes(chat_mode)) {
        return res.status(400).json({
          error: 'Valid chat_mode is required: ai_agent, custom_prompt, or url_context'
        });
      }

      // Validate mode-specific requirements
      // Note: custom_prompt mode can have NULL system_prompt_id (will use default prompt)
      // Only ai_agent mode strictly requires system_prompt_id
      if (chat_mode === 'ai_agent' && !system_prompt_id) {
        return res.status(400).json({
          error: 'system_prompt_id is required for ai_agent mode'
        });
      }

      const conversation = await conversationModel.create({
        user_id,
        title: title || 'New Conversation',
        chat_mode,
        system_prompt_id
      });

      res.status(201).json({
        message: 'Conversation created successfully',
        conversation
      });
    } catch (error) {
      console.error('Create conversation error:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  }

  // Get all conversations for current user
  async getConversations(req, res) {
    try {
      const user_id = req.user.user_id;
      const { chat_mode, search, pinned_only, limit, offset } = req.query;

      const filters = {
        chat_mode,
        search,
        pinned_only: pinned_only === 'true',
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
      };

      const conversations = await conversationModel.findByUserId(user_id, filters);

      res.json({
        conversations,
        count: conversations.length
      });
    } catch (error) {
      console.error('Get conversations error:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  }

  // Get single conversation by ID
  async getConversationById(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.user_id;

      const conversation = await conversationModel.findById(id, user_id);

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      res.json({ conversation });
    } catch (error) {
      console.error('Get conversation error:', error);
      res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  }

  // Update conversation
  async updateConversation(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.user_id;
      const { title, system_prompt_id, is_pinned } = req.body;

      const updatedConversation = await conversationModel.update(id, user_id, {
        title,
        system_prompt_id,
        is_pinned
      });

      if (!updatedConversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      res.json({
        message: 'Conversation updated successfully',
        conversation: updatedConversation
      });
    } catch (error) {
      console.error('Update conversation error:', error);
      res.status(500).json({ error: 'Failed to update conversation' });
    }
  }

  // Delete conversation
  async deleteConversation(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.user_id;

      const deletedConversation = await conversationModel.delete(id, user_id);

      if (!deletedConversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      res.json({
        message: 'Conversation deleted successfully',
        conversation_id: deletedConversation.conversation_id
      });
    } catch (error) {
      console.error('Delete conversation error:', error);
      res.status(500).json({ error: 'Failed to delete conversation' });
    }
  }

  // Toggle pin status
  async togglePin(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.user_id;

      const result = await conversationModel.togglePin(id, user_id);

      if (!result) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      res.json({
        message: result.is_pinned ? 'Conversation pinned' : 'Conversation unpinned',
        conversation_id: result.conversation_id,
        is_pinned: result.is_pinned
      });
    } catch (error) {
      console.error('Toggle pin error:', error);
      res.status(500).json({ error: 'Failed to toggle pin' });
    }
  }

  // Get conversation statistics
  async getStats(req, res) {
    try {
      const user_id = req.user.user_id;
      const stats = await conversationModel.getStatsByUserId(user_id);

      res.json({ stats });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  }
}

module.exports = new ConversationController();
