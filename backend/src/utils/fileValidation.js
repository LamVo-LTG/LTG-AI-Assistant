const path = require('path');

class FileValidation {
  /**
   * Validate file type by extension and MIME type
   */
  static isValidFileType(filename, mimeType) {
    const validTypes = {
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png'
    };

    const ext = path.extname(filename).toLowerCase();
    return validTypes[ext] === mimeType;
  }

  /**
   * Validate file size (in bytes)
   */
  static isValidFileSize(size, maxSize = 2097152) { // 2MB default
    return size <= maxSize;
  }

  /**
   * Get MIME type from extension
   */
  static getMimeType(filename) {
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png'
    };

    const ext = path.extname(filename).toLowerCase();
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Validate URL format
   */
  static isValidURL(url) {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

module.exports = FileValidation;
