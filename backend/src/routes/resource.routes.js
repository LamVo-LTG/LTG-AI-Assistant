const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resource.controller');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes require authentication
router.use(authenticate);

// File upload (uses multer middleware)
router.post('/upload', upload.single('file'), resourceController.uploadFile);

// URL resource
router.post('/url', resourceController.addURL);

// Get resources
router.get('/', resourceController.getResources);
router.get('/stats', resourceController.getStats);
router.get('/conversation/:conversation_id', resourceController.getConversationResources);

// Download/view file
router.get('/download/:id', resourceController.downloadFile);

// Attach/detach resources
router.post('/attach', resourceController.addToConversation);
router.delete('/detach/:conversation_id/:resource_id', resourceController.removeFromConversation);

// Delete resource
router.delete('/:id', resourceController.deleteResource);

module.exports = router;
