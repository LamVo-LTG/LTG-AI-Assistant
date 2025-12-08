const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const conversationRoutes = require('./routes/conversation.routes');
const messageRoutes = require('./routes/message.routes');
const systemPromptRoutes = require('./routes/systemPrompt.routes');
const resourceRoutes = require('./routes/resource.routes');
const chatRoutes = require('./routes/chat.routes');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5500',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files (works in both dev & prod)
app.use(express.static(path.join(__dirname, '../../frontend')));

// Serve uploads folder
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/system-prompts', systemPromptRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/chat', chatRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Root redirect to login
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Handle multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File size exceeds 2MB limit' });
  }

  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({ error: err.message });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler - serve frontend for non-API routes
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'Route not found' });
  } else {
    // Serve login page for unknown routes
    res.sendFile(path.join(__dirname, '../../frontend/login.html'));
  }
});

module.exports = app;
