const geminiChatService = require('../services/geminiChat.service');
const conversationModel = require('../models/conversation.model');
const messageModel = require('../models/message.model');
const resourceModel = require('../models/resource.model');
const systemPromptModel = require('../models/systemPrompt.model');
const apiUsageModel = require('../models/apiUsage.model');
const jwtConfig = require('../config/jwt');

class ChatSocketHandler {
  constructor(io) {
    this.io = io;
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    // Authentication middleware for Socket.io
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded = jwtConfig.verifyToken(token);
        socket.user = decoded;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.user.user_id}`);

      // Handle streaming chat
      socket.on('send_message', async (data) => {
        await this.handleStreamingMessage(socket, data);
      });

      // Disconnect handler
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.user.user_id}`);
      });
    });
  }

  async handleStreamingMessage(socket, data) {
    const startTime = Date.now();

    try {
      const {
        conversation_id,
        message,
        model = 'gemini-2.5-flash',
        temperature = 0.7,
        max_tokens = 2048,
        resource_ids = []  // Resource IDs for this specific message
      } = data;

      const user_id = socket.user.user_id;

      // Validation
      if (!conversation_id || !message) {
        socket.emit('error', { error: 'conversation_id and message are required' });
        return;
      }

      // Verify conversation belongs to user
      const conversation = await conversationModel.findById(conversation_id, user_id);
      if (!conversation) {
        socket.emit('error', { error: 'Conversation not found' });
        return;
      }

      console.log('💬 Conversation details:', {
        id: conversation.conversation_id,
        mode: conversation.chat_mode,
        has_system_prompt_id: !!conversation.system_prompt_id,
        system_prompt_id: conversation.system_prompt_id
      });

      // Get resources BEFORE saving user message (to include in metadata)
      const resources = await resourceModel.findByConversationId(conversation_id);

      // Filter resources by resource_ids if provided (for this specific message)
      const messageResources = resource_ids.length > 0
        ? resources.filter(r => resource_ids.includes(r.resource_id))
        : [];  // No attachments if no resource_ids provided

      // Prepare file attachments for metadata (using local file path for frontend display)
      const fileAttachments = messageResources
        .filter(r => r.resource_type === 'file')
        .map(r => ({
          resourceId: r.resource_id,
          name: r.name,
          filePath: r.file_path,  // Local file path for download/display
          mimeType: r.mime_type,
          fileSize: r.file_size
        }));

      // Prepare files for Gemini API (using Gemini URI)
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
        socket.emit('error', {
          error: 'Maximum 20 URLs allowed per request (Gemini API limitation)'
        });
        return;
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
      const userMessage = await messageModel.create({
        conversation_id,
        role: 'user',
        content: message,
        metadata: messageMetadata
      });

      // Emit confirmation
      socket.emit('message_saved', { message: userMessage });

      // Get conversation history
      const history = await messageModel.getRecentMessages(conversation_id, 10);

      // Get system prompt from system_prompt_id or use default/mode-specific prompt
      const PROMPTS_CONFIG = require('../config/prompts.config');
      let systemPrompt = null;

      if (conversation.system_prompt_id) {
        console.log('🔍 Attempting to retrieve system prompt with:', {
          system_prompt_id: conversation.system_prompt_id,
          user_id: user_id,
          chat_mode: conversation.chat_mode
        });

        const prompt = await systemPromptModel.findById(
          conversation.system_prompt_id,
          user_id
        );

        console.log('🔍 Retrieved prompt object:', {
          promptExists: !!prompt,
          promptName: prompt?.name,
          hasPromptText: !!prompt?.prompt_text,
          promptTextPreview: prompt?.prompt_text?.substring(0, 100)
        });

        systemPrompt = prompt ? prompt.prompt_text : null;

        if (systemPrompt) {
          console.log('✅ System prompt from system_prompt_id:', systemPrompt.substring(0, 100) + '...');
        } else {
          console.log('❌ Failed to retrieve system prompt - prompt object was:', prompt);
        }
      } else if (conversation.chat_mode === 'custom_prompt') {
        // Use default system prompt for custom_prompt mode when no specific prompt selected
        systemPrompt = PROMPTS_CONFIG.DEFAULT_SYSTEM_PROMPT;
        console.log('📝 Using default system prompt for custom_prompt mode');
      } else if (conversation.chat_mode === 'url_context') {
        // Use URL context system prompt for url_context mode
        systemPrompt = PROMPTS_CONFIG.URL_CONTEXT_SYSTEM_PROMPT;
        console.log('📝 Using URL context system prompt for url_context mode');
      } else {
        console.log('ℹ️ No system prompt required for this conversation mode');
      }

      // Start streaming
      socket.emit('stream_start');

      let fullResponse = '';
      let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      // Generate streaming response
      const stream = geminiChatService.generateStreamingResponse({
        model_name: model,
        messages: history,
        system_prompt: systemPrompt,
        files: files,  // Use new files format
        urls: urls,
        temperature,
        max_tokens
      });

      // Stream chunks to client
      for await (const chunk of stream) {
        if (chunk.done) {
          socket.emit('stream_end', { usage });
        } else {
          fullResponse += chunk.text;
          socket.emit('stream_chunk', { chunk: chunk.text });
        }
      }

      // Save assistant message
      const assistantMessage = await messageModel.create({
        conversation_id,
        role: 'assistant',
        content: fullResponse
      });

      // Update conversation timestamp
      await conversationModel.touch(conversation_id);

      // Calculate cost
      const cost = geminiChatService.calculateCost(
        model,
        usage.promptTokens,
        usage.completionTokens
      );

      // Log API usage
      await apiUsageModel.create({
        user_id,
        conversation_id,
        message_id: assistantMessage.id,
        provider: 'google_gemini',
        model_name: model,
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
        cost_estimate: cost,
        response_time_ms: Date.now() - startTime,
        status: 'success',
        metadata: {
          temperature,
          max_tokens,
          file_count: files.length,
          url_count: urls.length,
          streaming: true
        }
      });

      // Emit completion
      socket.emit('message_complete', {
        message: assistantMessage,
        usage,
        cost_estimate: cost
      });

    } catch (error) {
      console.error('Streaming message error:', error);

      // Log failed API usage
      try {
        await apiUsageModel.create({
          user_id: socket.user.user_id,
          conversation_id: data.conversation_id,
          provider: 'google_gemini',
          model_name: data.model || 'gemini-2.5-flash',
          status: 'error',
          error_message: error.message,
          response_time_ms: Date.now() - startTime,
          metadata: {
            error_stack: error.stack,
            streaming: true
          }
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }

      socket.emit('error', { error: error.message || 'Failed to generate response' });
    }
  }
}

module.exports = ChatSocketHandler;
