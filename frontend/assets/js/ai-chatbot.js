// Application State Management
const app = {
    state: {
        currentChatId: null,
        currentMode: 'custom', // 'agent', 'custom', 'url'
        chats: [],
        systemPrompts: [],
        urlContexts: [],
        urls: [],
        attachedFiles: [],
        editingPromptId: null,
        editingUrlContextId: null,
        renamingChatId: null,
        selectedSystemPromptId: null,
        isProcessing: false
    },

    // Initialize Application
    async init() {
        // Check if user is logged in
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            window.location.href = '../login.html';
            return;
        }

        await this.loadFromStorage();
        this.renderChatHistory();
        this.renderSystemPrompts();
        this.autoResizeTextarea();
        this.setupPasteHandler();

        // Set initial mode
        this.changeChatMode('custom');

        // Check if user is admin and show admin panel link
        await this.checkAdminAccess();
    },

    // Check if user is admin and show admin panel link, also update welcome message
    async checkAdminAccess() {
        try {
            const response = await apiService.getProfile();
            if (response.user) {
                // Show admin panel link if user is admin
                if (response.user.role === 'admin') {
                    const adminLink = document.getElementById('adminPanelLink');
                    if (adminLink) {
                        adminLink.style.display = 'flex';
                    }
                }

                // Update welcome message with user's full name or username
                const welcomeMessage = document.getElementById('welcomeMessage');
                if (welcomeMessage) {
                    const displayName = response.user.full_name || response.user.username;
                    welcomeMessage.textContent = `Welcome, ${displayName}!`;
                }
            }
        } catch (error) {
            console.error('Error checking admin access:', error);
        }
    },

    // Load data from localStorage and API
    async loadFromStorage() {
        // Load system prompts from backend API
        try {
            const response = await apiService.getSystemPrompts();
            this.state.systemPrompts = response.prompts.map(p => ({
                id: p.system_prompt_id,
                name: p.name,
                content: p.prompt_text,
                isOwner: p.is_owner,
                isPublic: p.is_public,
                isSystem: p.is_system
            }));
        } catch (error) {
            console.error('Error loading system prompts from backend:', error);
            // Fallback to default prompts if API fails
            this.state.systemPrompts = this.getDefaultPrompts();
        }

        // Load URL contexts from localStorage (still local for now)
        const stored = localStorage.getItem('aiChatbotData');
        if (stored) {
            const data = JSON.parse(stored);
            this.state.urlContexts = data.urlContexts || [];
        } else {
            this.state.urlContexts = [];
        }

        // Load conversations from API
        try {
            const response = await apiService.getConversations();
            const modeMap = {
                'ai_agent': 'agent',
                'custom_prompt': 'custom',
                'url_context': 'url'
            };

            this.state.chats = response.conversations.map(conv => ({
                id: conv.conversation_id,
                title: conv.title,
                mode: modeMap[conv.chat_mode] || 'url',
                messages: [], // Will be loaded when chat is opened
                createdAt: new Date(conv.created_at).getTime(),
                updatedAt: new Date(conv.updated_at).getTime(),
                pinned: conv.is_pinned,
                urls: [],
                systemPromptId: conv.system_prompt_id,
                agentType: null
            }));
        } catch (error) {
            console.error('Error loading conversations:', error);
            // Fall back to empty chats if API fails
            this.state.chats = [];
        }
    },

    // Save data to localStorage
    saveToStorage() {
        localStorage.setItem('aiChatbotData', JSON.stringify({
            chats: this.state.chats,
            systemPrompts: this.state.systemPrompts,
            urlContexts: this.state.urlContexts
        }));
    },

    // Get default system prompts
    getDefaultPrompts() {
        return [
            {
                id: this.generateId(),
                name: 'Default Assistant',
                content: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses.',
                isOwner: true,
                isPublic: false,
                isSystem: false
            },
            {
                id: this.generateId(),
                name: 'Code Expert',
                content: 'You are an expert programmer. Help with coding questions, debug issues, and explain code clearly with examples.',
                isOwner: true,
                isPublic: false,
                isSystem: false
            },
            {
                id: this.generateId(),
                name: 'Creative Writer',
                content: 'You are a creative writing assistant. Help with storytelling, writing improvement, and creative expression.',
                isOwner: true,
                isPublic: false,
                isSystem: false
            }
        ];
    },

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Create new chat
    async createNewChat() {
        try {
            // Map mode names to API format
            const modeMap = {
                'agent': 'ai_agent',
                'custom': 'custom_prompt',
                'url': 'url_context'
            };

            // For ai_agent mode, we need a system_prompt_id, so fall back to url_context if none selected
            // In a future update, we'll prompt user to select a system prompt
            let apiMode = modeMap[this.state.currentMode] || 'url_context';
            let systemPromptId = null;

            if (apiMode === 'ai_agent') {
                apiMode = 'url_context'; // Temporarily use url_context until system prompts are implemented
            } else if (apiMode === 'custom_prompt') {
                // Use selected system prompt ID (can be null, backend will use default prompt)
                systemPromptId = this.state.selectedSystemPromptId || null;

                if (systemPromptId) {
                    console.log('🎯 Creating Custom AI conversation with system_prompt_id:', systemPromptId);
                } else {
                    console.log('📝 Creating Custom AI conversation with default system prompt (NULL system_prompt_id)');
                }
            }

            // Create conversation via API
            console.log('📤 Creating conversation:', { mode: apiMode, system_prompt_id: systemPromptId });
            const response = await apiService.createConversation('New Chat', apiMode, systemPromptId);

            const chat = {
                id: response.conversation.conversation_id,
                title: response.conversation.title,
                mode: this.state.currentMode,
                messages: [],
                createdAt: new Date(response.conversation.created_at).getTime(),
                updatedAt: new Date(response.conversation.updated_at).getTime(),
                pinned: response.conversation.is_pinned,
                urls: [],
                systemPromptId: response.conversation.system_prompt_id,
                agentType: null
            };

            this.state.chats.unshift(chat);
            this.state.currentChatId = chat.id;
            this.saveToStorage();
            this.renderChatHistory();
            this.renderChatArea();
        } catch (error) {
            console.error('Error creating chat:', error);
            alert('Failed to create conversation. Please try again.');
        }
    },

    // Change chat mode
    changeChatMode(mode) {
        this.state.currentMode = mode;

        // Update header title
        const titles = {
            agent: 'AI Agent Mode',
            custom: 'Custom AI Mode',
            url: 'URL Context Mode'
        };
        document.getElementById('headerTitle').textContent = titles[mode];

        // Show/hide context sections
        document.getElementById('urlContextSection').style.display = mode === 'url' ? 'block' : 'none';
        document.getElementById('customAiSection').style.display = mode === 'custom' ? 'block' : 'none';
        document.getElementById('agentSection').style.display = mode === 'agent' ? 'block' : 'none';

        // Update current chat mode if exists
        if (this.state.currentChatId) {
            const chat = this.getCurrentChat();
            if (chat) {
                chat.mode = mode;
                this.saveToStorage();
            }
        }

        // Populate system prompt dropdown
        if (mode === 'custom') {
            this.populateSystemPromptDropdown();
        }

        // Populate URL context dropdown
        if (mode === 'url') {
            this.populateUrlContextDropdown();
        }
    },

    // Get current chat
    getCurrentChat() {
        return this.state.chats.find(c => c.id === this.state.currentChatId);
    },

    // Select chat
    async selectChat(chatId) {
        this.state.currentChatId = chatId;
        const chat = this.getCurrentChat();
        if (chat) {
            // Update mode
            document.getElementById('modeSelect').value = chat.mode;
            this.changeChatMode(chat.mode);

            // Update system prompt selection if in custom AI mode
            if (chat.mode === 'custom' && chat.systemPromptId) {
                const systemPromptSelect = document.getElementById('systemPromptSelect');
                if (systemPromptSelect) {
                    systemPromptSelect.value = chat.systemPromptId;
                }
            }

            // Restore URLs
            this.state.urls = chat.urls || [];
            this.renderUrls();

            // Load messages from API if not already loaded
            if (chat.messages.length === 0) {
                try {
                    const response = await apiService.getMessages(chatId);
                    chat.messages = response.messages.map(msg => ({
                        role: msg.role,
                        content: msg.content,
                        metadata: msg.metadata || {},  // Include metadata with attachments
                        timestamp: new Date(msg.created_at).getTime()
                    }));
                    this.saveToStorage();
                } catch (error) {
                    console.error('Error loading messages:', error);
                }
            }

            // Render chat
            this.renderChatArea();
            this.renderChatHistory();

            // Close sidebar on mobile after selecting chat
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('sidebarOverlay');
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            }
        }
    },

    // Render chat history
    renderChatHistory() {
        const container = document.getElementById('chatHistoryList');
        const pinnedChats = this.state.chats.filter(c => c.pinned);
        const unpinnedChats = this.state.chats.filter(c => !c.pinned);

        const chats = [...pinnedChats, ...unpinnedChats];

        if (chats.length === 0) {
            container.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-secondary); font-size: 13px;">No conversations yet</div>';
            return;
        }

        container.innerHTML = chats.map(chat => `
            <div class="chat-item ${chat.id === this.state.currentChatId ? 'active' : ''} ${chat.pinned ? 'pinned' : ''}"
                 onclick="app.selectChat('${chat.id}')">
                <div class="chat-item-content">
                    <div class="chat-item-title">${this.escapeHtml(chat.title)}</div>
                    <div class="chat-item-meta">${this.formatDate(chat.updatedAt)} · ${chat.messages.length} msgs</div>
                </div>
                <div class="chat-item-actions">
                    <button class="action-btn" onclick="event.stopPropagation(); app.togglePin('${chat.id}')" title="Pin">
                        ${chat.pinned ? '📌' : '📍'}
                    </button>
                    <button class="action-btn" onclick="event.stopPropagation(); app.openRenameModal('${chat.id}')" title="Rename">
                        ✏️
                    </button>
                    <button class="action-btn" onclick="event.stopPropagation(); app.deleteChat('${chat.id}')" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    },

    // Render chat area
    renderChatArea() {
        const container = document.getElementById('chatArea');
        const chat = this.getCurrentChat();

        if (!chat || chat.messages.length === 0) {
            // Get user's display name from stored user data
            const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
            let welcomeText = 'Start a conversation';
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                const displayName = userData.full_name || userData.username;
                welcomeText = `Welcome, ${displayName}!`;
            }

            container.innerHTML = `
                <div class="empty-state">
                    <h2 id="welcomeMessage">${this.escapeHtml(welcomeText)}</h2>
                    <p>Type a message below to begin</p>
                </div>
            `;
            return;
        }

        container.innerHTML = chat.messages.map(msg => `
            <div class="message ${msg.role}">
                <div class="message-avatar">
                    ${msg.role === 'user' ? 'U' : 'AI'}
                </div>
                <div class="message-content">
                    ${this.formatMessage(msg.content)}
                    ${this.renderAttachments(msg.metadata)}
                </div>
            </div>
        `).join('');

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    },

    // Send message
    async sendMessage() {
        const input = document.getElementById('messageInput');
        const sendBtn = document.querySelector('.send-btn');
        const message = input.value.trim();

        if (!message && this.state.attachedFiles.length === 0) return;

        // Prevent multiple submissions
        if (this.state.isProcessing) return;

        // Set processing state
        this.state.isProcessing = true;
        this.updateSendButton(true);

        // Create chat if doesn't exist
        if (!this.state.currentChatId) {
            await this.createNewChat();
        }

        const chat = this.getCurrentChat();
        if (!chat) return;

        // Upload files to backend and attach to conversation
        const uploadedResources = [];
        if (this.state.attachedFiles.length > 0) {
            try {
                for (const fileData of this.state.attachedFiles) {
                    // Upload file to backend
                    const uploadResponse = await apiService.uploadFile(fileData.file);

                    // Attach resource to conversation
                    await apiService.attachResourceToConversation(chat.id, uploadResponse.resource.resource_id);

                    uploadedResources.push({
                        resource_id: uploadResponse.resource.resource_id,
                        name: uploadResponse.resource.name,
                        size: uploadResponse.resource.file_size,
                        type: uploadResponse.resource.mime_type,
                        file_path: uploadResponse.resource.file_path
                    });
                }
            } catch (error) {
                console.error('Error uploading files:', error);
                alert('Failed to upload files. Please try again.');
                return;
            }
        }

        // Prepare message content
        let messageContent = message;
        if (uploadedResources.length > 0) {
            const fileNames = uploadedResources.map(f => f.name).join(', ');
            messageContent += `\n\n[Attached ${uploadedResources.length} file(s): ${fileNames}]`;
        }

        try {
            // Add user message to local UI immediately for better UX
            chat.messages.push({
                role: 'user',
                content: messageContent,
                timestamp: Date.now(),
                metadata: {
                    attachments: uploadedResources.map(f => ({
                        resourceId: f.resource_id,
                        name: f.name,
                        fileSize: f.size,
                        mimeType: f.type,
                        filePath: f.file_path || ''
                    }))
                }
            });

            // Auto-generate title from first message
            if (chat.messages.length === 1) {
                const newTitle = message.substring(0, 50) + (message.length > 50 ? '...' : '');
                chat.title = newTitle;
                // Update title in backend
                await apiService.updateConversation(chat.id, { title: newTitle });
            }

            chat.updatedAt = Date.now();
            this.saveToStorage();
            this.renderChatArea();
            this.renderChatHistory();

            // Clear input and attachments immediately
            input.value = '';
            input.style.height = 'auto';
            this.clearAttachedFiles();

            // Show typing indicator
            this.showTypingIndicator();

            // Generate AI response using Gemini API (backend will save user message)
            setTimeout(async () => {
                try {
                    // Get resource IDs from uploaded resources
                    const resourceIds = uploadedResources.map(r => r.resource_id);

                    // Call the actual Gemini API (backend saves both user and assistant messages)
                    const chatResponse = await apiService.sendChatMessage(chat.id, message, 'gemini-2.5-flash', resourceIds);

                    // Extract the AI response from the API response
                    const aiMessage = chatResponse.assistant_message;
                    const response = aiMessage.content;

                    // Remove typing indicator
                    this.hideTypingIndicator();

                    // Add AI response to local state (already saved by backend)
                    chat.messages.push({
                        role: 'assistant',
                        content: response,
                        timestamp: new Date(aiMessage.created_at).getTime()
                    });

                    chat.updatedAt = Date.now();
                    this.saveToStorage();
                    this.renderChatArea();
                    this.renderChatHistory();

                    // Log usage stats if available
                    if (chatResponse.usage) {
                        console.log('API Usage:', chatResponse.usage);
                        console.log('Cost Estimate:', chatResponse.cost_estimate);
                    }

                    // Reset processing state
                    this.state.isProcessing = false;
                    this.updateSendButton(false);
                } catch (error) {
                    console.error('Error generating AI response:', error);

                    // Remove typing indicator
                    this.hideTypingIndicator();

                    // Show error message to user
                    const errorResponse = `Sorry, I encountered an error: ${error.message}. Please try again.`;
                    const errorMessage = await apiService.createMessage(chat.id, 'assistant', errorResponse);

                    chat.messages.push({
                        role: 'assistant',
                        content: errorResponse,
                        timestamp: new Date(errorMessage.data.created_at).getTime()
                    });

                    chat.updatedAt = Date.now();
                    this.saveToStorage();
                    this.renderChatArea();
                    this.renderChatHistory();

                    // Reset processing state
                    this.state.isProcessing = false;
                    this.updateSendButton(false);
                }
            }, 500);
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');

            // Reset processing state on error
            this.state.isProcessing = false;
            this.updateSendButton(false);
        }
    },


    // Search chats
    searchChats(query) {
        const container = document.getElementById('chatHistoryList');
        const searchTerm = query.toLowerCase();

        const filteredChats = this.state.chats.filter(chat =>
            chat.title.toLowerCase().includes(searchTerm) ||
            chat.messages.some(msg => msg.content.toLowerCase().includes(searchTerm))
        );

        if (filteredChats.length === 0) {
            container.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-secondary); font-size: 13px;">No matches found</div>';
            return;
        }

        container.innerHTML = filteredChats.map(chat => `
            <div class="chat-item ${chat.id === this.state.currentChatId ? 'active' : ''} ${chat.pinned ? 'pinned' : ''}"
                 onclick="app.selectChat('${chat.id}')">
                <div class="chat-item-content">
                    <div class="chat-item-title">${this.escapeHtml(chat.title)}</div>
                    <div class="chat-item-meta">${this.formatDate(chat.updatedAt)} · ${chat.messages.length} msgs</div>
                </div>
            </div>
        `).join('');
    },

    // Toggle pin
    async togglePin(chatId) {
        const chat = this.state.chats.find(c => c.id === chatId);
        if (chat) {
            try {
                // Call backend API to persist pin status
                await apiService.togglePinConversation(chatId);

                // Update local state
                chat.pinned = !chat.pinned;
                this.saveToStorage();
                this.renderChatHistory();
            } catch (error) {
                console.error('Error toggling pin:', error);
                alert('Failed to update pin status. Please try again.');
            }
        }
    },

    // Delete chat
    async deleteChat(chatId) {
        if (!confirm('Are you sure you want to delete this conversation?')) return;

        try {
            await apiService.deleteConversation(chatId);

            this.state.chats = this.state.chats.filter(c => c.id !== chatId);

            if (this.state.currentChatId === chatId) {
                this.state.currentChatId = null;
                this.renderChatArea();
            }

            this.saveToStorage();
            this.renderChatHistory();
        } catch (error) {
            console.error('Error deleting conversation:', error);
            alert('Failed to delete conversation. Please try again.');
        }
    },

    // Open rename modal
    openRenameModal(chatId) {
        const chat = this.state.chats.find(c => c.id === chatId);
        if (!chat) return;

        this.state.renamingChatId = chatId;
        document.getElementById('chatNameInput').value = chat.title;
        this.openModal('renameChatModal');
    },

    // Save rename
    async saveRename() {
        const chat = this.state.chats.find(c => c.id === this.state.renamingChatId);
        const newName = document.getElementById('chatNameInput').value.trim();

        if (chat && newName) {
            try {
                await apiService.updateConversation(chat.id, { title: newName });
                chat.title = newName;
                this.saveToStorage();
                this.renderChatHistory();
            } catch (error) {
                console.error('Error renaming conversation:', error);
                alert('Failed to rename conversation. Please try again.');
            }
        }

        this.closeModal('renameChatModal');
        this.state.renamingChatId = null;
    },

    // URL Management
    async addUrl() {
        const input = document.getElementById('urlInput');
        const url = input.value.trim();

        if (!url) return;

        // Simple URL validation
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            alert('Please enter a valid URL starting with http:// or https://');
            return;
        }

        // Check if chat exists, create if needed
        if (!this.state.currentChatId) {
            await this.createNewChat();
        }

        const chat = this.getCurrentChat();
        if (!chat) return;

        // Check URL limit (Gemini max: 20 URLs)
        const currentUrlCount = chat.urls ? chat.urls.length : 0;
        if (currentUrlCount >= 20) {
            alert('Maximum 20 URLs allowed per conversation (Gemini API limitation)');
            return;
        }

        try {
            // Create URL resource in backend
            const response = await apiService.addURL(url, url);

            // Attach resource to conversation
            await apiService.attachResourceToConversation(
                chat.id,
                response.resource.resource_id
            );

            // Add to local state
            if (!chat.urls) chat.urls = [];
            chat.urls.push(url);
            this.state.urls = chat.urls;
            this.saveToStorage();

            // Clear input and update UI
            input.value = '';
            this.renderUrls();

            console.log('✅ URL added and attached to conversation:', url);
        } catch (error) {
            console.error('Error adding URL:', error);
            alert('Failed to add URL. Please try again.');
        }
    },

    removeUrl(index) {
        const chat = this.getCurrentChat();
        if (chat && chat.urls) {
            chat.urls.splice(index, 1);
            this.state.urls = chat.urls;
            this.saveToStorage();
            this.renderUrls();
        }
    },

    renderUrls() {
        const container = document.getElementById('urlList');
        if (this.state.urls.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = this.state.urls.map((url, index) => `
            <div class="url-tag">
                <span>${this.truncateUrl(url)}</span>
                <span class="remove-btn" onclick="app.removeUrl(${index})">×</span>
            </div>
        `).join('');
    },


    // File Attachment Management
    handleFileAttachment(event) {
        const files = Array.from(event.target.files);

        files.forEach(file => {
            this.state.attachedFiles.push({
                name: file.name,
                size: file.size,
                type: file.type,
                file: file
            });
        });

        this.renderAttachedFiles();

        // Clear input
        event.target.value = '';
    },

    removeAttachedFile(index) {
        this.state.attachedFiles.splice(index, 1);
        this.renderAttachedFiles();
    },

    renderAttachedFiles() {
        const container = document.getElementById('attachedFilesList');

        if (this.state.attachedFiles.length === 0) {
            container.innerHTML = '';
            return;
        }

        // Clear container
        container.innerHTML = '';

        // Render each file with preview
        this.state.attachedFiles.forEach((fileData, index) => {
            const fileCard = document.createElement('div');
            fileCard.className = 'attached-file';

            // Create preview section
            const preview = document.createElement('div');
            preview.className = 'attached-file-preview';

            // Check if file is an image
            const isImage = fileData.type && fileData.type.startsWith('image/');

            if (isImage && fileData.file) {
                // Create image preview
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.alt = fileData.name;
                    preview.appendChild(img);
                };
                reader.readAsDataURL(fileData.file);
            } else {
                // Show file icon based on type
                preview.classList.add('file-icon');
                const icon = this.getFileIcon(fileData.type, fileData.name);
                preview.innerHTML = icon;
            }

            // Create file info section
            const info = document.createElement('div');
            info.className = 'attached-file-info';
            info.innerHTML = `
                <div class="attached-file-name" title="${this.escapeHtml(fileData.name)}">
                    ${this.escapeHtml(fileData.name)}
                </div>
                <div class="attached-file-size">${this.formatFileSize(fileData.size)}</div>
            `;

            // Create remove button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'attached-file-remove';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = () => this.removeAttachedFile(index);

            // Assemble card
            fileCard.appendChild(preview);
            fileCard.appendChild(info);
            fileCard.appendChild(removeBtn);

            container.appendChild(fileCard);
        });
    },

    getFileIcon(fileType, fileName) {
        // Determine file type from MIME type or extension
        if (fileType) {
            if (fileType.startsWith('image/')) return '🖼️';
            if (fileType.startsWith('video/')) return '🎥';
            if (fileType.startsWith('audio/')) return '🎵';
            if (fileType.includes('pdf')) return '📄';
            if (fileType.includes('word') || fileType.includes('document')) return '📝';
            if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
            if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📽️';
            if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('archive')) return '📦';
            if (fileType.includes('text')) return '📃';
        }

        // Check file extension
        const ext = fileName.split('.').pop().toLowerCase();
        const iconMap = {
            'pdf': '📄',
            'doc': '📝', 'docx': '📝',
            'xls': '📊', 'xlsx': '📊',
            'ppt': '📽️', 'pptx': '📽️',
            'zip': '📦', 'rar': '📦', '7z': '📦',
            'txt': '📃',
            'mp3': '🎵', 'wav': '🎵',
            'mp4': '🎥', 'avi': '🎥', 'mov': '🎥',
            'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️'
        };

        return iconMap[ext] || '📎';
    },

    clearAttachedFiles() {
        this.state.attachedFiles = [];
        this.renderAttachedFiles();
    },

    // Setup paste handler for input area
    setupPasteHandler() {
        const messageInput = document.getElementById('messageInput');

        messageInput.addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            // Check if there are any files in the clipboard
            for (let i = 0; i < items.length; i++) {
                const item = items[i];

                // Check if the item is a file
                if (item.kind === 'file') {
                    e.preventDefault(); // Prevent default paste behavior

                    const file = item.getAsFile();
                    if (file) {
                        // Add file to attached files
                        this.state.attachedFiles.push({
                            name: file.name || `pasted-${Date.now()}.${file.type.split('/')[1] || 'png'}`,
                            size: file.size,
                            type: file.type,
                            file: file
                        });

                        this.renderAttachedFiles();

                        // Show notification
                        console.log(`📎 File pasted: ${file.name || 'unnamed'} (${file.type})`);
                    }
                }
            }
        });
    },


    // System Prompts Management
    openSystemPromptsModal() {
        this.renderSystemPrompts();
        this.openModal('systemPromptsModal');
    },

    renderSystemPrompts() {
        const container = document.getElementById('promptList');

        if (this.state.systemPrompts.length === 0) {
            container.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-secondary);">No system prompts yet</div>';
            return;
        }

        container.innerHTML = this.state.systemPrompts.map(prompt => {
            // Check if this is a public system prompt (not owned by user)
            const isPublicSystem = prompt.isPublic && prompt.isSystem && !prompt.isOwner;
            const publicBadge = isPublicSystem ? '<span class="prompt-badge public">🌐 Public</span>' : '';

            // Only show edit/delete buttons for prompts owned by user
            const actionButtons = prompt.isOwner !== false ? `
                <button class="action-btn" onclick="app.editPrompt('${prompt.id}')" title="Edit">✏️</button>
                <button class="action-btn" onclick="app.deletePrompt('${prompt.id}')" title="Delete">🗑️</button>
            ` : '';

            return `
                <div class="prompt-item ${isPublicSystem ? 'public-prompt' : ''}">
                    <div class="prompt-item-info">
                        <div class="prompt-item-name">
                            ${this.escapeHtml(prompt.name)}
                            ${publicBadge}
                        </div>
                        <div class="prompt-item-preview">${this.escapeHtml(prompt.content.substring(0, 80))}...</div>
                    </div>
                    <div class="prompt-item-actions">
                        ${actionButtons}
                    </div>
                </div>
            `;
        }).join('');

        // Update dropdown
        this.populateSystemPromptDropdown();
    },

    populateSystemPromptDropdown() {
        const select = document.getElementById('systemPromptSelect');
        const currentValue = select.value;

        select.innerHTML = '<option value="">Select a system prompt...</option>' +
            this.state.systemPrompts.map(prompt =>
                `<option value="${prompt.id}">${this.escapeHtml(prompt.name)}</option>`
            ).join('');

        // Restore selection
        if (currentValue) {
            select.value = currentValue;
        }
    },

    openCreatePromptModal() {
        this.state.editingPromptId = null;
        document.getElementById('promptEditorTitle').textContent = 'Create System Prompt';
        document.getElementById('promptName').value = '';
        document.getElementById('promptContent').value = '';
        this.closeModal('systemPromptsModal');
        this.openModal('promptEditorModal');
    },

    editPrompt(promptId) {
        const prompt = this.state.systemPrompts.find(p => p.id === promptId);
        if (!prompt) return;

        // Prevent editing prompts user doesn't own
        if (prompt.isOwner === false) {
            alert('You cannot edit this public system prompt. You can only edit prompts you created.');
            return;
        }

        this.state.editingPromptId = promptId;
        document.getElementById('promptEditorTitle').textContent = 'Edit System Prompt';
        document.getElementById('promptName').value = prompt.name;
        document.getElementById('promptContent').value = prompt.content;
        this.closeModal('systemPromptsModal');
        this.openModal('promptEditorModal');
    },

    async savePrompt() {
        const name = document.getElementById('promptName').value.trim();
        const content = document.getElementById('promptContent').value.trim();

        if (!name || !content) {
            alert('Please fill in all fields');
            return;
        }

        try {
            if (this.state.editingPromptId) {
                // Edit existing - call backend API
                const response = await apiService.updateSystemPrompt(this.state.editingPromptId, {
                    name: name,
                    prompt_text: content
                });

                // Update local state
                const prompt = this.state.systemPrompts.find(p => p.id === this.state.editingPromptId);
                if (prompt) {
                    prompt.name = name;
                    prompt.content = content;
                }
            } else {
                // Create new - call backend API
                const response = await apiService.createSystemPrompt(name, content);

                // Add to local state with the ID from backend
                // New prompts created by user are always owned by the user
                this.state.systemPrompts.unshift({
                    id: response.prompt.system_prompt_id,
                    name: response.prompt.name,
                    content: response.prompt.prompt_text,
                    isOwner: true,
                    isPublic: false,
                    isSystem: false
                });
            }

            this.saveToStorage();
            this.closeModal('promptEditorModal');
            this.openModal('systemPromptsModal');
            this.renderSystemPrompts();
        } catch (error) {
            console.error('Error saving prompt:', error);
            alert('Failed to save prompt. Please try again.');
        }
    },

    async deletePrompt(promptId) {
        const prompt = this.state.systemPrompts.find(p => p.id === promptId);

        // Prevent deleting prompts user doesn't own
        if (prompt && prompt.isOwner === false) {
            alert('You cannot delete this public system prompt. Only the owner can delete it.');
            return;
        }

        if (!confirm('Are you sure you want to delete this prompt?')) return;

        try {
            // Call backend API to delete
            await apiService.deleteSystemPrompt(promptId);

            // Remove from local state
            this.state.systemPrompts = this.state.systemPrompts.filter(p => p.id !== promptId);
            this.saveToStorage();
            this.renderSystemPrompts();
        } catch (error) {
            console.error('Error deleting prompt:', error);
            alert('Failed to delete prompt. Please try again.');
        }
    },

    async selectSystemPrompt(promptId) {
        // Store selected prompt ID in state for new chat creation
        this.state.selectedSystemPromptId = promptId || null;

        // Update existing chat if one is selected
        const chat = this.getCurrentChat();
        if (chat) {
            try {
                // Update system_prompt_id in backend
                await apiService.updateConversation(chat.id, {
                    system_prompt_id: promptId || null
                });

                // Update local state
                chat.systemPromptId = promptId;
                this.saveToStorage();
            } catch (error) {
                console.error('Error updating system prompt:', error);
                alert('Failed to update system prompt. Please try again.');
            }
        }
    },

    selectAgent(agentType) {
        const chat = this.getCurrentChat();
        if (chat) {
            chat.agentType = agentType;
            this.saveToStorage();
        }
    },

    // URL Context Management
    openUrlContextsModal() {
        this.renderUrlContexts();
        this.openModal('urlContextsModal');
    },

    renderUrlContexts() {
        const container = document.getElementById('urlContextList');

        if (this.state.urlContexts.length === 0) {
            container.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-secondary);">No URL contexts yet</div>';
            return;
        }

        container.innerHTML = this.state.urlContexts.map(context => `
            <div class="prompt-item">
                <div class="prompt-item-info">
                    <div class="prompt-item-name">${this.escapeHtml(context.name)}</div>
                    <div class="prompt-item-preview">${context.urls.length} URL(s)</div>
                </div>
                <div class="prompt-item-actions">
                    <button class="action-btn" onclick="app.editUrlContext('${context.id}')">✏️</button>
                    <button class="action-btn" onclick="app.deleteUrlContext('${context.id}')">🗑️</button>
                </div>
            </div>
        `).join('');

        // Update dropdown
        this.populateUrlContextDropdown();
    },

    populateUrlContextDropdown() {
        const select = document.getElementById('urlContextSelect');
        const currentValue = select.value;

        select.innerHTML = '<option value="">Select a URL context...</option>' +
            this.state.urlContexts.map(context =>
                `<option value="${context.id}">${this.escapeHtml(context.name)}</option>`
            ).join('');

        // Restore selection
        if (currentValue) {
            select.value = currentValue;
        }
    },

    openCreateUrlContextModal() {
        this.state.editingUrlContextId = null;
        document.getElementById('urlContextEditorTitle').textContent = 'Create URL Context';
        document.getElementById('urlContextName').value = '';
        document.getElementById('urlContextUrls').value = '';
        this.closeModal('urlContextsModal');
        this.openModal('urlContextEditorModal');
    },

    saveCurrentUrlContext() {
        if (this.state.urls.length === 0) {
            alert('Please add at least one URL first');
            return;
        }

        const name = prompt('Enter a name for this URL context:');
        if (!name || !name.trim()) return;

        this.state.urlContexts.push({
            id: this.generateId(),
            name: name.trim(),
            urls: [...this.state.urls]
        });

        this.saveToStorage();
        this.populateUrlContextDropdown();
        alert('URL context saved successfully!');
    },

    async selectUrlContext(contextId) {
        if (!contextId) {
            return;
        }

        const context = this.state.urlContexts.find(c => c.id === contextId);
        if (!context) return;

        // Create chat if doesn't exist
        if (!this.state.currentChatId) {
            await this.createNewChat();
        }

        const chat = this.getCurrentChat();
        if (!chat) return;

        try {
            // Check URL limit
            if (context.urls.length > 20) {
                alert('This URL context has more than 20 URLs. Gemini only supports up to 20 URLs per request. Please edit the context to reduce URLs.');
                return;
            }

            // Clear existing URL resources from conversation first
            const existingResources = await apiService.getConversationResources(chat.id);
            if (existingResources && existingResources.resources) {
                for (const resource of existingResources.resources) {
                    // Only detach URL resources (not files)
                    if (resource.resource_type === 'url') {
                        await apiService.detachResourceFromConversation(chat.id, resource.resource_id);
                        console.log(`🗑️ Detached existing URL: ${resource.url}`);
                    }
                }
            }

            // Create URL resources and attach to conversation
            for (const url of context.urls) {
                // Create resource with context name in metadata
                const metadata = { context: context.name };
                const response = await apiService.addURL(url, url, metadata);

                // Attach to conversation
                await apiService.attachResourceToConversation(
                    chat.id,
                    response.resource.resource_id
                );
            }

            // Update local state
            chat.urls = [...context.urls];
            this.state.urls = chat.urls;
            this.saveToStorage();
            this.renderUrls();

            console.log(`✅ Loaded ${context.urls.length} URLs from context: ${context.name}`);
        } catch (error) {
            console.error('Error loading URL context:', error);
            alert('Failed to load URL context. Please try again.');
        }
    },

    editUrlContext(contextId) {
        const context = this.state.urlContexts.find(c => c.id === contextId);
        if (!context) return;

        this.state.editingUrlContextId = contextId;
        document.getElementById('urlContextEditorTitle').textContent = 'Edit URL Context';
        document.getElementById('urlContextName').value = context.name;
        document.getElementById('urlContextUrls').value = context.urls.join('\n');
        this.closeModal('urlContextsModal');
        this.openModal('urlContextEditorModal');
    },

    saveUrlContext() {
        const name = document.getElementById('urlContextName').value.trim();
        const urlsText = document.getElementById('urlContextUrls').value.trim();

        if (!name) {
            alert('Please enter a context name');
            return;
        }

        if (!urlsText) {
            alert('Please enter at least one URL');
            return;
        }

        // Parse URLs (one per line)
        const urls = urlsText.split('\n')
            .map(url => url.trim())
            .filter(url => url.length > 0)
            .filter(url => url.startsWith('http://') || url.startsWith('https://'));

        if (urls.length === 0) {
            alert('Please enter valid URLs (starting with http:// or https://)');
            return;
        }

        // Validate URL count (Gemini limit)
        if (urls.length > 20) {
            alert('Maximum 20 URLs allowed per context (Gemini API limitation). Please reduce the number of URLs.');
            return;
        }

        if (this.state.editingUrlContextId) {
            // Edit existing
            const context = this.state.urlContexts.find(c => c.id === this.state.editingUrlContextId);
            if (context) {
                context.name = name;
                context.urls = urls;
            }
        } else {
            // Create new
            this.state.urlContexts.push({
                id: this.generateId(),
                name,
                urls
            });
        }

        this.saveToStorage();
        this.closeModal('urlContextEditorModal');
        this.openModal('urlContextsModal');
        this.renderUrlContexts();
    },

    deleteUrlContext(contextId) {
        if (!confirm('Are you sure you want to delete this URL context?')) return;

        this.state.urlContexts = this.state.urlContexts.filter(c => c.id !== contextId);
        this.saveToStorage();
        this.renderUrlContexts();
    },

    // Modal Management
    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    },

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    toggleContextPanel() {
        const panel = document.getElementById('contextPanel');
        panel.classList.toggle('active');
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');

        // Check if we're on mobile (width <= 768px)
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            // Mobile: toggle 'active' class and show overlay
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        } else {
            // Desktop: toggle 'hidden' class
            sidebar.classList.toggle('hidden');
        }
    },

    // Logout functionality
    logout() {
        if (confirm('Are you sure you want to logout?')) {
            // Clear all auth data
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('isLoggedIn');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
            sessionStorage.removeItem('isLoggedIn');

            // Redirect to login page
            window.location.href = '../login.html';
        }
    },

    // Utility Functions
    handleKeyPress(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    },

    autoResizeTextarea() {
        const textarea = document.getElementById('messageInput');
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 200) + 'px';
        });
    },

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

        return date.toLocaleDateString();
    },

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    },

    truncateUrl(url) {
        if (url.length <= 40) return url;
        return url.substring(0, 37) + '...';
    },

    // Update send button state
    updateSendButton(isProcessing) {
        const sendBtn = document.querySelector('.send-btn');
        const messageInput = document.getElementById('messageInput');

        if (isProcessing) {
            sendBtn.disabled = true;
            sendBtn.classList.add('disabled');
            messageInput.disabled = true;
        } else {
            sendBtn.disabled = false;
            sendBtn.classList.remove('disabled');
            messageInput.disabled = false;
        }
    },

    // Show typing indicator
    showTypingIndicator() {
        const container = document.getElementById('chatArea');
        const typingIndicator = document.createElement('div');
        typingIndicator.id = 'typingIndicator';
        typingIndicator.className = 'message assistant';
        typingIndicator.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="message-content typing-indicator">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        container.appendChild(typingIndicator);
        container.scrollTop = container.scrollHeight;
    },

    // Hide typing indicator
    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    formatMessage(content) {
        // Use Marked.js to parse Markdown if available
        if (typeof marked !== 'undefined') {
            // Configure marked for better rendering
            marked.setOptions({
                breaks: true,  // Convert \n to <br>
                gfm: true,     // GitHub Flavored Markdown
                headerIds: false,
                mangle: false
            });
            return marked.parse(content);
        }
        // Fallback to simple HTML escape + line breaks
        return this.escapeHtml(content).replace(/\n/g, '<br>');
    },

    // Render file attachments from message metadata
    renderAttachments(metadata) {
        if (!metadata || !metadata.attachments || metadata.attachments.length === 0) {
            return '';
        }

        return `
            <div class="message-attachments">
                ${metadata.attachments.map(file => `
                    <div class="attachment-item" data-resource-id="${file.resourceId}">
                        <div class="attachment-icon">
                            ${this.getFileIcon(file.mimeType)}
                        </div>
                        <div class="attachment-info">
                            <div class="attachment-name">${this.escapeHtml(file.name)}</div>
                            <div class="attachment-size">${this.formatFileSize(file.fileSize)}</div>
                        </div>
                        <button class="attachment-download"
                                onclick="app.downloadFile('${file.resourceId}', '${this.escapeHtml(file.name)}')"
                                title="Download ${this.escapeHtml(file.name)}">
                            📥
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // Download file with authentication
    async downloadFile(resourceId, fileName) {
        try {
            const response = await fetch(apiService.getFileDownloadUrl(resourceId), {
                headers: apiService.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Failed to download file');
            }

            // Get the blob from response
            const blob = await response.blob();

            // Create a temporary URL for the blob
            const url = window.URL.createObjectURL(blob);

            // Create a temporary link and click it to download
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();

            // Cleanup
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download file. Please try again.');
        }
    },

    // Get file icon based on MIME type
    getFileIcon(mimeType) {
        if (!mimeType) return '📄';

        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.startsWith('video/')) return '🎥';
        if (mimeType.startsWith('audio/')) return '🎵';
        if (mimeType.includes('pdf')) return '📕';
        if (mimeType.includes('word') || mimeType.includes('document')) return '📘';
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
        if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📊';
        if (mimeType.includes('text')) return '📝';
        if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return '📦';

        return '📄';
    },

    // Format file size for display
    formatFileSize(bytes) {
        if (!bytes) return '0 B';

        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }
};

// Initialize app on load
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
