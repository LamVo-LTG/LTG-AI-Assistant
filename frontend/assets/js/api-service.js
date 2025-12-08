// API Service for Backend Communication
// Dynamic URL - works in both dev and prod
// Detect if running on separate dev server (port 5500) vs served from backend
const API_BASE_URL = (window.location.port === '5500' ? 'http://localhost:3000' : window.location.origin) + '/api';

class APIService {
    constructor() {
        this.token = this.getAuthToken();
    }

    // Get auth token from localStorage
    getAuthToken() {
        return localStorage.getItem('token') || sessionStorage.getItem('token');
    }

    // Get auth headers
    getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.getAuthToken()}`
        };
    }

    // Handle API response
    async handleResponse(response) {
        const data = await response.json();

        if (!response.ok) {
            // If unauthorized, redirect to login
            if (response.status === 401) {
                localStorage.removeItem('token');
                sessionStorage.removeItem('token');
                window.location.href = '/login.html';
                throw new Error('Unauthorized');
            }
            throw new Error(data.error || 'API request failed');
        }

        return data;
    }

    // Conversation API calls
    async createConversation(title, chatMode, systemPromptId = null) {
        const response = await fetch(`${API_BASE_URL}/conversations`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({
                title: title || 'New Conversation',
                chat_mode: chatMode,
                system_prompt_id: systemPromptId
            })
        });

        return this.handleResponse(response);
    }

    async getConversations(filters = {}) {
        const queryParams = new URLSearchParams(filters);
        const response = await fetch(`${API_BASE_URL}/conversations?${queryParams}`, {
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }

    async getConversationById(conversationId) {
        const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }

    async updateConversation(conversationId, updates) {
        const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
            method: 'PUT',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(updates)
        });

        return this.handleResponse(response);
    }

    async deleteConversation(conversationId) {
        const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
            method: 'DELETE',
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }

    async togglePinConversation(conversationId) {
        const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/pin`, {
            method: 'PATCH',
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }

    // Message API calls
    async createMessage(conversationId, role, content) {
        const response = await fetch(`${API_BASE_URL}/messages`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({
                conversation_id: conversationId,
                role: role,
                content: content
            })
        });

        return this.handleResponse(response);
    }

    async getMessages(conversationId) {
        const response = await fetch(`${API_BASE_URL}/messages/${conversationId}`, {
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }

    async deleteMessage(conversationId, messageId) {
        const response = await fetch(`${API_BASE_URL}/messages/${conversationId}/${messageId}`, {
            method: 'DELETE',
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }

    async deleteAllMessages(conversationId) {
        const response = await fetch(`${API_BASE_URL}/messages/${conversationId}`, {
            method: 'DELETE',
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }

    // System Prompt API calls
    async createSystemPrompt(name, promptText, description = null, category = null) {
        const response = await fetch(`${API_BASE_URL}/system-prompts`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({
                name: name,
                prompt_text: promptText,
                description: description,
                category: category
            })
        });

        return this.handleResponse(response);
    }

    async getSystemPrompts(filters = {}) {
        const queryParams = new URLSearchParams(filters);
        const response = await fetch(`${API_BASE_URL}/system-prompts?${queryParams}`, {
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }

    async getSystemPromptById(promptId) {
        const response = await fetch(`${API_BASE_URL}/system-prompts/${promptId}`, {
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }

    async updateSystemPrompt(promptId, updates) {
        const response = await fetch(`${API_BASE_URL}/system-prompts/${promptId}`, {
            method: 'PUT',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(updates)
        });

        return this.handleResponse(response);
    }

    async deleteSystemPrompt(promptId) {
        const response = await fetch(`${API_BASE_URL}/system-prompts/${promptId}`, {
            method: 'DELETE',
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }

    async toggleFavoritePrompt(promptId) {
        const response = await fetch(`${API_BASE_URL}/system-prompts/${promptId}/favorite`, {
            method: 'PATCH',
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }

    // Resource API calls (File Upload & URL)
    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/resources/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.getAuthToken()}`
                // Note: Don't set Content-Type for FormData - browser will set it with boundary
            },
            body: formData
        });

        return this.handleResponse(response);
    }

    async addURL(url, name = null, metadata = null) {
        const response = await fetch(`${API_BASE_URL}/resources/url`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({
                url: url,
                name: name || url,
                metadata: metadata
            })
        });

        return this.handleResponse(response);
    }

    async getResources(filters = {}) {
        const queryParams = new URLSearchParams(filters);
        const response = await fetch(`${API_BASE_URL}/resources?${queryParams}`, {
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }

    async getConversationResources(conversationId) {
        const response = await fetch(`${API_BASE_URL}/resources/conversation/${conversationId}`, {
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }

    async attachResourceToConversation(conversationId, resourceId) {
        const response = await fetch(`${API_BASE_URL}/resources/attach`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({
                conversation_id: conversationId,
                resource_id: resourceId
            })
        });

        return this.handleResponse(response);
    }

    async detachResourceFromConversation(conversationId, resourceId) {
        const response = await fetch(`${API_BASE_URL}/resources/detach/${conversationId}/${resourceId}`, {
            method: 'DELETE',
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }

    async deleteResource(resourceId) {
        const response = await fetch(`${API_BASE_URL}/resources/${resourceId}`, {
            method: 'DELETE',
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }

    // Chat API calls (Gemini Integration)
    async sendChatMessage(conversationId, message, model = 'gemini-2.5-flash', resourceIds = []) {
        const response = await fetch(`${API_BASE_URL}/chat/send`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({
                conversation_id: conversationId,
                message: message,
                model: model,
                resource_ids: resourceIds  // Pass resource IDs for this specific message
            })
        });

        return this.handleResponse(response);
    }

    async getUsageStats(filters = {}) {
        const queryParams = new URLSearchParams(filters);
        const response = await fetch(`${API_BASE_URL}/chat/usage/stats?${queryParams}`, {
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }

    async getUsageHistory(filters = {}) {
        const queryParams = new URLSearchParams(filters);
        const response = await fetch(`${API_BASE_URL}/chat/usage/history?${queryParams}`, {
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }

    // Get file download URL (for message attachments)
    getFileDownloadUrl(resourceId) {
        return `${API_BASE_URL}/resources/download/${resourceId}`;
    }

    // Auth API calls
    async getProfile() {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }
}

// Create global API service instance
const apiService = new APIService();
