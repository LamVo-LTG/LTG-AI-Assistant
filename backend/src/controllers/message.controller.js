const messageModel = require('../models/message.model');
const conversationModel = require('../models/conversation.model');

class MessageController {
  // Create new message
  async createMessage(req, res) {
    try {
      const { conversation_id, role, content } = req.body;
      const user_id = req.user.user_id;

      // Validate role
      const validRoles = ['user', 'assistant', 'system'];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({
          error: 'Valid role is required: user, assistant, or system'
        });
      }

      // Validate content
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Message content is required' });
      }

      // Verify conversation exists and belongs to user
      const conversation = await conversationModel.findById(conversation_id, user_id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Create message
      const message = await messageModel.create({
        conversation_id,
        role,
        content
      });

      // Update conversation timestamp
      await conversationModel.touch(conversation_id);

      res.status(201).json({
        message: 'Message created successfully',
        data: message
      });
    } catch (error) {
      console.error('Create message error:', error);
      res.status(500).json({ error: 'Failed to create message' });
    }
  }

  // Get all messages for a conversation
  async getMessages(req, res) {
    try {
      const { conversation_id } = req.params;
      const user_id = req.user.user_id;
      const { limit, offset } = req.query;

      const options = {
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0
      };

      const messages = await messageModel.findByConversationId(
        conversation_id,
        user_id,
        options
      );

      res.json({
        messages,
        count: messages.length
      });
    } catch (error) {
      console.error('Get messages error:', error);

      if (error.message === 'Conversation not found or access denied') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  // Delete message
  async deleteMessage(req, res) {
    try {
      const { message_id, conversation_id } = req.params;
      const user_id = req.user.user_id;

      const deletedMessage = await messageModel.delete(
        message_id,
        conversation_id,
        user_id
      );

      if (!deletedMessage) {
        return res.status(404).json({ error: 'Message not found' });
      }

      res.json({
        message: 'Message deleted successfully',
        message_id: deletedMessage.message_id
      });
    } catch (error) {
      console.error('Delete message error:', error);

      if (error.message === 'Conversation not found or access denied') {
        return res.status(403).json({ error: error.message });
      }

      res.status(500).json({ error: 'Failed to delete message' });
    }
  }

  // Delete all messages in a conversation
  async deleteAllMessages(req, res) {
    try {
      const { conversation_id } = req.params;
      const user_id = req.user.user_id;

      const result = await messageModel.deleteAllByConversationId(
        conversation_id,
        user_id
      );

      res.json({
        message: 'All messages deleted successfully',
        deleted_count: result.deleted_count
      });
    } catch (error) {
      console.error('Delete all messages error:', error);

      if (error.message === 'Conversation not found or access denied') {
        return res.status(403).json({ error: error.message });
      }

      res.status(500).json({ error: 'Failed to delete messages' });
    }
  }
}

module.exports = new MessageController();
