// API Configuration
// Dynamic URL - works in both dev and prod
// Detect if running on separate dev server (port 5500) vs served from backend
const API_URL = (window.location.port === '5500' ? 'http://localhost:3000' : window.location.origin) + '/api';

const admin = {
    users: [],
    filteredUsers: [],
    pendingUsers: [],
    selectedUsers: new Set(),
    editingUserId: null,
    currentTab: 'users',

    async init() {
        // Check authentication and admin role
        if (!this.checkAuth()) {
            return;
        }

        // Load users and pending users from backend
        await Promise.all([
            this.loadUsers(),
            this.loadPendingUsers()
        ]);
        this.renderUsers();
        this.renderPendingUsers();
        this.updateStats();
        this.updatePendingBadge();

        // Handle URL parameters (e.g., from MS Teams notification)
        this.handleUrlParameters();
    },

    /**
     * Handle URL parameters for actions like approve from MS Teams
     */
    handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        const email = urlParams.get('email');

        if (action === 'approve' && email) {
            // Switch to pending tab
            this.switchTab('pending');

            // Find the pending user by email
            const pendingUser = this.pendingUsers.find(u => u.email === email);

            if (pendingUser) {
                // Highlight the user row
                setTimeout(() => {
                    const row = document.getElementById(`pending-row-${pendingUser.id}`);
                    if (row) {
                        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        row.classList.add('highlight-row');
                        // Remove highlight after animation
                        setTimeout(() => row.classList.remove('highlight-row'), 3000);
                    }
                }, 100);

                // Ask for confirmation to approve
                setTimeout(() => {
                    if (confirm(`Approve user "${pendingUser.username}" (${email})?`)) {
                        this.approveUser(pendingUser.id);
                    }
                }, 500);
            } else {
                // User might already be approved or doesn't exist
                alert(`No pending user found with email: ${email}\n\nThe user may have already been approved or rejected.`);
            }

            // Clean up URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    },

    checkAuth() {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');

        if (!token || !userStr) {
            // Save current URL with params for redirect after login
            const currentUrl = window.location.pathname + window.location.search;
            sessionStorage.setItem('redirectAfterLogin', currentUrl);
            alert('Please login first');
            window.location.href = '/login.html';
            return false;
        }

        const user = JSON.parse(userStr);
        if (user.role !== 'admin') {
            alert('Access denied. Admin privileges required.');
            window.location.href = '/pages/ai-chatbot.html';
            return false;
        }

        // Display admin name
        const adminNameEl = document.getElementById('adminName');
        if (adminNameEl) {
            adminNameEl.textContent = user.username;
        }

        return true;
    },

    getAuthHeaders() {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    },

    async loadUsers() {
        try {
            const response = await fetch(`${API_URL}/users`, {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (response.ok) {
                this.users = data.users;
                this.filteredUsers = [...this.users];
            } else {
                if (response.status === 401) {
                    alert('Session expired. Please login again.');
                    window.location.href = '/login.html';
                } else {
                    console.error('Failed to load users:', data.error);
                    alert(data.error || 'Failed to load users');
                }
            }
        } catch (error) {
            console.error('Error loading users:', error);
            alert('Connection error. Please check if the server is running.');
        }
    },

    async loadPendingUsers() {
        try {
            const response = await fetch(`${API_URL}/users/pending`, {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (response.ok) {
                this.pendingUsers = data.users;
            } else {
                console.error('Failed to load pending users:', data.error);
            }
        } catch (error) {
            console.error('Error loading pending users:', error);
        }
    },

    renderUsers() {
        const container = document.getElementById('usersTableContainer');

        if (this.filteredUsers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <div class="empty-state-title">No users found</div>
                    <div class="empty-state-text">Create your first user to get started</div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="users-table">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.filteredUsers.map(user => `
                        <tr>
                            <td>
                                <div class="user-info">
                                    <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
                                    <div class="user-details">
                                        <div class="user-name">${this.escapeHtml(user.username)}</div>
                                        <div class="user-email">${this.escapeHtml(user.email)}</div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span class="role-badge">${user.role}</span>
                            </td>
                            <td>
                                <span class="status-badge ${user.is_active ? 'status-active' : 'status-inactive'}">${user.is_active ? 'active' : 'inactive'}</span>
                            </td>
                            <td>${this.formatDate(user.created_at)}</td>
                            <td>
                                <div class="action-buttons">
                                    <button class="action-btn edit" onclick="admin.editUser('${user.id}')">Edit</button>
                                    <button class="action-btn delete" onclick="admin.deleteUser('${user.id}')">Delete</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    updateStats() {
        const totalUsers = this.users.length;
        const activeUsers = this.users.filter(u => u.is_active === true).length;
        const adminUsers = this.users.filter(u => u.role === 'admin').length;
        const pendingCount = this.pendingUsers.length;

        const totalUsersEl = document.getElementById('totalUsers');
        const activeUsersEl = document.getElementById('activeUsers');
        const adminUsersEl = document.getElementById('adminUsers');
        const pendingUsersEl = document.getElementById('pendingUsers');

        if (totalUsersEl) totalUsersEl.textContent = totalUsers;
        if (activeUsersEl) activeUsersEl.textContent = activeUsers;
        if (adminUsersEl) adminUsersEl.textContent = adminUsers;
        if (pendingUsersEl) pendingUsersEl.textContent = pendingCount;
    },

    updatePendingBadge() {
        const badge = document.getElementById('pendingBadge');
        if (badge) {
            const count = this.pendingUsers.length;
            badge.textContent = count;
            badge.classList.toggle('hidden', count === 0);
        }
    },

    switchTab(tab) {
        this.currentTab = tab;

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        if (tab === 'users') {
            document.getElementById('usersTab').classList.add('active');
        } else if (tab === 'pending') {
            document.getElementById('pendingTab').classList.add('active');
        }
    },

    renderPendingUsers() {
        const container = document.getElementById('pendingTableContainer');
        if (!container) return;

        // Clear selection when re-rendering
        this.selectedUsers.clear();
        this.updateSelectionUI();

        if (this.pendingUsers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✅</div>
                    <div class="empty-state-title">No pending approvals</div>
                    <div class="empty-state-text">All user registrations have been processed</div>
                </div>
            `;
            // Hide bulk actions bar when no pending users
            const bulkActionsBar = document.getElementById('bulkActionsBar');
            if (bulkActionsBar) bulkActionsBar.style.display = 'none';
            return;
        }

        // Show bulk actions bar when there are pending users
        const bulkActionsBar = document.getElementById('bulkActionsBar');
        if (bulkActionsBar) bulkActionsBar.style.display = 'flex';

        container.innerHTML = `
            <table class="users-table">
                <thead>
                    <tr>
                        <th style="width: 50px;"></th>
                        <th>User</th>
                        <th>Status</th>
                        <th>Registered</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.pendingUsers.map(user => `
                        <tr id="pending-row-${user.id}" class="${this.selectedUsers.has(user.id) ? 'selected' : ''}">
                            <td>
                                <div class="row-checkbox">
                                    <label class="checkbox-wrapper">
                                        <input type="checkbox"
                                               id="checkbox-${user.id}"
                                               ${this.selectedUsers.has(user.id) ? 'checked' : ''}
                                               onchange="admin.toggleUserSelection('${user.id}')">
                                        <span class="checkmark"></span>
                                    </label>
                                </div>
                            </td>
                            <td>
                                <div class="user-info">
                                    <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
                                    <div class="user-details">
                                        <div class="user-name">${this.escapeHtml(user.username)}</div>
                                        <div class="user-email">${this.escapeHtml(user.email)}</div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span class="status-badge status-pending">pending</span>
                            </td>
                            <td>${this.formatDate(user.created_at)}</td>
                            <td>
                                <div class="action-buttons">
                                    <button class="action-btn approve" onclick="admin.approveUser('${user.id}')">Approve</button>
                                    <button class="action-btn reject" onclick="admin.rejectUser('${user.id}')">Reject</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    toggleUserSelection(userId) {
        if (this.selectedUsers.has(userId)) {
            this.selectedUsers.delete(userId);
        } else {
            this.selectedUsers.add(userId);
        }

        // Update row highlight
        const row = document.getElementById(`pending-row-${userId}`);
        if (row) {
            row.classList.toggle('selected', this.selectedUsers.has(userId));
        }

        this.updateSelectionUI();
    },

    toggleSelectAll() {
        const selectAllCheckbox = document.getElementById('selectAllPending');
        const isChecked = selectAllCheckbox.checked;

        if (isChecked) {
            // Select all pending users
            this.pendingUsers.forEach(user => {
                this.selectedUsers.add(user.id);
                const checkbox = document.getElementById(`checkbox-${user.id}`);
                if (checkbox) checkbox.checked = true;
                const row = document.getElementById(`pending-row-${user.id}`);
                if (row) row.classList.add('selected');
            });
        } else {
            // Deselect all
            this.pendingUsers.forEach(user => {
                this.selectedUsers.delete(user.id);
                const checkbox = document.getElementById(`checkbox-${user.id}`);
                if (checkbox) checkbox.checked = false;
                const row = document.getElementById(`pending-row-${user.id}`);
                if (row) row.classList.remove('selected');
            });
        }

        this.updateSelectionUI();
    },

    updateSelectionUI() {
        const count = this.selectedUsers.size;
        const selectedCountEl = document.getElementById('selectedCount');
        const bulkApproveBtn = document.getElementById('bulkApproveBtn');
        const bulkRejectBtn = document.getElementById('bulkRejectBtn');
        const selectAllCheckbox = document.getElementById('selectAllPending');

        if (selectedCountEl) {
            selectedCountEl.textContent = `${count} selected`;
        }

        if (bulkApproveBtn) {
            bulkApproveBtn.disabled = count === 0;
        }

        if (bulkRejectBtn) {
            bulkRejectBtn.disabled = count === 0;
        }

        // Update select all checkbox state
        if (selectAllCheckbox && this.pendingUsers.length > 0) {
            selectAllCheckbox.checked = count === this.pendingUsers.length;
            selectAllCheckbox.indeterminate = count > 0 && count < this.pendingUsers.length;
        }
    },

    async bulkApprove() {
        const count = this.selectedUsers.size;
        if (count === 0) return;

        if (!confirm(`Are you sure you want to approve ${count} user(s)?`)) {
            return;
        }

        const userIds = Array.from(this.selectedUsers);
        let successCount = 0;
        let failCount = 0;

        // Process approvals
        for (const userId of userIds) {
            try {
                const response = await fetch(`${API_URL}/users/${userId}/approve`, {
                    method: 'POST',
                    headers: this.getAuthHeaders()
                });

                if (response.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error('Error approving user:', userId, error);
                failCount++;
            }
        }

        // Show result
        if (failCount === 0) {
            alert(`Successfully approved ${successCount} user(s)`);
        } else {
            alert(`Approved ${successCount} user(s). Failed to approve ${failCount} user(s).`);
        }

        // Reload data
        this.selectedUsers.clear();
        await Promise.all([
            this.loadUsers(),
            this.loadPendingUsers()
        ]);
        this.renderUsers();
        this.renderPendingUsers();
        this.updateStats();
        this.updatePendingBadge();
    },

    async bulkReject() {
        const count = this.selectedUsers.size;
        if (count === 0) return;

        if (!confirm(`Are you sure you want to reject ${count} user(s)? This will permanently delete their accounts.`)) {
            return;
        }

        const userIds = Array.from(this.selectedUsers);
        let successCount = 0;
        let failCount = 0;

        // Process rejections
        for (const userId of userIds) {
            try {
                const response = await fetch(`${API_URL}/users/${userId}/reject`, {
                    method: 'POST',
                    headers: this.getAuthHeaders()
                });

                if (response.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error('Error rejecting user:', userId, error);
                failCount++;
            }
        }

        // Show result
        if (failCount === 0) {
            alert(`Successfully rejected ${successCount} user(s)`);
        } else {
            alert(`Rejected ${successCount} user(s). Failed to reject ${failCount} user(s).`);
        }

        // Reload data
        this.selectedUsers.clear();
        await this.loadPendingUsers();
        this.renderPendingUsers();
        this.updateStats();
        this.updatePendingBadge();
    },

    async approveUser(userId) {
        if (!confirm('Are you sure you want to approve this user?')) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/users/${userId}/approve`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (response.ok) {
                alert('User approved successfully');
                // Reload both users and pending users
                await Promise.all([
                    this.loadUsers(),
                    this.loadPendingUsers()
                ]);
                this.renderUsers();
                this.renderPendingUsers();
                this.updateStats();
                this.updatePendingBadge();
            } else {
                alert(data.error || 'Failed to approve user');
            }
        } catch (error) {
            console.error('Error approving user:', error);
            alert('Connection error. Please try again.');
        }
    },

    async rejectUser(userId) {
        if (!confirm('Are you sure you want to reject this user? This will permanently delete their account.')) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/users/${userId}/reject`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (response.ok) {
                alert('User rejected and removed');
                // Reload pending users
                await this.loadPendingUsers();
                this.renderPendingUsers();
                this.updateStats();
                this.updatePendingBadge();
            } else {
                alert(data.error || 'Failed to reject user');
            }
        } catch (error) {
            console.error('Error rejecting user:', error);
            alert('Connection error. Please try again.');
        }
    },

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user?')) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/users/${userId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (response.ok) {
                alert('User deleted successfully');
                await this.loadUsers();
                this.renderUsers();
                this.updateStats();
            } else {
                alert(data.error || 'Failed to delete user');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Connection error. Please try again.');
        }
    },

    editUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        this.editingUserId = userId;

        // Populate modal with user data
        document.getElementById('modalTitle').textContent = 'Edit User';
        document.getElementById('userName').value = user.username;
        document.getElementById('userEmail').value = user.email;
        document.getElementById('userPassword').value = '';
        document.getElementById('userPassword').placeholder = 'Leave blank to keep current password';
        document.getElementById('userPassword').required = false;
        document.getElementById('userRole').value = user.role;
        document.getElementById('userStatus').value = user.is_active ? 'active' : 'inactive';

        this.openModal();
    },

    openCreateUserModal() {
        this.editingUserId = null;

        // Reset modal
        document.getElementById('modalTitle').textContent = 'Add New User';
        document.getElementById('userName').value = '';
        document.getElementById('userEmail').value = '';
        document.getElementById('userPassword').value = '';
        document.getElementById('userPassword').placeholder = 'Enter password';
        document.getElementById('userPassword').required = true;
        document.getElementById('userRole').value = 'user';
        document.getElementById('userStatus').value = 'active';

        this.openModal();
    },

    async saveUser(event) {
        event.preventDefault();

        const username = document.getElementById('userName').value;
        const email = document.getElementById('userEmail').value;
        const password = document.getElementById('userPassword').value;
        const role = document.getElementById('userRole').value;
        const status = document.getElementById('userStatus').value;

        try {
            if (this.editingUserId) {
                // Update existing user
                const updateData = {
                    username,
                    email,
                    role,
                    is_active: status === 'active'
                };

                // Include password if provided
                if (password && password.trim() !== '') {
                    updateData.password = password;
                }

                const response = await fetch(`${API_URL}/users/${this.editingUserId}`, {
                    method: 'PUT',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify(updateData)
                });

                const data = await response.json();

                if (response.ok) {
                    alert('User updated successfully');
                    this.closeModal();
                    await this.loadUsers();
                    this.renderUsers();
                    this.updateStats();
                } else {
                    alert(data.error || 'Failed to update user');
                }
            } else {
                // Create new user
                if (!password) {
                    alert('Password is required for new users');
                    return;
                }

                const response = await fetch(`${API_URL}/users`, {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({ username, email, password, role })
                });

                const data = await response.json();

                if (response.ok) {
                    alert('User created successfully');
                    this.closeModal();
                    await this.loadUsers();
                    this.renderUsers();
                    this.updateStats();
                } else {
                    alert(data.error || 'Failed to create user');
                }
            }
        } catch (error) {
            console.error('Error saving user:', error);
            alert('Connection error. Please try again.');
        }
    },

    openModal() {
        document.getElementById('userModal').style.display = 'flex';
    },

    closeModal() {
        document.getElementById('userModal').style.display = 'none';
        this.editingUserId = null;
    },

    filterUsers(searchTerm) {
        const term = searchTerm.toLowerCase();
        this.filteredUsers = this.users.filter(user =>
            user.username.toLowerCase().includes(term) ||
            user.email.toLowerCase().includes(term)
        );
        this.renderUsers();
    },

    filterByRole(role) {
        if (role === '') {
            this.filteredUsers = [...this.users];
        } else {
            this.filteredUsers = this.users.filter(user => user.role === role);
        }
        this.renderUsers();
    },

    filterByStatus(status) {
        if (status === '') {
            this.filteredUsers = [...this.users];
        } else {
            const isActive = status === 'active';
            this.filteredUsers = this.users.filter(user => user.is_active === isActive);
        }
        this.renderUsers();
    },

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    },

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = '/login.html';
        }
    }
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    admin.init();
});

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('userModal');
    if (event.target === modal) {
        admin.closeModal();
    }
};
