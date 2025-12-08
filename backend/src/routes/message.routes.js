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
