const resourceModel = require('../models/resource.model');
const conversationModel = require('../models/conversation.model');
const geminiService = require('../services/gemini.service');
const FileValidation = require('../utils/fileValidation');
const fs = require('fs');
const path = require('path');

class ResourceController {
  // Upload file and create resource
  async uploadFile(req, res) {
    try {
      // req.user contains: { id, email, role } from JWT
      const user_id = req.user.id || req.user.user_id;

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { originalname, filename, mimetype, size, path: filePath } = req.file;

      // Validate file
      if (!FileValidation.isValidFileType(originalname, mimetype)) {
        // Delete uploaded file
        fs.unlinkSync(filePath);
        return res.status(400).json({
          error: 'Invalid file type. Only PDF, TXT, CSV, JPG, PNG are allowed.'
        });
      }

      if (!FileValidation.isValidFileSize(size)) {
        // Delete uploaded file
        fs.unlinkSync(filePath);
        return res.status(400).json({
          error: 'File size exceeds 2MB limit'
        });
      }

      // Upload to Gemini File API
      const geminiFile = await geminiService.uploadFile(
        filePath,
        mimetype,
        originalname
      );

      // Create resource in database
      const resource = await resourceModel.create({
        user_id,
        resource_type: 'file',
        name: originalname,
        file_path: filePath,  // Local file path (satisfies constraint)
        url: geminiFile.uri,  // Gemini URI for retrieval (mock)
        file_size: size,
        mime_type: mimetype
      });

      // Keep the file for local access (don't delete)
      // In production with real Gemini API, you would delete the temp file
      // fs.unlinkSync(filePath);

      res.status(201).json({
        message: 'File uploaded successfully',
        resource,
        gemini_metadata: {
          uri: geminiFile.uri,
          expiration: geminiFile.expirationTime
        }
      });
    } catch (error) {
      console.error('=== Upload file error ===');
      console.error('Error:', error);
      console.error('Stack:', error.stack);
      console.error('Message:', error.message);

      // Clean up file if exists
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting temp file:', unlinkError);
        }
      }

      res.status(500).json({
        error: 'Failed to upload file',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Add URL resource
  async addURL(req, res) {
    try {
      const user_id = req.user.id || req.user.user_id;
      const { url, name, metadata } = req.body;

      // Validation
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      if (!FileValidation.isValidURL(url)) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      // Create resource with metadata
      const resource = await resourceModel.create({
        user_id,
        resource_type: 'url',
        name: name || url,
        url,
        file_size: null,
        mime_type: null,
        metadata: metadata || {}
      });

      res.status(201).json({
        message: 'URL added successfully',
        resource
      });
    } catch (error) {
      console.error('Add URL error:', error);
      res.status(500).json({ error: 'Failed to add URL' });
    }
  }

  // Get all resources for user
  async getResources(req, res) {
    try {
      const user_id = req.user.id || req.user.user_id;
      const { resource_type, limit, offset } = req.query;

      const filters = {
        resource_type,
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
      };

      const resources = await resourceModel.findByUserId(user_id, filters);

      res.json({
        resources,
        count: resources.length
      });
    } catch (error) {
      console.error('Get resources error:', error);
      res.status(500).json({ error: 'Failed to fetch resources' });
    }
  }

  // Get resources for conversation
  async getConversationResources(req, res) {
    try {
      const { conversation_id } = req.params;
      const user_id = req.user.id || req.user.user_id;

      // Verify user owns conversation
      const conversation = await conversationModel.findById(conversation_id, user_id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const resources = await resourceModel.findByConversationId(conversation_id);

      res.json({
        resources,
        count: resources.length
      });
    } catch (error) {
      console.error('Get conversation resources error:', error);
      res.status(500).json({ error: 'Failed to fetch conversation resources' });
    }
  }

  // Add resource to conversation
  async addToConversation(req, res) {
    try {
      const { conversation_id, resource_id } = req.body;
      const user_id = req.user.id || req.user.user_id;

      // Verify user owns conversation
      const conversation = await conversationModel.findById(conversation_id, user_id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Verify user owns resource
      const resource = await resourceModel.findById(resource_id, user_id);
      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      const result = await resourceModel.addToConversation(conversation_id, resource_id);

      res.json({
        message: 'Resource added to conversation',
        data: result
      });
    } catch (error) {
      console.error('Add to conversation error:', error);
      res.status(500).json({ error: 'Failed to add resource to conversation' });
    }
  }

  // Remove resource from conversation
  async removeFromConversation(req, res) {
    try {
      const { conversation_id, resource_id } = req.params;
      const user_id = req.user.id || req.user.user_id;

      // Verify user owns conversation
      const conversation = await conversationModel.findById(conversation_id, user_id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const result = await resourceModel.removeFromConversation(conversation_id, resource_id);

      if (!result) {
        return res.status(404).json({ error: 'Resource not attached to conversation' });
      }

      res.json({
        message: 'Resource removed from conversation'
      });
    } catch (error) {
      console.error('Remove from conversation error:', error);
      res.status(500).json({ error: 'Failed to remove resource from conversation' });
    }
  }

  // Delete resource
  async deleteResource(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.id || req.user.user_id;

      // Get resource details
      const resource = await resourceModel.findById(id, user_id);
      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      // If it's a file, try to delete from Gemini (ignore errors)
      if (resource.resource_type === 'file') {
        try {
          // Extract file name from URI
          const fileName = resource.url.split('/').pop();
          await geminiService.deleteFile(fileName);
        } catch (error) {
          console.error('Error deleting from Gemini:', error);
          // Continue anyway - file might be expired
        }
      }

      // Delete from database
      await resourceModel.delete(id, user_id);

      res.json({
        message: 'Resource deleted successfully'
      });
    } catch (error) {
      console.error('Delete resource error:', error);
      res.status(500).json({ error: 'Failed to delete resource' });
    }
  }

  // Get resource statistics
  async getStats(req, res) {
    try {
      const user_id = req.user.id || req.user.user_id;
      const stats = await resourceModel.getStatsByUserId(user_id);

      res.json({ stats });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  }

  // Download/view file
  async downloadFile(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.id || req.user.user_id;

      // Get resource from database
      const resource = await resourceModel.findById(id, user_id);
      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      // Only allow downloading files (not URLs)
      if (resource.resource_type !== 'file') {
        return res.status(400).json({ error: 'Resource is not a file' });
      }

      // Check if file exists
      const filePath = path.resolve(resource.file_path);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found on disk' });
      }

      // Send file
      res.setHeader('Content-Type', resource.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${resource.name}"`);
      res.sendFile(filePath);
    } catch (error) {
      console.error('Download file error:', error);
      res.status(500).json({ error: 'Failed to download file' });
    }
  }
}

module.exports = new ResourceController();
