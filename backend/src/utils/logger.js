const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Simple file-based logger for notifications
 */
class Logger {
  constructor(filename = 'notifications.log') {
    this.logPath = path.join(logsDir, filename);
  }

  /**
   * Format timestamp for log entries
   */
  _getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Write a log entry to file
   * @param {string} level - Log level (INFO, ERROR, WARN)
   * @param {string} message - Log message
   * @param {Object} data - Optional data to include
   */
  _write(level, message, data = null) {
    const entry = {
      timestamp: this._getTimestamp(),
      level,
      message,
      ...(data && { data })
    };

    const logLine = JSON.stringify(entry) + '\n';

    try {
      fs.appendFileSync(this.logPath, logLine);
    } catch (error) {
      // Fallback to console if file write fails
      console.error('Failed to write to log file:', error.message);
      console.log(logLine);
    }
  }

  info(message, data = null) {
    this._write('INFO', message, data);
  }

  error(message, data = null) {
    this._write('ERROR', message, data);
  }

  warn(message, data = null) {
    this._write('WARN', message, data);
  }
}

// Export singleton instance for notifications
const notificationLogger = new Logger('notifications.log');

module.exports = {
  Logger,
  notificationLogger
};
