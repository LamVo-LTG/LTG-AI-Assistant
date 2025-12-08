const geminiChatService = require('../services/geminiChat.service');
const conversationModel = require('../models/conversation.model');
const messageModel = require('../models/message.model');
const resourceModel = require('../models/resource.model');
const systemPromptModel = require('../models/systemPrompt.model');
const apiUsageModel = require('../models/apiUsage.model');

class ChatController {
  /**
   * Generate AI response (non-streaming)
   */
  async sendMessage(req, res) {
    const startTime = Date.now();

    try {
      const {
        conversation_id,
        message,
        model = 'gemini-2.5-flash',
        temperature = 0.7,
        max_tokens = 2048,
        resource_ids = []  // Resource IDs for this specific message
      } = req.body;

      const user_id = req.user.user_id;

      // Validation
      if (!conversation_id || !message) {
        return res.status(400).json({
          error: 'conversation_id and message are required'
        });
      }

      // Verify conversation belongs to user
      const conversation = await conversationModel.findById(conversation_id, user_id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Get attached resources (files and URLs) BEFORE saving message
      const resources = await resourceModel.findByConversationId(conversation_id);

      // Filter resources by resource_ids if provided (for this specific message)
      const messageResources = resource_ids.length > 0
        ? resources.filter(r => resource_ids.includes(r.resource_id))
        : [];  // No attachments if no resource_ids provided

      // Prepare file attachments for metadata (using local file path)
      const fileAttachments = messageResources
        .filter(r => r.resource_type === 'file')
        .map(r => ({
          resourceId: r.resource_id,
          name: r.name,
          filePath: r.file_path,  // Local file path
          mimeType: r.mime_type,
          fileSize: r.file_size
        }));

      // Prepare files for Gemini API (using Gemini URI) - use ALL conversation resources for context
      // Note: We use all resources for Gemini API context, but only messageResources for metadata
      const files = resources
        .filter(r => r.resource_type === 'file')
        .map(r => ({
          uri: r.url,  // Gemini File API URI
          mimeType: r.mime_type  // MIME type from database
        }))
        .filter(f => f.uri);  // Remove entries without URI

      const urls = resources
        .filter(r => r.resource_type === 'url')
        .map(r => r.url);

      // Validate URL count (Gemini limit: max 20 URLs per request)
      if (urls.length > 20) {
        return res.status(400).json({
          error: 'Maximum 20 URLs allowed per request (Gemini API limitation)'
        });
      }

      // Prepare metadata for user message
      const messageMetadata = {};
      if (fileAttachments.length > 0) {
        messageMetadata.attachments = fileAttachments;
      }
      if (urls.length > 0) {
        messageMetadata.urls = urls;
      }

      // Save user message with metadata
      await messageModel.create({
        conversation_id,
        role: 'user',
        content: message,
        metadata: messageMetadata
      });

      // Get conversation history (last 10 messages for context)
      const history = await messageModel.getRecentMessages(conversation_id, 10);

      // Get system prompt from system_prompt_id or use default/mode-specific prompt
      const PROMPTS_CONFIG = require('../config/prompts.config');
      let systemPrompt = null;

      if (conversation.system_prompt_id) {
        const prompt = await systemPromptModel.findById(
          conversation.system_prompt_id,
          user_id
        );
        systemPrompt = prompt ? prompt.prompt_text : null;
      } else if (conversation.chat_mode === 'custom_prompt') {
        // Use default system prompt for custom_prompt mode when no specific prompt selected
        systemPrompt = PROMPTS_CONFIG.DEFAULT_SYSTEM_PROMPT;
      } else if (conversation.chat_mode === 'url_context') {
        // Use URL context system prompt for url_context mode
        systemPrompt = PROMPTS_CONFIG.URL_CONTEXT_SYSTEM_PROMPT;
      }

      // Generate AI response
      const aiResponse = await geminiChatService.generateResponse({
        model_name: model,
        messages: history,
        system_prompt: systemPrompt,
        files: files,
        urls: urls,
        temperature,
        max_tokens
      });

      // Save assistant message
      const assistantMessage = await messageModel.create({
        conversation_id,
        role: 'assistant',
        content: aiResponse.text
      });

      // Update conversation timestamp
      await conversationModel.touch(conversation_id);

      // Calculate cost
      const cost = geminiChatService.calculateCost(
        model,
        aiResponse.usage.promptTokens,
        aiResponse.usage.completionTokens
      );

      // Log API usage
      await apiUsageModel.create({
        user_id,
        conversation_id,
        message_id: assistantMessage.id,
        provider: 'google_gemini',
        model_name: model,
        prompt_tokens: aiResponse.usage.promptTokens,
        completion_tokens: aiResponse.usage.completionTokens,
        total_tokens: aiResponse.usage.totalTokens,
        cost_estimate: cost,
        response_time_ms: Date.now() - startTime,
        status: 'success',
        metadata: {
          temperature,
          max_tokens,
          file_count: files.length,
          url_count: urls.length
        }
      });

      res.json({
        message: 'Response generated successfully',
        assistant_message: assistantMessage,
        usage: aiResponse.usage,
        cost_estimate: cost
      });
    } catch (error) {
      console.error('Send message error:', error);

      // Log failed API usage
      try {
        await apiUsageModel.create({
          user_id: req.user.user_id,
          conversation_id: req.body.conversation_id,
          provider: 'google_gemini',
          model_name: req.body.model || 'gemini-2.5-flash',
          status: 'error',
          error_message: error.message,
          response_time_ms: Date.now() - startTime,
          metadata: { error_stack: error.stack }
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }

      res.status(500).json({ error: error.message || 'Failed to generate response' });
    }
  }

  /**
   * Get API usage statistics
   */
  async getUsageStats(req, res) {
    try {
      const user_id = req.user.user_id;
      const { start_date, end_date } = req.query;

      const filters = {
        start_date,
        end_date
      };

      const stats = await apiUsageModel.getStatsByUserId(user_id, filters);

      res.json({ stats });
    } catch (error) {
      console.error('Get usage stats error:', error);
      res.status(500).json({ error: 'Failed to fetch usage statistics' });
    }
  }

  /**
   * Get usage history
   */
  async getUsageHistory(req, res) {
    try {
      const user_id = req.user.user_id;
      const { start_date, end_date, limit, offset } = req.query;

      const filters = {
        start_date,
        end_date,
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
      };

      const history = await apiUsageModel.findByUserId(user_id, filters);

      res.json({
        history,
        count: history.length
      });
    } catch (error) {
      console.error('Get usage history error:', error);
      res.status(500).json({ error: 'Failed to fetch usage history' });
    }
  }
}

module.exports = new ChatController();
