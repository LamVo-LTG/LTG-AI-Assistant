const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize new Google Gen AI client (unified client for all services)
// Use GOOGLE_API_KEY (new SDK standard) or fall back to GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY });

class GeminiService {
  /**
   * Upload file to Gemini File API using new @google/genai SDK
   * @param {string} filePath - Path to the file on disk
   * @param {string} mimeType - MIME type of the file
   * @param {string} displayName - Display name for the file
   * @returns {Promise<Object>} - File URI and metadata
   */
  async uploadFile(filePath, mimeType, displayName) {
    try {
      console.log(`Uploading file to Gemini: ${displayName} (${mimeType})`);

      // Upload file using new SDK's ai.files.upload()
      const uploadedFile = await ai.files.upload({
        file: filePath,
        config: {
          mimeType: mimeType,
          displayName: displayName
        }
      });

      console.log(`File uploaded successfully: ${uploadedFile.uri}`);
      console.log(`File state: ${uploadedFile.state}`);

      return {
        uri: uploadedFile.uri,
        name: uploadedFile.name,
        displayName: uploadedFile.displayName,
        mimeType: uploadedFile.mimeType,
        sizeBytes: uploadedFile.sizeBytes,
        createTime: uploadedFile.createTime,
        expirationTime: uploadedFile.expirationTime,
        state: uploadedFile.state
      };
    } catch (error) {
      console.error('Error uploading file to Gemini:', error);
      throw new Error(`Failed to upload file to Gemini API: ${error.message}`);
    }
  }

  /**
   * Get file from Gemini File API using new @google/genai SDK
   * @param {string} fileName - Gemini file name (not URI)
   * @returns {Promise<Object>} - File metadata
   */
  async getFile(fileName) {
    try {
      const file = await ai.files.get(fileName);
      return file;
    } catch (error) {
      console.error('Error getting file from Gemini:', error);
      throw new Error(`Failed to get file from Gemini API: ${error.message}`);
    }
  }

  /**
   * Delete file from Gemini File API using new @google/genai SDK
   * @param {string} fileName - Gemini file name (not URI)
   * @returns {Promise<void>}
   */
  async deleteFile(fileName) {
    try {
      await ai.files.delete(fileName);
      console.log(`File deleted successfully: ${fileName}`);
    } catch (error) {
      console.error('Error deleting file from Gemini:', error);
      // Don't throw error - file might already be expired
    }
  }

  /**
   * List all files in Gemini File API using new @google/genai SDK
   * @returns {Promise<Array>} - List of files
   */
  async listFiles() {
    try {
      const files = await ai.files.list();
      return files || [];
    } catch (error) {
      console.error('Error listing files from Gemini:', error);
      throw new Error(`Failed to list files from Gemini API: ${error.message}`);
    }
  }
}

module.exports = new GeminiService();
