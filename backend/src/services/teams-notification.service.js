const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { notificationLogger } = require('../utils/logger');

// Ensure data directory exists for failed notifications queue
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const FAILED_QUEUE_PATH = path.join(dataDir, 'failed-notifications.json');
const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 2;

class TeamsNotificationService {
  constructor() {
    this.webhookUrl = process.env.MS_TEAMS_WEBHOOK_URL;
  }

  /**
   * Build admin panel URL
   */
  _getAdminPanelUrl() {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500';
    return `${frontendUrl}/pages/admin-panel.html`;
  }

  /**
   * Send HTTP POST request to webhook
   * @param {Object} payload - Data to send
   * @returns {Promise<boolean>} - Success status
   */
  async _sendWebhook(payload) {
    if (!this.webhookUrl) {
      notificationLogger.error('MS_TEAMS_WEBHOOK_URL not configured');
      return false;
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        notificationLogger.info('Webhook sent successfully', {
          type: payload._meta?.type,
          userId: payload._meta?.userId
        });
        return true;
      } else {
        const errorText = await response.text();
        notificationLogger.error('Webhook request failed', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          type: payload._meta?.type
        });
        return false;
      }
    } catch (error) {
      notificationLogger.error('Webhook request error', {
        error: error.message,
        type: payload._meta?.type
      });
      return false;
    }
  }

  /**
   * Add failed notification to queue file
   * @param {Object} payload - Original notification payload
   */
  _addToFailedQueue(payload) {
    try {
      let queue = [];

      if (fs.existsSync(FAILED_QUEUE_PATH)) {
        const content = fs.readFileSync(FAILED_QUEUE_PATH, 'utf-8');
        queue = JSON.parse(content);
      }

      queue.push({
        payload,
        failedAt: new Date().toISOString(),
        retryCount: MAX_RETRIES + 1 // Already exhausted retries
      });

      fs.writeFileSync(FAILED_QUEUE_PATH, JSON.stringify(queue, null, 2));
      notificationLogger.warn('Notification added to failed queue', {
        type: payload._meta?.type,
        userId: payload._meta?.userId,
        queueSize: queue.length
      });
    } catch (error) {
      notificationLogger.error('Failed to add to queue', {
        error: error.message,
        meta: payload._meta
      });
    }
  }

  /**
   * Send notification with retry logic
   * @param {Object} payload - Notification payload
   * @param {number} retryCount - Current retry attempt (0-based)
   */
  async _sendWithRetry(payload, retryCount = 0) {
    const success = await this._sendWebhook(payload);

    if (success) {
      return true;
    }

    if (retryCount < MAX_RETRIES) {
      notificationLogger.info(`Scheduling retry ${retryCount + 1}/${MAX_RETRIES} in 5 minutes`, {
        type: payload._meta?.type,
        userId: payload._meta?.userId
      });

      // Schedule retry after 5 minutes
      setTimeout(() => {
        this._sendWithRetry(payload, retryCount + 1);
      }, RETRY_DELAY_MS);

      return false;
    }

    // All retries exhausted - add to queue for later manual processing
    notificationLogger.error('All retries exhausted, adding to failed queue', {
      type: payload._meta?.type,
      userId: payload._meta?.userId
    });
    this._addToFailedQueue(payload);
    return false;
  }

  /**
   * Format timestamp for display in GMT+7 (Vietnam timezone)
   */
  _formatTimestamp(date) {
    // Format in Vietnam timezone (GMT+7)
    return date.toLocaleString('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(',', '');
  }

  /**
   * Build Adaptive Card payload for MS Teams
   * @param {Object} user - User object
   * @returns {Object} - Adaptive Card payload
   */
  _buildAdaptiveCardPayload(user) {
    const adminPanelUrl = this._getAdminPanelUrl();
    const timestamp = this._formatTimestamp(new Date());

    return {
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
              {
                type: 'TextBlock',
                size: 'Large',
                weight: 'Bolder',
                text: '🆕 New User Registration',
                wrap: true
              },
              {
                type: 'FactSet',
                facts: [
                  {
                    title: 'Username:',
                    value: user.username
                  },
                  {
                    title: 'Full Name:',
                    value: user.full_name || 'Not provided'
                  },
                  {
                    title: 'Email:',
                    value: user.email
                  },
                  {
                    title: 'Timestamp:',
                    value: timestamp
                  }
                ]
              }
            ],
            actions: [
              {
                type: 'Action.OpenUrl',
                title: '✅ Approve User',
                url: `${adminPanelUrl}?action=approve&email=${encodeURIComponent(user.email)}`
              },
              {
                type: 'Action.OpenUrl',
                title: '👁️ View in Admin Panel',
                url: adminPanelUrl
              }
            ]
          }
        }
      ]
    };
  }

  /**
   * Send user signup notification to MS Teams
   * This is fire-and-forget - does not block the caller
   * @param {Object} user - User object from registration
   */
  sendSignupNotification(user) {
    const payload = this._buildAdaptiveCardPayload(user);

    // Store user info for logging purposes
    payload._meta = {
      type: 'user_signup',
      userId: user.id,
      email: user.email
    };

    // Fire and forget - don't await
    this._sendWithRetry(payload).catch(error => {
      notificationLogger.error('Unexpected error in sendWithRetry', {
        error: error.message,
        userId: user.id
      });
    });
  }

  /**
   * Get count of failed notifications in queue
   * @returns {number} - Number of queued notifications
   */
  getFailedQueueCount() {
    try {
      if (!fs.existsSync(FAILED_QUEUE_PATH)) {
        return 0;
      }
      const content = fs.readFileSync(FAILED_QUEUE_PATH, 'utf-8');
      const queue = JSON.parse(content);
      return queue.length;
    } catch (error) {
      return 0;
    }
  }
}

module.exports = new TeamsNotificationService();
