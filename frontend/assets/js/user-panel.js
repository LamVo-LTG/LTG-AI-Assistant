// User Panel JavaScript
// Note: API_BASE_URL is defined in api-service.js which is loaded before this file

class UserPanel {
    constructor() {
        this.user = null;
        this.originalName = '';
        this.init();
    }

    // Initialize the panel
    async init() {
        // Check authentication
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        // Attach form event listeners
        this.attachEventListeners();

        await this.loadUserProfile();
    }

    // Attach event listeners
    attachEventListeners() {
        // Profile form submission
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateProfile();
            });
        }

        // Password form submission
        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.updatePassword();
            });
        }
    }

    // Get auth headers
    getAuthHeaders() {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    // Load user profile
    async loadUserProfile() {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/profile`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    sessionStorage.removeItem('token');
                    window.location.href = '/login.html';
                    return;
                }
                throw new Error('Failed to load profile');
            }

            const data = await response.json();
            this.user = data.user;
            this.originalName = this.user.username;
            this.originalFullName = this.user.full_name || '';
            this.displayUserInfo();
        } catch (error) {
            console.error('Error loading profile:', error);
            this.showAlert('profileErrorAlert', 'Failed to load profile. Please try again.');
        }
    }

    // Display user information
    displayUserInfo() {
        if (!this.user) return;

        // Update avatar - use full_name initial if available, otherwise username
        const avatar = document.getElementById('userAvatar');
        if (avatar) {
            const displayChar = this.user.full_name
                ? this.user.full_name.charAt(0).toUpperCase()
                : this.user.username.charAt(0).toUpperCase();
            avatar.textContent = displayChar;
        }

        // Update display info - show full_name if available, otherwise username
        const displayName = this.user.full_name || this.user.username;
        document.getElementById('displayName').textContent = displayName;
        document.getElementById('displayEmail').textContent = this.user.email;

        // Fill form fields
        document.getElementById('userEmail').value = this.user.email;
        document.getElementById('userFullName').value = this.user.full_name || '';
        document.getElementById('userName').value = this.user.username;
    }

    // Update profile
    async updateProfile() {
        const userName = document.getElementById('userName').value.trim();
        const userFullName = document.getElementById('userFullName').value.trim();
        const saveBtn = document.getElementById('saveProfileBtn');

        // Clear previous alerts
        this.hideAllAlerts('profile');
        this.clearFieldError('nameError');
        this.clearFieldError('fullNameError');

        // Validate
        if (!userName) {
            this.showFieldError('nameError', 'Username is required');
            return;
        }

        if (userName.length < 2) {
            this.showFieldError('nameError', 'Username must be at least 2 characters');
            return;
        }

        // Disable button
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            const response = await fetch(`${API_BASE_URL}/auth/profile`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    username: userName,
                    full_name: userFullName || null
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update profile');
            }

            // Update local user data
            this.user.username = data.user.username;
            this.user.full_name = data.user.full_name;
            this.originalName = data.user.username;
            this.originalFullName = data.user.full_name || '';
            this.displayUserInfo();

            // Update stored user data in localStorage/sessionStorage
            const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                userData.username = data.user.username;
                userData.full_name = data.user.full_name;
                if (localStorage.getItem('user')) {
                    localStorage.setItem('user', JSON.stringify(userData));
                } else {
                    sessionStorage.setItem('user', JSON.stringify(userData));
                }
            }

            this.showAlert('profileSuccessAlert', 'Profile updated successfully!');
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showAlert('profileErrorAlert', error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    }

    // Reset profile form
    resetProfileForm() {
        document.getElementById('userName').value = this.originalName;
        document.getElementById('userFullName').value = this.originalFullName;
        this.hideAllAlerts('profile');
        this.clearFieldError('nameError');
        this.clearFieldError('fullNameError');
    }

    // Update password
    async updatePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const changeBtn = document.getElementById('changePasswordBtn');

        // Clear previous alerts and errors
        this.hideAllAlerts('password');
        this.clearFieldError('currentPasswordError');
        this.clearFieldError('newPasswordError');
        this.clearFieldError('confirmPasswordError');

        // Validate current password
        if (!currentPassword) {
            this.showFieldError('currentPasswordError', 'Current password is required');
            return;
        }

        // Validate new password strength
        const strengthErrors = this.getPasswordStrengthErrors(newPassword);
        if (strengthErrors.length > 0) {
            this.showFieldError('newPasswordError', strengthErrors[0]);
            return;
        }

        // Validate password match
        if (newPassword !== confirmPassword) {
            this.showFieldError('confirmPasswordError', 'Passwords do not match');
            return;
        }

        // Disable button
        changeBtn.disabled = true;
        changeBtn.textContent = 'Changing...';

        try {
            const response = await fetch(`${API_BASE_URL}/auth/password`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    currentPassword: currentPassword,
                    newPassword: newPassword
                })
            });

            const data = await response.json();

            if (!response.ok) {
                // Handle specific error for current password
                if (response.status === 401) {
                    this.showFieldError('currentPasswordError', 'Current password is incorrect');
                    changeBtn.disabled = false;
                    changeBtn.textContent = 'Change Password';
                    return;
                }
                const errorMsg = data.details ? `${data.error}: ${data.details}` : data.error;
                throw new Error(errorMsg || 'Failed to change password');
            }

            // Clear form
            this.resetPasswordForm();
            this.showAlert('passwordSuccessAlert', 'Password changed successfully!');
        } catch (error) {
            console.error('Error changing password:', error);
            this.showAlert('passwordErrorAlert', error.message);
        } finally {
            changeBtn.disabled = false;
            changeBtn.textContent = 'Change Password';
        }
    }

    // Reset password form
    resetPasswordForm() {
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';

        // Reset strength indicator
        document.getElementById('strengthFill').className = 'strength-fill';
        document.getElementById('strengthText').textContent = '';
        document.getElementById('strengthText').className = 'strength-text';

        // Reset requirements
        this.updateRequirement('reqLength', false);
        this.updateRequirement('reqUppercase', false);
        this.updateRequirement('reqNumber', false);

        this.hideAllAlerts('password');
        this.clearFieldError('currentPasswordError');
        this.clearFieldError('newPasswordError');
        this.clearFieldError('confirmPasswordError');
    }

    // Check password strength
    checkPasswordStrength() {
        const password = document.getElementById('newPassword').value;
        const strengthFill = document.getElementById('strengthFill');
        const strengthText = document.getElementById('strengthText');

        // Check individual requirements
        const hasLength = password.length >= 8;
        const hasUppercase = /[A-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);

        // Update requirement indicators
        this.updateRequirement('reqLength', hasLength);
        this.updateRequirement('reqUppercase', hasUppercase);
        this.updateRequirement('reqNumber', hasNumber);

        // Calculate strength
        const metRequirements = [hasLength, hasUppercase, hasNumber].filter(Boolean).length;

        // Update strength bar
        strengthFill.className = 'strength-fill';
        strengthText.className = 'strength-text';

        if (password.length === 0) {
            strengthText.textContent = '';
            return;
        }

        if (metRequirements <= 1) {
            strengthFill.classList.add('weak');
            strengthText.classList.add('weak');
            strengthText.textContent = 'Weak password';
        } else if (metRequirements === 2) {
            strengthFill.classList.add('medium');
            strengthText.classList.add('medium');
            strengthText.textContent = 'Medium strength';
        } else {
            strengthFill.classList.add('strong');
            strengthText.classList.add('strong');
            strengthText.textContent = 'Strong password';
        }

        // Clear password error if strength is now good
        if (metRequirements === 3) {
            this.clearFieldError('newPasswordError');
        }
    }

    // Update requirement indicator
    updateRequirement(reqId, met) {
        const reqElement = document.getElementById(reqId);
        if (!reqElement) return;

        const icon = reqElement.querySelector('.requirement-icon');

        if (met) {
            reqElement.classList.add('met');
            icon.innerHTML = '&#10004;';
        } else {
            reqElement.classList.remove('met');
            icon.innerHTML = '&#10060;';
        }
    }

    // Get password strength errors
    getPasswordStrengthErrors(password) {
        const errors = [];

        if (password.length < 8) {
            errors.push('Password must be at least 8 characters');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (!/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        return errors;
    }

    // Check password match
    checkPasswordMatch() {
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (confirmPassword && newPassword !== confirmPassword) {
            this.showFieldError('confirmPasswordError', 'Passwords do not match');
        } else {
            this.clearFieldError('confirmPasswordError');
        }
    }

    // Show alert message
    showAlert(alertId, message) {
        const alert = document.getElementById(alertId);
        if (alert) {
            alert.textContent = message;
            alert.classList.add('visible');

            // Auto-hide success alerts after 5 seconds
            if (alertId.includes('Success')) {
                setTimeout(() => {
                    alert.classList.remove('visible');
                }, 5000);
            }
        }
    }

    // Hide all alerts for a section
    hideAllAlerts(section) {
        const successAlert = document.getElementById(`${section}SuccessAlert`);
        const errorAlert = document.getElementById(`${section}ErrorAlert`);

        if (successAlert) successAlert.classList.remove('visible');
        if (errorAlert) errorAlert.classList.remove('visible');
    }

    // Show field error
    showFieldError(errorId, message) {
        const errorElement = document.getElementById(errorId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('visible');

            // Add error class to input
            const input = errorElement.previousElementSibling;
            if (input && input.classList.contains('form-input')) {
                input.classList.add('error');
            }
        }
    }

    // Clear field error
    clearFieldError(errorId) {
        const errorElement = document.getElementById(errorId);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.classList.remove('visible');

            // Remove error class from input
            const input = errorElement.previousElementSibling;
            if (input && input.classList.contains('form-input')) {
                input.classList.remove('error');
            }
        }
    }
}

// Initialize user panel
const userPanel = new UserPanel();
