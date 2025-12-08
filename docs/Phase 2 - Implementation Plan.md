# Phase 2: Conversation & Message Management - Implementation Plan

**Created:** 2025-10-24
**Project:** LTG Assistant v1
**Phase:** 2 of 5
**Dependencies:** Phase 1 (Authentication & User Management) ✅ Complete

---

## Overview

Phase 2 focuses on building the conversation and message management system. This includes:
- Creating conversations with different chat modes (AI Agent, Custom Prompt, URL Context)
- Storing and retrieving messages
- Managing conversation history (view, search, edit, delete, pin)
- Connecting the ai-chatbot.html frontend to the backend

---

## Database Schema Review

**Tables Used in Phase 2:**

### conversations
```sql
CREATE TABLE conversations (
    conversation_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(255),
    chat_mode VARCHAR(50) NOT NULL CHECK (chat_mode IN ('ai_agent', 'custom_prompt', 'url_context')),
    system_prompt_id INTEGER REFERENCES system_prompts(system_prompt_id) ON DELETE SET NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### messages
```sql
CREATE TABLE messages (
    message_id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Key Indexes
```sql
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
```

---

## 2.1 Backend Directory Structure

Add these new files to your existing backend:

```
backend/
├── src/
│   ├── models/
│   │   ├── user.model.js              # ✅ Already exists
│   │   ├── conversation.model.js      # 🆕 New
│   │   └── message.model.js           # 🆕 New
│   ├── controllers/
│   │   ├── auth.controller.js         # ✅ Already exists
│   │   ├── users.controller.js        # ✅ Already exists
│   │   ├── conversation.controller.js # 🆕 New
│   │   └── message.controller.js      # 🆕 New
│   ├── routes/
│   │   ├── auth.routes.js             # ✅ Already exists
│   │   ├── users.routes.js            # ✅ Already exists
│   │   ├── conversation.routes.js     # 🆕 New
│   │   └── message.routes.js          # 🆕 New
│   └── app.js                         # 🔄 Update to add new routes
```

---

## 2.2 Conversation Model

**File: `src/models/conversation.model.js`**

```javascript
const pool = require('../config/database');

class ConversationModel {
  // Create new conversation
  async create(conversationData) {
    const { user_id, title, chat_mode, system_prompt_id } = conversationData;

    const query = `
      INSERT INTO conversations (user_id, title, chat_mode, system_prompt_id)
      VALUES ($1, $2, $3, $4)
      RETURNING conversation_id, user_id, title, chat_mode, system_prompt_id, is_pinned, created_at, updated_at
    `;

    const result = await pool.query(query, [
      user_id,
      title || 'New Conversation',
      chat_mode,
      system_prompt_id || null
    ]);

    return result.rows[0];
  }

  // Get conversation by ID
  async findById(conversationId, userId) {
    const query = `
      SELECT
        c.conversation_id,
        c.user_id,
        c.title,
        c.chat_mode,
        c.system_prompt_id,
        c.is_pinned,
        c.created_at,
        c.updated_at,
        sp.name as system_prompt_name,
        COUNT(m.message_id) as message_count
      FROM conversations c
      LEFT JOIN system_prompts sp ON c.system_prompt_id = sp.system_prompt_id
      LEFT JOIN messages m ON c.conversation_id = m.conversation_id
      WHERE c.conversation_id = $1 AND c.user_id = $2
      GROUP BY c.conversation_id, sp.name
    `;

    const result = await pool.query(query, [conversationId, userId]);
    return result.rows[0];
  }

  // Get all conversations for a user
  async findByUserId(userId, filters = {}) {
    const { chat_mode, search, pinned_only, limit = 50, offset = 0 } = filters;

    let query = `
      SELECT
        c.conversation_id,
        c.user_id,
        c.title,
        c.chat_mode,
        c.system_prompt_id,
        c.is_pinned,
        c.created_at,
        c.updated_at,
        sp.name as system_prompt_name,
        COUNT(m.message_id) as message_count,
        MAX(m.created_at) as last_message_at
      FROM conversations c
      LEFT JOIN system_prompts sp ON c.system_prompt_id = sp.system_prompt_id
      LEFT JOIN messages m ON c.conversation_id = m.conversation_id
      WHERE c.user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    // Filter by chat mode
    if (chat_mode) {
      query += ` AND c.chat_mode = $${paramIndex}`;
      params.push(chat_mode);
      paramIndex++;
    }

    // Filter by pinned
    if (pinned_only) {
      query += ` AND c.is_pinned = true`;
    }

    // Search in title
    if (search) {
      query += ` AND c.title ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += `
      GROUP BY c.conversation_id, sp.name
      ORDER BY c.is_pinned DESC, c.updated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Update conversation
  async update(conversationId, userId, updates) {
    const { title, system_prompt_id, is_pinned } = updates;

    const query = `
      UPDATE conversations
      SET
        title = COALESCE($1, title),
        system_prompt_id = COALESCE($2, system_prompt_id),
        is_pinned = COALESCE($3, is_pinned),
        updated_at = NOW()
      WHERE conversation_id = $4 AND user_id = $5
      RETURNING conversation_id, user_id, title, chat_mode, system_prompt_id, is_pinned, updated_at
    `;

    const result = await pool.query(query, [
      title,
      system_prompt_id,
      is_pinned,
      conversationId,
      userId
    ]);

    return result.rows[0];
  }

  // Delete conversation (cascade deletes messages)
  async delete(conversationId, userId) {
    const query = `
      DELETE FROM conversations
      WHERE conversation_id = $1 AND user_id = $2
      RETURNING conversation_id
    `;

    const result = await pool.query(query, [conversationId, userId]);
    return result.rows[0];
  }

  // Toggle pin status
  async togglePin(conversationId, userId) {
    const query = `
      UPDATE conversations
      SET is_pinned = NOT is_pinned, updated_at = NOW()
      WHERE conversation_id = $1 AND user_id = $2
      RETURNING conversation_id, is_pinned
    `;

    const result = await pool.query(query, [conversationId, userId]);
    return result.rows[0];
  }

  // Get conversation count by mode
  async getStatsByUserId(userId) {
    const query = `
      SELECT
        chat_mode,
        COUNT(*) as count,
        COUNT(CASE WHEN is_pinned THEN 1 END) as pinned_count
      FROM conversations
      WHERE user_id = $1
      GROUP BY chat_mode
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  // Update conversation timestamp (called when new message is added)
  async touch(conversationId) {
    const query = `
      UPDATE conversations
      SET updated_at = NOW()
      WHERE conversation_id = $1
      RETURNING updated_at
    `;

    const result = await pool.query(query, [conversationId]);
    return result.rows[0];
  }
}

module.exports = new ConversationModel();
```

---

## 2.3 Message Model

**File: `src/models/message.model.js`**

```javascript
const pool = require('../config/database');

class MessageModel {
  // Create new message
  async create(messageData) {
    const { conversation_id, role, content } = messageData;

    const query = `
      INSERT INTO messages (conversation_id, role, content)
      VALUES ($1, $2, $3)
      RETURNING message_id, conversation_id, role, content, created_at
    `;

    const result = await pool.query(query, [conversation_id, role, content]);
    return result.rows[0];
  }

  // Get all messages for a conversation
  async findByConversationId(conversationId, userId, options = {}) {
    const { limit = 100, offset = 0 } = options;

    // First verify user owns this conversation
    const authQuery = `
      SELECT 1 FROM conversations
      WHERE conversation_id = $1 AND user_id = $2
    `;

    const authResult = await pool.query(authQuery, [conversationId, userId]);

    if (authResult.rows.length === 0) {
      throw new Error('Conversation not found or access denied');
    }

    // Get messages
    const query = `
      SELECT
        message_id,
        conversation_id,
        role,
        content,
        created_at
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [conversationId, limit, offset]);
    return result.rows;
  }

  // Get message by ID
  async findById(messageId) {
    const query = `
      SELECT message_id, conversation_id, role, content, created_at
      FROM messages
      WHERE message_id = $1
    `;

    const result = await pool.query(query, [messageId]);
    return result.rows[0];
  }

  // Get message count for conversation
  async countByConversationId(conversationId) {
    const query = `
      SELECT COUNT(*) as count
      FROM messages
      WHERE conversation_id = $1
    `;

    const result = await pool.query(query, [conversationId]);
    return parseInt(result.rows[0].count);
  }

  // Delete message
  async delete(messageId, conversationId, userId) {
    // Verify user owns the conversation
    const authQuery = `
      SELECT 1 FROM conversations
      WHERE conversation_id = $1 AND user_id = $2
    `;

    const authResult = await pool.query(authQuery, [conversationId, userId]);

    if (authResult.rows.length === 0) {
      throw new Error('Conversation not found or access denied');
    }

    // Delete message
    const query = `
      DELETE FROM messages
      WHERE message_id = $1 AND conversation_id = $2
      RETURNING message_id
    `;

    const result = await pool.query(query, [messageId, conversationId]);
    return result.rows[0];
  }

  // Delete all messages in a conversation
  async deleteAllByConversationId(conversationId, userId) {
    // Verify user owns the conversation
    const authQuery = `
      SELECT 1 FROM conversations
      WHERE conversation_id = $1 AND user_id = $2
    `;

    const authResult = await pool.query(authQuery, [conversationId, userId]);

    if (authResult.rows.length === 0) {
      throw new Error('Conversation not found or access denied');
    }

    const query = `
      DELETE FROM messages
      WHERE conversation_id = $1
      RETURNING COUNT(*) as deleted_count
    `;

    const result = await pool.query(query, [conversationId]);
    return result.rows[0];
  }

  // Get last N messages for context (for AI)
  async getRecentMessages(conversationId, limit = 10) {
    const query = `
      SELECT role, content, created_at
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [conversationId, limit]);
    // Return in chronological order
    return result.rows.reverse();
  }
}

module.exports = new MessageModel();
```

---

## 2.4 Conversation Controller

**File: `src/controllers/conversation.controller.js`**

```javascript
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
```

---

## 2.5 Message Controller

**File: `src/controllers/message.controller.js`**

```javascript
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
```

---

## 2.6 Routes

**File: `src/routes/conversation.routes.js`**

```javascript
const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversation.controller');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Conversation routes
router.post('/', conversationController.createConversation);
router.get('/', conversationController.getConversations);
router.get('/stats', conversationController.getStats);
router.get('/:id', conversationController.getConversationById);
router.put('/:id', conversationController.updateConversation);
router.delete('/:id', conversationController.deleteConversation);
router.patch('/:id/pin', conversationController.togglePin);

module.exports = router;
```

**File: `src/routes/message.routes.js`**

```javascript
const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Message routes
router.post('/', messageController.createMessage);
router.get('/:conversation_id', messageController.getMessages);
router.delete('/:conversation_id/:message_id', messageController.deleteMessage);
router.delete('/:conversation_id', messageController.deleteAllMessages);

module.exports = router;
```

---

## 2.7 Update Express App

**File: `src/app.js`** (Update to add new routes)

```javascript
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const conversationRoutes = require('./routes/conversation.routes');  // 🆕 Add
const messageRoutes = require('./routes/message.routes');            // 🆕 Add

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5500',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/conversations', conversationRoutes);  // 🆕 Add
app.use('/api/messages', messageRoutes);            // 🆕 Add

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

module.exports = app;
```

---

## 2.8 Frontend Integration

### Update ai-chatbot.html

Add JavaScript to handle conversations and messages:

```javascript
// Configuration
const API_URL = 'http://localhost:3000/api';
let currentConversationId = null;
let currentChatMode = 'ai_agent'; // Default mode

// Get auth token
function getAuthToken() {
  return localStorage.getItem('token');
}

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getAuthToken()}`
  };
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadConversations();
  setupEventListeners();
});

// Check if user is authenticated
function checkAuth() {
  const token = getAuthToken();
  if (!token) {
    window.location.href = 'login.html';
  }
}

// Setup event listeners
function setupEventListeners() {
  // New conversation button
  document.getElementById('newConversationBtn').addEventListener('click', createNewConversation);

  // Chat mode selector
  document.getElementById('chatModeSelect').addEventListener('change', (e) => {
    currentChatMode = e.target.value;
  });

  // Send message form
  document.getElementById('messageForm').addEventListener('submit', sendMessage);

  // Logout button
  document.getElementById('logoutBtn').addEventListener('click', logout);
}

// Load all conversations
async function loadConversations(filters = {}) {
  try {
    const queryParams = new URLSearchParams(filters);
    const response = await fetch(`${API_URL}/conversations?${queryParams}`, {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      displayConversations(data.conversations);
    } else {
      console.error('Failed to load conversations:', data.error);
    }
  } catch (error) {
    console.error('Error loading conversations:', error);
  }
}

// Display conversations in sidebar
function displayConversations(conversations) {
  const container = document.getElementById('conversationsList');
  container.innerHTML = '';

  if (conversations.length === 0) {
    container.innerHTML = '<p class="no-conversations">No conversations yet. Start a new one!</p>';
    return;
  }

  conversations.forEach(conv => {
    const item = document.createElement('div');
    item.className = `conversation-item ${conv.is_pinned ? 'pinned' : ''}`;
    item.dataset.conversationId = conv.conversation_id;

    item.innerHTML = `
      <div class="conversation-header">
        <span class="conversation-title">${conv.title}</span>
        <button class="pin-btn" onclick="togglePin(${conv.conversation_id})">
          ${conv.is_pinned ? '📌' : '📍'}
        </button>
      </div>
      <div class="conversation-meta">
        <span class="chat-mode">${formatChatMode(conv.chat_mode)}</span>
        <span class="message-count">${conv.message_count} messages</span>
      </div>
      <div class="conversation-actions">
        <button onclick="loadConversation(${conv.conversation_id})">Open</button>
        <button onclick="editConversationTitle(${conv.conversation_id})">Rename</button>
        <button onclick="deleteConversation(${conv.conversation_id})">Delete</button>
      </div>
    `;

    container.appendChild(item);
  });
}

// Format chat mode for display
function formatChatMode(mode) {
  const modes = {
    'ai_agent': 'AI Agent',
    'custom_prompt': 'Custom Prompt',
    'url_context': 'URL Context'
  };
  return modes[mode] || mode;
}

// Create new conversation
async function createNewConversation() {
  try {
    const title = prompt('Enter conversation title:', 'New Conversation');
    if (!title) return;

    const response = await fetch(`${API_URL}/conversations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        title,
        chat_mode: currentChatMode
      })
    });

    const data = await response.json();

    if (response.ok) {
      currentConversationId = data.conversation.conversation_id;
      loadConversations(); // Refresh list
      loadConversation(currentConversationId); // Load new conversation
    } else {
      alert(data.error || 'Failed to create conversation');
    }
  } catch (error) {
    console.error('Error creating conversation:', error);
    alert('Failed to create conversation');
  }
}

// Load conversation messages
async function loadConversation(conversationId) {
  try {
    currentConversationId = conversationId;

    // Load conversation details
    const convResponse = await fetch(`${API_URL}/conversations/${conversationId}`, {
      headers: getAuthHeaders()
    });

    const convData = await convResponse.json();

    if (convResponse.ok) {
      document.getElementById('currentConversationTitle').textContent = convData.conversation.title;
      currentChatMode = convData.conversation.chat_mode;
    }

    // Load messages
    const msgResponse = await fetch(`${API_URL}/messages/${conversationId}`, {
      headers: getAuthHeaders()
    });

    const msgData = await msgResponse.json();

    if (msgResponse.ok) {
      displayMessages(msgData.messages);
    }

    // Highlight active conversation
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.classList.remove('active');
      if (parseInt(item.dataset.conversationId) === conversationId) {
        item.classList.add('active');
      }
    });

  } catch (error) {
    console.error('Error loading conversation:', error);
  }
}

// Display messages in chat area
function displayMessages(messages) {
  const container = document.getElementById('messagesContainer');
  container.innerHTML = '';

  messages.forEach(msg => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${msg.role}`;

    messageDiv.innerHTML = `
      <div class="message-header">
        <span class="message-role">${msg.role}</span>
        <span class="message-time">${formatTime(msg.created_at)}</span>
      </div>
      <div class="message-content">${escapeHtml(msg.content)}</div>
    `;

    container.appendChild(messageDiv);
  });

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// Send message
async function sendMessage(event) {
  event.preventDefault();

  if (!currentConversationId) {
    alert('Please select or create a conversation first');
    return;
  }

  const input = document.getElementById('messageInput');
  const content = input.value.trim();

  if (!content) return;

  try {
    // Add user message to UI immediately
    addMessageToUI('user', content);
    input.value = '';

    // Send to backend
    const response = await fetch(`${API_URL}/messages`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        conversation_id: currentConversationId,
        role: 'user',
        content
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || 'Failed to send message');
      // Remove message from UI if failed
      loadConversation(currentConversationId);
    }

    // TODO: In Phase 4, this will trigger AI response via Gemini API

  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message');
  }
}

// Add message to UI without API call (for immediate feedback)
function addMessageToUI(role, content) {
  const container = document.getElementById('messagesContainer');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message message-${role}`;

  messageDiv.innerHTML = `
    <div class="message-header">
      <span class="message-role">${role}</span>
      <span class="message-time">Just now</span>
    </div>
    <div class="message-content">${escapeHtml(content)}</div>
  `;

  container.appendChild(messageDiv);
  container.scrollTop = container.scrollHeight;
}

// Edit conversation title
async function editConversationTitle(conversationId) {
  const newTitle = prompt('Enter new title:');
  if (!newTitle) return;

  try {
    const response = await fetch(`${API_URL}/conversations/${conversationId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title: newTitle })
    });

    const data = await response.json();

    if (response.ok) {
      loadConversations(); // Refresh list
      if (currentConversationId === conversationId) {
        document.getElementById('currentConversationTitle').textContent = newTitle;
      }
    } else {
      alert(data.error || 'Failed to update title');
    }
  } catch (error) {
    console.error('Error updating title:', error);
  }
}

// Delete conversation
async function deleteConversation(conversationId) {
  if (!confirm('Are you sure you want to delete this conversation?')) return;

  try {
    const response = await fetch(`${API_URL}/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      if (currentConversationId === conversationId) {
        currentConversationId = null;
        document.getElementById('messagesContainer').innerHTML = '';
        document.getElementById('currentConversationTitle').textContent = 'Select a conversation';
      }
      loadConversations(); // Refresh list
    } else {
      alert(data.error || 'Failed to delete conversation');
    }
  } catch (error) {
    console.error('Error deleting conversation:', error);
  }
}

// Toggle pin
async function togglePin(conversationId) {
  try {
    const response = await fetch(`${API_URL}/conversations/${conversationId}/pin`, {
      method: 'PATCH',
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      loadConversations(); // Refresh list
    } else {
      alert(data.error || 'Failed to toggle pin');
    }
  } catch (error) {
    console.error('Error toggling pin:', error);
  }
}

// Logout
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

// Utility functions
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

---

## 2.9 API Endpoints Summary

### Conversations

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/conversations` | Create new conversation | Required |
| GET | `/api/conversations` | Get all conversations | Required |
| GET | `/api/conversations/:id` | Get conversation by ID | Required |
| PUT | `/api/conversations/:id` | Update conversation | Required |
| DELETE | `/api/conversations/:id` | Delete conversation | Required |
| PATCH | `/api/conversations/:id/pin` | Toggle pin status | Required |
| GET | `/api/conversations/stats` | Get conversation stats | Required |

### Messages

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/messages` | Create new message | Required |
| GET | `/api/messages/:conversation_id` | Get messages for conversation | Required |
| DELETE | `/api/messages/:conversation_id/:message_id` | Delete specific message | Required |
| DELETE | `/api/messages/:conversation_id` | Delete all messages | Required |

---

## 2.10 Testing Phase 2

### Backend API Tests (cURL)

**Create Conversation:**
```bash
curl -X POST http://localhost:3000/api/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"title":"Test Chat","chat_mode":"ai_agent"}'
```

**Get All Conversations:**
```bash
curl -X GET http://localhost:3000/api/conversations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get Conversation by ID:**
```bash
curl -X GET http://localhost:3000/api/conversations/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Create Message:**
```bash
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"conversation_id":1,"role":"user","content":"Hello AI!"}'
```

**Get Messages:**
```bash
curl -X GET http://localhost:3000/api/messages/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Update Conversation Title:**
```bash
curl -X PUT http://localhost:3000/api/conversations/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"title":"Updated Title"}'
```

**Toggle Pin:**
```bash
curl -X PATCH http://localhost:3000/api/conversations/1/pin \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Delete Conversation:**
```bash
curl -X DELETE http://localhost:3000/api/conversations/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### Frontend Testing with Playwright MCP

**Test Scenario 1: Create New Conversation**
```
Ask Claude: "Use Playwright to test creating a new conversation:
1. Navigate to http://localhost:5500/ai-chatbot.html
2. Login first if needed
3. Click 'New Conversation' button
4. Enter title 'Test Chat'
5. Verify conversation appears in sidebar
6. Take a screenshot"
```

**Test Scenario 2: Send and Display Messages**
```
Ask Claude: "Use Playwright to test the messaging flow:
1. Open an existing conversation
2. Type 'Hello, AI!' in the message input
3. Click send button
4. Verify message appears in chat area
5. Take a screenshot"
```

**Test Scenario 3: Edit Conversation Title**
```
Ask Claude: "Use Playwright to test editing conversation title:
1. Find a conversation in sidebar
2. Click 'Rename' button
3. Enter new title 'Updated Chat'
4. Verify title updates in sidebar
5. Take a screenshot"
```

**Test Scenario 4: Pin Conversation**
```
Ask Claude: "Use Playwright to test pinning:
1. Click pin button on a conversation
2. Verify conversation moves to top of list
3. Verify pin icon changes
4. Take a screenshot"
```

**Test Scenario 5: Delete Conversation**
```
Ask Claude: "Use Playwright to test deleting:
1. Click delete button on a conversation
2. Confirm deletion dialog
3. Verify conversation removed from list
4. Take a screenshot"
```

---

### Playwright MCP Test Checklist

**Conversation Management Tests:**
- [ ] Create new conversation with all chat modes
- [ ] View list of conversations
- [ ] Open conversation and see messages
- [ ] Edit conversation title
- [ ] Delete conversation
- [ ] Pin conversation (moves to top)
- [ ] Unpin conversation
- [ ] Filter conversations by chat mode
- [ ] Search conversations by title

**Message Tests:**
- [ ] Send user message
- [ ] View message history
- [ ] Messages display in correct order
- [ ] Message timestamps show correctly
- [ ] Clear all messages in conversation
- [ ] Auto-scroll to latest message

**UI/UX Tests:**
- [ ] Sidebar displays conversations correctly
- [ ] Active conversation is highlighted
- [ ] Empty state shows when no conversations
- [ ] Loading states appear correctly
- [ ] Error messages display properly
- [ ] Chat modes selector works

**Security Tests:**
- [ ] Cannot access other users' conversations
- [ ] Cannot send message to other users' conversations
- [ ] Unauthenticated users redirected to login

---

## 2.11 Manual Testing Checklist

**Backend API Tests:**
- [ ] Create conversation endpoint works
- [ ] Get all conversations returns user's conversations only
- [ ] Get conversation by ID returns correct data
- [ ] Update conversation title works
- [ ] Delete conversation removes conversation and messages
- [ ] Pin/unpin conversation works
- [ ] Create message endpoint works
- [ ] Get messages returns correct conversation messages
- [ ] Delete message works
- [ ] Cannot access other users' conversations
- [ ] Cannot send messages to other users' conversations

**Frontend Tests:**
- [ ] Login redirects to chatbot page
- [ ] Conversations list loads on page load
- [ ] Can create new conversation
- [ ] Can select and open conversation
- [ ] Messages display correctly
- [ ] Can send message
- [ ] Can edit conversation title
- [ ] Can delete conversation
- [ ] Can pin/unpin conversation
- [ ] Chat mode selector works
- [ ] Logout clears session

---

## Phase 2 Success Criteria

✅ Conversations can be created with different chat modes
✅ Messages can be sent and stored in database
✅ Conversation history displays correctly
✅ Users can edit conversation titles
✅ Users can pin important conversations
✅ Users can delete conversations (cascade deletes messages)
✅ Users can search/filter conversations
✅ Frontend chatbot UI connects to backend
✅ All API endpoints are secured with JWT
✅ Users can only access their own conversations
✅ Message ordering is correct (chronological)
✅ Conversation timestamps update when new message added

---

## Next Steps

After completing Phase 2:
1. ✅ Conversations and messages system fully functional
2. ✅ Frontend chatbot UI working
3. 🔜 Move to Phase 3: System Prompts, File Attachments & URL Context
4. 🔜 Then Phase 4: Gemini API Integration (AI responses)
5. 🔜 Finally Phase 5: AI Agent Feature

---

## Implementation Status

**Status:** ✅ **COMPLETED** (2025-10-24)

### What Was Implemented

#### Backend Components Created:
1. **conversation.model.js** - Complete conversation CRUD operations
   - [src/models/conversation.model.js](d:\SECOND-BRAIN\01_Projects\Building an AI Chatbot\Daily Progress\Project\backend\src\models\conversation.model.js:1)
2. **message.model.js** - Complete message CRUD operations
   - [src/models/message.model.js](d:\SECOND-BRAIN\01_Projects\Building an AI Chatbot\Daily Progress\Project\backend\src\models\message.model.js:1)
3. **conversation.controller.js** - All conversation endpoints
   - [src/controllers/conversation.controller.js](d:\SECOND-BRAIN\01_Projects\Building an AI Chatbot\Daily Progress\Project\backend\src\controllers\conversation.controller.js:1)
4. **message.controller.js** - All message endpoints
   - [src/controllers/message.controller.js](d:\SECOND-BRAIN\01_Projects\Building an AI Chatbot\Daily Progress\Project\backend\src\controllers\message.controller.js:1)
5. **conversation.routes.js** - Conversation route definitions
   - [src/routes/conversation.routes.js](d:\SECOND-BRAIN\01_Projects\Building an AI Chatbot\Daily Progress\Project\backend\src\routes\conversation.routes.js:1)
6. **message.routes.js** - Message route definitions
   - [src/routes/message.routes.js](d:\SECOND-BRAIN\01_Projects\Building an AI Chatbot\Daily Progress\Project\backend\src\routes\message.routes.js:1)
7. **Updated app.js** - Registered new routes
   - [src/app.js](d:\SECOND-BRAIN\01_Projects\Building an AI Chatbot\Daily Progress\Project\backend\src\app.js:1)

#### API Endpoints Tested & Working:
- ✅ `POST /api/conversations` - Create conversation
- ✅ `GET /api/conversations` - Get all conversations
- ✅ `GET /api/conversations/:id` - Get conversation by ID
- ✅ `PUT /api/conversations/:id` - Update conversation
- ✅ `PATCH /api/conversations/:id/pin` - Toggle pin status
- ✅ `POST /api/messages` - Create message
- ✅ `GET /api/messages/:conversation_id` - Get messages

#### Key Implementation Notes:
1. **Database Schema Alignment**: Updated models to match actual database schema
   - Used `id` instead of `conversation_id` / `message_id` (database uses UUID `id` column)
   - Used `mode` instead of `chat_mode` (database column name)
2. **Simple & Maintainable**: Code follows existing patterns from Phase 1
3. **Security**: All endpoints require JWT authentication
4. **Constraint Handling**: Database enforces prompt requirements:
   - `ai_agent` mode requires `system_prompt_id`
   - `custom_prompt` mode requires `custom_prompt` text
   - `url_context` mode doesn't require either

### Test Results

Successfully tested with curl:
```bash
# Created conversation with url_context mode
# Created message in conversation
# Retrieved all conversations (with message count)
# Retrieved all messages for conversation
# Updated conversation title
# Toggled pin status
```

All tests passed successfully!

### Next Phase
Ready to move to **Phase 3: System Prompts, File Attachments & URL Context**

---

_Phase 2 implementation completed successfully on 2025-10-24!_
