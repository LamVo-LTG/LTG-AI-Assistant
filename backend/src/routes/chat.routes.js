const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Chat routes
router.post('/send', chatController.sendMessage);  // Non-streaming
router.get('/usage/stats', chatController.getUsageStats);
router.get('/usage/history', chatController.getUsageHistory);

module.exports = router;
