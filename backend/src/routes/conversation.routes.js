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
