# Full-Stack AI Chatbot - Implementation Plan

**Created:** 2025-10-24
**Project:** LTG Assistant v1
**Database:** PostgreSQL (ltg_assistant_v1)
**AI Provider:** Google Gemini API
**Authentication:** JWT
**Real-time:** WebSocket for streaming responses

---

## Technology Stack

### Backend
- **Runtime:** Node.js (v18+)
- **Framework:** Express.js
- **Database:** PostgreSQL (with `pg` driver)
- **Authentication:** JWT (jsonwebtoken + bcrypt)
- **Real-time:** Socket.io for WebSocket support
- **File Upload:** Multer for multipart/form-data
- **API Client:** @google/generative-ai (Gemini SDK)
- **Environment:** dotenv for configuration

### Frontend (Already Built)
- HTML/CSS/JavaScript
- Located in: `Front-end-v3/`
- Files: login.html, admin-panel.html, ai-chatbot.html

### Database
- PostgreSQL (ltg_assistant_v1)
- Schema already created via `setup_database.sql`

---

## Phase 1: Authentication & User Management

### Overview
Build the authentication system with JWT tokens and connect the login/admin panel to the backend.

### 1.1 Project Setup

#### Backend Directory Structure
```
backend/
├── src/
│   ├── config/
│   │   ├── database.js          # PostgreSQL connection
│   │   └── jwt.js               # JWT configuration
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication middleware
│   │   ├── errorHandler.js     # Global error handler
│   │   └── validator.js         # Request validation
│   ├── routes/
│   │   ├── auth.routes.js       # Login/register endpoints
│   │   └── users.routes.js      # User management endpoints
│   ├── controllers/
│   │   ├── auth.controller.js   # Auth logic
│   │   └── users.controller.js  # User CRUD logic
│   ├── models/
│   │   └── user.model.js        # User database queries
│   ├── utils/
│   │   ├── bcrypt.js            # Password hashing utilities
│   │   └── logger.js            # Logging utility
│   └── app.js                   # Express app setup
├── .env                          # Environment variables
├── .env.example                  # Example env file
├── package.json
└── server.js                     # Entry point
```

#### Required Dependencies
```bash
npm install express pg bcrypt jsonwebtoken dotenv cors
npm install --save-dev nodemon
```

#### Environment Variables (.env)
```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ltg_assistant_v1
DB_USER=your_username
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_secret_key_here_change_in_production
JWT_EXPIRES_IN=7d

# CORS
FRONTEND_URL=http://localhost:5500

# Gemini API (for later phases)
GEMINI_API_KEY=your_gemini_api_key
```

### 1.2 Database Connection Setup

**File: `src/config/database.js`**
```javascript
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

module.exports = pool;
```

### 1.3 User Model

**File: `src/models/user.model.js`**
```javascript
const pool = require('../config/database');

class UserModel {
  // Create new user
  async create(userData) {
    const { username, email, password_hash, role } = userData;
    const query = `
      INSERT INTO users (username, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING user_id, username, email, role, created_at
    `;
    const result = await pool.query(query, [username, email, password_hash, role || 'user']);
    return result.rows[0];
  }

  // Find user by email
  async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0];
  }

  // Find user by ID
  async findById(userId) {
    const query = 'SELECT user_id, username, email, role, created_at FROM users WHERE user_id = $1';
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }

  // Get all users (admin only)
  async findAll() {
    const query = 'SELECT user_id, username, email, role, created_at FROM users ORDER BY created_at DESC';
    const result = await pool.query(query);
    return result.rows;
  }

  // Update user
  async update(userId, updates) {
    const { username, email, role } = updates;
    const query = `
      UPDATE users
      SET username = COALESCE($1, username),
          email = COALESCE($2, email),
          role = COALESCE($3, role),
          updated_at = NOW()
      WHERE user_id = $4
      RETURNING user_id, username, email, role, updated_at
    `;
    const result = await pool.query(query, [username, email, role, userId]);
    return result.rows[0];
  }

  // Delete user
  async delete(userId) {
    const query = 'DELETE FROM users WHERE user_id = $1 RETURNING user_id';
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }

  // Check if email exists
  async emailExists(email) {
    const query = 'SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)';
    const result = await pool.query(query, [email]);
    return result.rows[0].exists;
  }
}

module.exports = new UserModel();
```

### 1.4 Password Hashing Utility

**File: `src/utils/bcrypt.js`**
```javascript
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

class BcryptUtil {
  async hash(password) {
    return await bcrypt.hash(password, SALT_ROUNDS);
  }

  async compare(password, hash) {
    return await bcrypt.compare(password, hash);
  }
}

module.exports = new BcryptUtil();
```

### 1.5 JWT Configuration

**File: `src/config/jwt.js`**
```javascript
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

class JWTConfig {
  generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }
}

module.exports = new JWTConfig();
```

### 1.6 Authentication Middleware

**File: `src/middleware/auth.js`**
```javascript
const jwtConfig = require('../config/jwt');
const userModel = require('../models/user.model');

// Verify JWT token
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwtConfig.verifyToken(token);

    // Attach user info to request
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Check if user is admin
function isAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authenticate, isAdmin };
```

### 1.7 Auth Controller

**File: `src/controllers/auth.controller.js`**
```javascript
const userModel = require('../models/user.model');
const bcryptUtil = require('../utils/bcrypt');
const jwtConfig = require('../config/jwt');

class AuthController {
  // Register new user
  async register(req, res) {
    try {
      const { username, email, password } = req.body;

      // Validation
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      // Check if email already exists
      const emailExists = await userModel.emailExists(email);
      if (emailExists) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Hash password
      const password_hash = await bcryptUtil.hash(password);

      // Create user
      const newUser = await userModel.create({
        username,
        email,
        password_hash,
        role: 'user' // Default role
      });

      // Generate JWT token
      const token = jwtConfig.generateToken({
        user_id: newUser.user_id,
        email: newUser.email,
        role: newUser.role
      });

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          user_id: newUser.user_id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  // Login user
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Find user
      const user = await userModel.findByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Verify password
      const isValidPassword = await bcryptUtil.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Generate JWT token
      const token = jwtConfig.generateToken({
        user_id: user.user_id,
        email: user.email,
        role: user.role
      });

      res.json({
        message: 'Login successful',
        token,
        user: {
          user_id: user.user_id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  // Get current user profile
  async getProfile(req, res) {
    try {
      const user = await userModel.findById(req.user.user_id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ user });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  }
}

module.exports = new AuthController();
```

### 1.8 Users Controller (Admin)

**File: `src/controllers/users.controller.js`**
```javascript
const userModel = require('../models/user.model');
const bcryptUtil = require('../utils/bcrypt');

class UsersController {
  // Get all users (admin only)
  async getAllUsers(req, res) {
    try {
      const users = await userModel.findAll();
      res.json({ users });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  // Get user by ID (admin only)
  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const user = await userModel.findById(id);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  }

  // Create new user (admin only)
  async createUser(req, res) {
    try {
      const { username, email, password, role } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      // Check if email exists
      const emailExists = await userModel.emailExists(email);
      if (emailExists) {
        return res.status(409).json({ error: 'Email already exists' });
      }

      // Hash password
      const password_hash = await bcryptUtil.hash(password);

      // Create user
      const newUser = await userModel.create({
        username,
        email,
        password_hash,
        role: role || 'user'
      });

      res.status(201).json({
        message: 'User created successfully',
        user: newUser
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }

  // Update user (admin only)
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { username, email, role } = req.body;

      const updatedUser = await userModel.update(id, { username, email, role });

      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        message: 'User updated successfully',
        user: updatedUser
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }

  // Delete user (admin only)
  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      // Prevent deleting yourself
      if (parseInt(id) === req.user.user_id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      const deletedUser = await userModel.delete(id);

      if (!deletedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
}

module.exports = new UsersController();
```

### 1.9 Routes

**File: `src/routes/auth.routes.js`**
```javascript
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected routes
router.get('/profile', authenticate, authController.getProfile);

module.exports = router;
```

**File: `src/routes/users.routes.js`**
```javascript
const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const { authenticate, isAdmin } = require('../middleware/auth');

// All routes require authentication and admin role
router.use(authenticate, isAdmin);

router.get('/', usersController.getAllUsers);
router.get('/:id', usersController.getUserById);
router.post('/', usersController.createUser);
router.put('/:id', usersController.updateUser);
router.delete('/:id', usersController.deleteUser);

module.exports = router;
```

### 1.10 Express App Setup

**File: `src/app.js`**
```javascript
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5500',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

module.exports = app;
```

**File: `server.js`**
```javascript
const app = require('./src/app');
const pool = require('./src/config/database');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

// Test database connection
async function startServer() {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
```

### 1.11 Package.json Scripts

**File: `package.json`**
```json
{
  "name": "ltg-assistant-backend",
  "version": "1.0.0",
  "description": "Backend for LTG Assistant AI Chatbot",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "keywords": ["ai", "chatbot", "gemini", "express"],
  "author": "Levis Lam",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

### 1.12 Frontend Integration

#### Update login.html
Add JavaScript to handle login form submission:

```javascript
// In login.html, add this script
const API_URL = 'http://localhost:3000/api';

async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      // Store JWT token
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Redirect based on role
      if (data.user.role === 'admin') {
        window.location.href = 'admin-panel.html';
      } else {
        window.location.href = 'ai-chatbot.html';
      }
    } else {
      alert(data.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Login failed. Please try again.');
  }
}

// Attach to form
document.getElementById('loginForm').addEventListener('submit', handleLogin);
```

#### Update admin-panel.html
Add JavaScript to fetch and manage users:

```javascript
// In admin-panel.html
const API_URL = 'http://localhost:3000/api';

// Get token from localStorage
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// Fetch all users
async function loadUsers() {
  try {
    const response = await fetch(`${API_URL}/users`, {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      displayUsers(data.users);
    } else {
      alert(data.error || 'Failed to load users');
    }
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

// Display users in table
function displayUsers(users) {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '';

  users.forEach(user => {
    const row = `
      <tr>
        <td>${user.user_id}</td>
        <td>${user.username}</td>
        <td>${user.email}</td>
        <td>${user.role}</td>
        <td>${new Date(user.created_at).toLocaleDateString()}</td>
        <td>
          <button onclick="editUser(${user.user_id})">Edit</button>
          <button onclick="deleteUser(${user.user_id})">Delete</button>
        </td>
      </tr>
    `;
    tbody.innerHTML += row;
  });
}

// Delete user
async function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user?')) return;

  try {
    const response = await fetch(`${API_URL}/users/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (response.ok) {
      alert('User deleted successfully');
      loadUsers(); // Reload table
    } else {
      const data = await response.json();
      alert(data.error || 'Failed to delete user');
    }
  } catch (error) {
    console.error('Error deleting user:', error);
  }
}

// Load users on page load
document.addEventListener('DOMContentLoaded', loadUsers);
```

### 1.13 Testing Phase 1

#### Backend API Testing with cURL or Postman

**Register User:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Get Profile (use token from login response):**
```bash
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get All Users (admin token required):**
```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

---

### 1.14 Frontend Testing with Playwright MCP

**Overview:**
Use Playwright MCP tools to automate frontend testing. This allows you to test the UI directly through Claude Code without writing traditional test scripts.

#### Prerequisites
1. Backend server running at `http://localhost:3000`
2. Frontend served at `http://localhost:5500` (or use Live Server in VS Code)
3. Test database with sample data

#### Playwright MCP Testing Workflow

**Step 1: Setup Test Environment**
Before running tests, ensure:
- Backend is running: `npm run dev`
- Frontend is accessible via Live Server
- Database has at least one admin user for testing

**Step 2: Create Test Admin User (One-time Setup)**
Run this SQL in your PostgreSQL database:
```sql
-- Password: admin123 (hashed with bcrypt)
INSERT INTO users (username, email, password_hash, role)
VALUES ('Admin User', 'admin@test.com', '$2b$10$YourHashedPasswordHere', 'admin');
```

#### Test Scenarios Using Playwright MCP

**Test Scenario 1: Login Flow**

```markdown
# Test: User Login with Valid Credentials

1. Navigate to login page
2. Fill email field with "admin@test.com"
3. Fill password field with "admin123"
4. Click login button
5. Verify redirect to admin-panel.html (for admin) or ai-chatbot.html (for user)
6. Verify JWT token is stored in localStorage
7. Take screenshot of successful login
```

**Claude Code Commands:**
```
Ask Claude: "Use Playwright to test the login flow:
1. Navigate to http://localhost:5500/login.html
2. Fill in email: admin@test.com
3. Fill in password: admin123
4. Click the login button
5. Wait for navigation
6. Take a screenshot
7. Verify the URL changed to admin-panel.html"
```

**Test Scenario 2: Admin Panel - View Users**

```markdown
# Test: Admin Can View All Users

1. Login as admin (from Test Scenario 1)
2. Wait for users table to load
3. Verify table contains user data
4. Take screenshot of admin panel
5. Check console for any errors
```

**Claude Code Commands:**
```
Ask Claude: "After logging in, use Playwright to:
1. Wait for the users table to appear
2. Take a screenshot of the admin panel
3. Read the table contents
4. Verify there's at least one user displayed"
```

**Test Scenario 3: Admin Panel - Create New User**

```markdown
# Test: Admin Can Create New User

1. Login as admin
2. Click "Add User" button
3. Fill form fields:
   - Username: "Test User"
   - Email: "testuser@example.com"
   - Password: "password123"
   - Role: "user"
4. Submit form
5. Verify success message appears
6. Verify new user appears in table
7. Take screenshot
```

**Claude Code Commands:**
```
Ask Claude: "Use Playwright to test creating a new user:
1. Click the 'Add User' button
2. Fill in the form with username 'Test User', email 'testuser@example.com', password 'password123'
3. Submit the form
4. Wait for success message
5. Verify the new user appears in the table
6. Take a screenshot"
```

**Test Scenario 4: Admin Panel - Delete User**

```markdown
# Test: Admin Can Delete User

1. Login as admin
2. Find test user in table
3. Click delete button for that user
4. Confirm deletion in dialog
5. Verify user removed from table
6. Verify success message
7. Take screenshot
```

**Test Scenario 5: Login Validation - Invalid Credentials**

```markdown
# Test: Login Fails with Invalid Credentials

1. Navigate to login page
2. Fill email: "invalid@test.com"
3. Fill password: "wrongpassword"
4. Click login button
5. Verify error message appears
6. Verify user stays on login page
7. Take screenshot of error
```

**Claude Code Commands:**
```
Ask Claude: "Use Playwright to test login with invalid credentials:
1. Navigate to http://localhost:5500/login.html
2. Enter email 'invalid@test.com' and password 'wrongpassword'
3. Click login
4. Wait for error message
5. Verify we're still on login.html
6. Take a screenshot of the error"
```

**Test Scenario 6: Protected Route Access**

```markdown
# Test: Unauthenticated User Cannot Access Admin Panel

1. Clear localStorage (remove tokens)
2. Navigate directly to admin-panel.html
3. Verify redirect to login.html or error message
4. Take screenshot
```

#### Playwright MCP Test Checklist

**Authentication Tests:**
- [ ] Login with valid admin credentials redirects to admin panel
- [ ] Login with valid user credentials redirects to chatbot
- [ ] Login with invalid credentials shows error message
- [ ] Login with empty fields shows validation error
- [ ] JWT token is stored in localStorage after successful login
- [ ] Logout clears localStorage and redirects to login

**Admin Panel Tests:**
- [ ] Admin can view all users in table
- [ ] Admin can create new user via form
- [ ] Admin can edit existing user
- [ ] Admin can delete user (with confirmation)
- [ ] Admin cannot delete their own account
- [ ] Non-admin users cannot access admin panel
- [ ] Table displays correct user data (id, username, email, role, created_at)
- [ ] Search/filter functionality works (if implemented)

**UI/UX Tests:**
- [ ] All forms validate required fields
- [ ] Success/error messages display correctly
- [ ] Loading states appear during API calls
- [ ] Responsive design works on different screen sizes
- [ ] No console errors on page load
- [ ] Network requests complete successfully

**Security Tests:**
- [ ] Cannot access protected pages without token
- [ ] Expired tokens are rejected
- [ ] Invalid tokens are rejected
- [ ] Role-based access control works correctly

#### Example Playwright MCP Testing Session

**Full Test Flow Example:**
```
You: "I want to test the complete login and admin panel flow using Playwright"

Claude: "I'll test the authentication and admin panel. Let me start by navigating to the login page."

[Claude uses mcp__playwright__browser_navigate to go to login.html]
[Claude uses mcp__playwright__browser_snapshot to see the page]
[Claude uses mcp__playwright__browser_type to fill email and password fields]
[Claude uses mcp__playwright__browser_click to click login button]
[Claude uses mcp__playwright__browser_wait_for to wait for navigation]
[Claude uses mcp__playwright__browser_take_screenshot to capture result]
[Claude uses mcp__playwright__browser_evaluate to check localStorage for token]
[Claude uses mcp__playwright__browser_snapshot to verify admin panel loaded]
[Claude uses mcp__playwright__browser_take_screenshot for final state]

Claude: "✅ Test passed! The login flow works correctly:
1. Login form submitted successfully
2. JWT token stored in localStorage
3. Redirected to admin-panel.html
4. Admin panel loaded with user data
5. No console errors detected

Screenshots saved:
- login-form.png
- admin-panel-loaded.png"
```

#### Debugging Failed Tests

When tests fail, use these Playwright MCP commands:

1. **Check Console Errors:**
```
Ask Claude: "Use Playwright to check the browser console for any errors"
[Uses mcp__playwright__browser_console_messages]
```

2. **Inspect Network Requests:**
```
Ask Claude: "Show me all network requests made during login"
[Uses mcp__playwright__browser_network_requests]
```

3. **Check Element Visibility:**
```
Ask Claude: "Take a snapshot and verify the login form elements are visible"
[Uses mcp__playwright__browser_snapshot]
```

4. **Inspect Page State:**
```
Ask Claude: "Check if the JWT token is in localStorage"
[Uses mcp__playwright__browser_evaluate with: () => localStorage.getItem('token')]
```

#### Benefits of Playwright MCP Testing

✅ **No Test Code Required**: Test through natural language commands
✅ **Visual Feedback**: Screenshots at each step
✅ **Fast Iteration**: Quick feedback loop
✅ **Integrated**: Works directly in Claude Code
✅ **Comprehensive**: Can test UI, API integration, and state management
✅ **Debugging**: Built-in tools for console logs and network inspection

#### Testing Best Practices

1. **Test in Order**: Start with authentication, then move to features
2. **Use Snapshots**: Take screenshots to verify visual state
3. **Check Console**: Always verify no JavaScript errors
4. **Verify State**: Check localStorage, cookies, and application state
5. **Test Edge Cases**: Invalid inputs, empty fields, boundary conditions
6. **Clean Up**: Clear test data after tests complete
7. **Document Results**: Save screenshots and test reports

---

### 1.15 Manual Testing Checklist

**Backend API Tests:**
- [ ] Database connection successful
- [ ] User registration endpoint works
- [ ] Login endpoint with valid credentials returns token
- [ ] Login endpoint with invalid credentials returns error
- [ ] JWT token generation works correctly
- [ ] Protected routes accept valid tokens
- [ ] Protected routes reject missing tokens
- [ ] Admin-only routes reject user role
- [ ] Admin-only routes accept admin role
- [ ] Get all users (admin) returns user list
- [ ] Create user (admin) adds new user
- [ ] Update user (admin) modifies user data
- [ ] Delete user (admin) removes user

**Frontend Tests (via Playwright MCP):**
- [ ] Login form displays correctly
- [ ] Login with valid credentials works
- [ ] Admin panel loads after admin login
- [ ] Chatbot page loads after user login
- [ ] Admin can view all users
- [ ] Admin can create new user
- [ ] Admin can edit user
- [ ] Admin can delete user
- [ ] Logout clears session

---

## Next Steps After Phase 1

Once Phase 1 is complete and tested:
1. Commit all backend code to git
2. Test frontend-backend integration thoroughly
3. Create first admin user manually in database
4. Move to Phase 2: Conversation & Message Management

---

## Phase 1 Success Criteria

✅ Users can register new accounts
✅ Users can login and receive JWT tokens
✅ JWT tokens are validated on protected routes
✅ Admin can view all users in admin panel
✅ Admin can create, update, delete users
✅ Frontend login page connects to backend
✅ Frontend admin panel connects to backend
✅ Passwords are securely hashed with bcrypt
✅ Database operations work correctly

---

_Ready to implement? Let me know when you want to start coding, or if you have any questions about Phase 1!_
