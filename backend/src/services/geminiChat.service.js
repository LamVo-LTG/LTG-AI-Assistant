const { GoogleGenAI, createUserContent, createPartFromUri } = require('@google/genai');
require('dotenv').config();

// Initialize new Google Gen AI client
// Use GOOGLE_API_KEY (new SDK standard) or fall back to GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY });

// Safety settings for all Gemini responses (new SDK format)
const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
];

class GeminiChatService {
  /**
   * Generate AI response (non-streaming) using new @google/genai SDK
   * @param {Object} options - Chat options
   * @returns {Promise<Object>} - AI response and metadata
   */
  async generateResponse(options) {
    const {
      model_name = 'gemini-2.5-flash',
      messages = [],
      system_prompt = null,
      files = [],  // Array of {uri, mimeType} objects
      urls = [],
      temperature = 0.7,
      max_tokens = 2048
    } = options;

    try {
      // Build conversation history
      const history = this._buildHistory(messages);

      // Get last user message
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role !== 'user') {
        throw new Error('Last message must be from user');
      }

      // Build message parts with files and URLs
      const messageParts = this._buildMessageParts(
        lastMessage.content,
        files,
        urls
      );

      // Build request config
      const config = {
        temperature,
        maxOutputTokens: max_tokens,
        safetySettings: SAFETY_SETTINGS,
        thinkingConfig: {
          thinkingBudget: -1  // Dynamic thinking - model adjusts based on complexity
        }
      };

      // Enable tools based on context
      if (urls.length > 0) {
        // Enable both Google Search and URL Context when URLs are provided
        config.tools = [{ urlContext: {} }];
        console.log(`🔗 URL Context enabled for ${urls.length} URL(s)`);
      } else {
        // Enable only Google Search when no URLs provided
        config.tools = [{ googleSearch: {} }];
        console.log(`🔍 Google Search grounding enabled`);
      }

      // Add system instruction if provided
      let systemInstruction = undefined;
      if (system_prompt) {
        systemInstruction = system_prompt;
      }

      // Build contents array with history + current message
      const contents = [
        ...history.map(msg => ({
          role: msg.role,
          parts: msg.parts
        })),
        {
          role: 'user',
          parts: messageParts
        }
      ];

      // Log for debugging
      console.log('Sending to Gemini:', {
        files_count: files.length,
        urls_count: urls.length,
        message_parts_count: messageParts.length,
        history_length: history.length
      });

      // Generate response using new SDK
      // IMPORTANT: systemInstruction must be inside config object
      const response = await ai.models.generateContent({
        model: model_name,
        contents: contents,
        config: {
          ...config,
          systemInstruction: systemInstruction
        }
      });

      let text = response.text;

      // Extract grounding metadata and add citations
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      if (groundingMetadata?.groundingChunks?.length > 0) {
        console.log('📊 Grounding metadata found:', {
          supports: groundingMetadata.groundingSupports?.length || 0,
          chunks: groundingMetadata.groundingChunks?.length || 0
        });

        // Add inline citation numbers [1], [2], [1][2]
        text = this._addInlineCitations(text, groundingMetadata);

        // Append numbered sources list at the end
        const citationText = this._formatCitationSources(groundingMetadata);
        if (citationText) {
          text += citationText;
        }
      }

      // Get usage metadata
      const usage = response.usageMetadata || {};

      return {
        text,
        usage: {
          promptTokens: usage.promptTokenCount || 0,
          completionTokens: usage.candidatesTokenCount || 0,
          totalTokens: usage.totalTokenCount || 0
        },
        model: model_name
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  /**
   * Generate streaming response using new @google/genai SDK
   * @param {Object} options - Chat options
   * @returns {AsyncGenerator} - Streaming response
   */
  async *generateStreamingResponse(options) {
    const {
      model_name = 'gemini-2.5-flash',
      messages = [],
      system_prompt = null,
      files = [],  // Array of {uri, mimeType} objects
      urls = [],
      temperature = 0.7,
      max_tokens = 2048
    } = options;

    try {
      // Build conversation history
      const history = this._buildHistory(messages);

      // Get last user message
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role !== 'user') {
        throw new Error('Last message must be from user');
      }

      // Build message parts
      const messageParts = this._buildMessageParts(
        lastMessage.content,
        files,
        urls
      );

      // Build request config
      const config = {
        temperature,
        maxOutputTokens: max_tokens,
        safetySettings: SAFETY_SETTINGS,
        thinkingConfig: {
          thinkingBudget: -1  // Dynamic thinking - model adjusts based on complexity
        }
      };

      // Tool selection logic:
      // - If URLs provided: Use ONLY URL Context (user wants specific sources)
      // - If no URLs: Use Google Search (for up-to-date information)
      if (urls.length > 0) {
        config.tools = [{ urlContext: {} }, { googleSearch: {} }];
        console.log(`🔗 URL Context and Google Search grounding enabled for ${urls.length} URL(s) - using ONLY provided URLs (streaming)`);
      } else {
        config.tools = [{ googleSearch: {} }];
        console.log(`🔍 Google Search grounding enabled - no URLs provided (streaming)`);
      }

      // Add system instruction if provided
      let systemInstruction = undefined;
      if (system_prompt) {
        systemInstruction = system_prompt;
        console.log('🎯 Sending system instruction to Gemini (streaming):', system_prompt.substring(0, 100) + '...');
      } else {
        console.log('⚠️ No system instruction provided to Gemini (streaming)');
      }

      // Build contents array with history + current message
      const contents = [
        ...history.map(msg => ({
          role: msg.role,
          parts: msg.parts
        })),
        {
          role: 'user',
          parts: messageParts
        }
      ];

      console.log('📤 Calling Gemini API with:', {
        model: model_name,
        systemInstruction: systemInstruction ? 'Provided ✓' : 'Not provided ✗',
        historyLength: history.length,
        temperature,
        max_tokens
      });

      // Stream response using new SDK
      // IMPORTANT: systemInstruction must be inside config object
      const response = await ai.models.generateContentStream({
        model: model_name,
        contents: contents,
        config: {
          ...config,
          systemInstruction: systemInstruction
        }
      });

      // Collect full text and chunks for inline citations
      let fullText = '';
      let lastChunk = null;

      // Yield chunks as they arrive
      for await (const chunk of response) {
        if (chunk.text) {
          fullText += chunk.text;
          lastChunk = chunk;
          yield {
            text: chunk.text,
            done: false
          };
        }
      }

      // After streaming completes, check for grounding metadata and add inline citations
      const groundingMetadata = lastChunk?.candidates?.[0]?.groundingMetadata;
      if (groundingMetadata?.groundingSupports?.length > 0) {
        console.log('📊 Grounding metadata found (streaming):', {
          supports: groundingMetadata.groundingSupports?.length || 0,
          chunks: groundingMetadata.groundingChunks?.length || 0
        });

        // Generate citation text with inline links
        const citationText = this._formatCitationSources(groundingMetadata);
        if (citationText) {
          // Yield citations as a separate chunk
          yield {
            text: citationText,
            done: false
          };
        }
      }

      // Signal completion
      yield {
        text: '',
        done: true
      };
    } catch (error) {
      console.error('Gemini streaming error:', error);
      throw new Error(`Failed to generate streaming response: ${error.message}`);
    }
  }

  /**
   * Build conversation history from messages
   * Ensures history starts with user message and follows alternating pattern
   * @private
   */
  _buildHistory(messages) {
    // Remove the last message (it will be sent separately)
    let history = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // Gemini requires history to start with a user message
    // Remove any leading model messages
    while (history.length > 0 && history[0].role === 'model') {
      history.shift();
    }

    // Validate alternating pattern (user -> model -> user -> model)
    // If invalid, filter to maintain valid pattern
    const validHistory = [];
    let expectedRole = 'user';

    for (const msg of history) {
      if (msg.role === expectedRole) {
        validHistory.push(msg);
        expectedRole = expectedRole === 'user' ? 'model' : 'user';
      }
      // Skip messages that break the alternating pattern
    }

    return validHistory;
  }

  /**
   * Build message parts with text, files, and URLs
   * @private
   */
  _buildMessageParts(text, files = [], urls = []) {
    const parts = [];

    // Add text with URLs appended naturally
    // When urlContext tool is enabled, Gemini automatically retrieves URL content
    let messageText = text;
    if (urls.length > 0) {
      const urlText = '\n\nReply base on the provided URLs only:\n' + urls.join('\n');
      messageText += urlText;
      console.log(`📎 Added ${urls.length} URL(s) to message context`);
    }

    parts.push({ text: messageText });

    // Add files (from Gemini File API) with MIME types from database
    for (const file of files) {
      const filePart = {
        fileData: {
          mimeType: file.mimeType,  // Use MIME type from database
          fileUri: file.uri
        }
      };
      console.log('Adding file part:', filePart);
      parts.push(filePart);
    }

    console.log('Built message parts:', JSON.stringify(parts, null, 2));
    return parts;
  }

  /**
   * Convert byte position to character position for UTF-8 text
   * Gemini API returns byte positions, but JavaScript uses character positions
   * @private
   */
  _byteToCharIndex(text, byteIndex) {
    let byteCount = 0;
    let charIndex = 0;

    // Iterate through each character
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);

      // Calculate byte size for this character (UTF-8 encoding)
      let byteSize = 1;
      if (charCode >= 0x80 && charCode <= 0x7FF) {
        byteSize = 2; // 2-byte character
      } else if (charCode >= 0x800 && charCode <= 0xFFFF) {
        byteSize = 3; // 3-byte character (most Vietnamese)
      } else if (charCode >= 0x10000) {
        byteSize = 4; // 4-byte character (emoji, rare)
      }

      // Check if we've reached the target byte position
      if (byteCount + byteSize > byteIndex) {
        return charIndex;
      }

      byteCount += byteSize;
      charIndex++;
    }

    return charIndex;
  }

  /**
   * Add inline citations to text based on grounding metadata
   * Inserts citation links like [1](url) at appropriate positions
   * Handles UTF-8 multibyte characters (Vietnamese, emoji, etc.)
   * @private
   */
  _addInlineCitations(text, groundingMetadata) {
    // Return original text if no grounding metadata
    if (!groundingMetadata?.groundingSupports || !groundingMetadata?.groundingChunks) {
      return text;
    }

    const supports = groundingMetadata.groundingSupports;
    const chunks = groundingMetadata.groundingChunks;

    // Sort by endIndex in descending order to avoid index shifting when inserting
    const sortedSupports = supports
      .filter(support => support.segment && support.groundingChunkIndices)
      .sort((a, b) => b.segment.endIndex - a.segment.endIndex);

    let enhancedText = text;

    for (const support of sortedSupports) {
      // Convert byte position to character position for UTF-8 text
      const byteEndIndex = support.segment.endIndex;
      const charEndIndex = this._byteToCharIndex(enhancedText, byteEndIndex);

      const indices = support.groundingChunkIndices || [];

      // Create clickable citation numbers: [[1]](url), [[2]](url)
      const citationNumbers = indices
        .filter(i => i < chunks.length && chunks[i]?.web?.uri)
        .map(i => {
          const uri = chunks[i].web.uri;
          return `[[${i + 1}]](${uri})`;
        })
        .join('');

      // Insert citation at the end of the supported text segment (using character position)
      if (citationNumbers) {
        enhancedText = enhancedText.slice(0, charEndIndex) + citationNumbers + enhancedText.slice(charEndIndex);
      }
    }

    console.log(`📚 Added ${sortedSupports.length} inline citation(s)`);
    return enhancedText;
  }

  /**
   * Format citation sources as a readable list for streaming responses
   * Creates a "Sources:" section with numbered links
   * @private
   */
  _formatCitationSources(groundingMetadata) {
    if (!groundingMetadata?.groundingChunks?.length) {
      return '';
    }

    const chunks = groundingMetadata.groundingChunks;

    // Build sources list
    const sourcesList = chunks
      .filter(chunk => chunk?.web?.uri)
      .map((chunk, index) => {
        const title = chunk.web.title || 'Source';
        const uri = chunk.web.uri;
        return `${index + 1}. [${title}](${uri})`;
      })
      .join('\n');

    if (!sourcesList) {
      return '';
    }

    // Format as markdown section
    return `\n\n---\n**Nguồn tham khảo (Sources):**\n${sourcesList}`;
  }

  /**
   * Calculate estimated cost for API usage
   * @param {string} model - Model name
   * @param {number} promptTokens - Number of prompt tokens
   * @param {number} completionTokens - Number of completion tokens
   * @returns {number} - Estimated cost in USD
   */
  calculateCost(model, promptTokens, completionTokens) {
    // Gemini pricing (as of 2025)
    // Free tier: First 15 requests per minute, 1500 requests per day
    // Paid tier pricing varies by model
    const pricing = {
      'gemini-2.5-flash': {
        input: 0.000075,  // per 1K tokens
        output: 0.0003    // per 1K tokens
      },
      'gemini-1.5-pro': {
        input: 0.00025,
        output: 0.00125
      },
      'gemini-1.5-flash': {
        input: 0.000075,
        output: 0.0003
      }
    };

    const modelPricing = pricing[model] || pricing['gemini-2.5-flash'];
    const inputCost = (promptTokens / 1000) * modelPricing.input;
    const outputCost = (completionTokens / 1000) * modelPricing.output;

    return inputCost + outputCost;
  }
}

module.exports = new GeminiChatService();
