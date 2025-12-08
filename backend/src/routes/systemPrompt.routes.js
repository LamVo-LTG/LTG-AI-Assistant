const express = require('express');
const router = express.Router();
const systemPromptController = require('../controllers/systemPrompt.controller');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// System prompt routes
router.post('/', systemPromptController.createPrompt);
router.get('/', systemPromptController.getPrompts);
router.get('/categories', systemPromptController.getCategories);
router.get('/stats', systemPromptController.getStats);
router.get('/:id', systemPromptController.getPromptById);
router.put('/:id', systemPromptController.updatePrompt);
router.delete('/:id', systemPromptController.deletePrompt);
router.patch('/:id/favorite', systemPromptController.toggleFavorite);

module.exports = router;
