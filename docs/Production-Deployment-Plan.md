# Production Deployment Plan

## HTTPS + PM2 Cluster Mode on Windows 11 Pro

**Created:** December 8, 2025
**Updated:** December 8, 2025
**Status:** Ready for Implementation

---

## Overview

Deploy LTG Assistant v1 with **dual-mode support**:

| Mode | Protocol | Port | Process Manager | Use Case |
|------|----------|------|-----------------|----------|
| **Development** | HTTP | 3000 | nodemon | Local development |
| **Production** | HTTPS | 443 | PM2 cluster | Live deployment |

---

## Architecture Diagram

### Production Mode
```
┌─────────────────────────────────────────────────────┐
│                    Windows 11 Pro                    │
│  ┌─────────────────────────────────────────────┐    │
│  │              PM2 (Cluster Mode)              │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐        │    │
│  │  │ Node 1  │ │ Node 2  │ │ Node 3  │ ...    │    │
│  │  └────┬────┘ └────┬────┘ └────┬────┘        │    │
│  │       └───────────┼───────────┘              │    │
│  │                   ▼                          │    │
│  │         Express + Socket.io                  │    │
│  │         (HTTPS on port 443)                  │    │
│  │         + Static Frontend Files              │    │
│  └─────────────────────────────────────────────┘    │
│                       │                              │
│                       ▼                              │
│                  PostgreSQL                          │
└─────────────────────────────────────────────────────┘
          ▲
          │ HTTPS (443)
          │
    ┌─────┴─────┐
    │  Clients  │
    └───────────┘
```

### Development Mode
```
┌──────────────────────────────────────────────────────────────┐
│                        localhost                              │
│  ┌─────────────────────┐     ┌─────────────────────┐         │
│  │   Backend (3000)    │ ←── │   Frontend (5500)   │         │
│  │   HTTP + nodemon    │     │   Static server     │         │
│  └──────────┬──────────┘     └─────────────────────┘         │
│             ▼                                                 │
│        PostgreSQL                                             │
└──────────────────────────────────────────────────────────────┘
```

---

## Current vs Target State

| Component | Development | Production |
|-----------|-------------|------------|
| **Backend** | HTTP on port 3000 | HTTPS on port 443 |
| **Frontend** | Separate server on 5500 | Served by Express |
| **Process Manager** | nodemon | PM2 cluster mode |
| **API URLs** | Dynamic (same-origin) | Dynamic (same-origin) |
| **SSL** | Disabled | `certificate.crt` + `private.key` |
| **Host** | localhost | 0.0.0.0 |

---

## Files to Modify

| # | File | Change Type | Purpose |
|---|------|-------------|---------|
| 1 | `backend/.env` | Modify | Development config (default) |
| 2 | `backend/.env.production` | **NEW** | Production config |
| 3 | `backend/server.js` | Modify | HTTP/HTTPS switch based on env |
| 4 | `backend/src/app.js` | Modify | Static file serving + routing |
| 5 | `backend/ecosystem.config.js` | **NEW** | PM2 configuration |
| 6 | `backend/package.json` | Modify | Add PM2 + scripts |
| 7 | `frontend/assets/js/api-service.js` | Modify | Dynamic API URL |
| 8 | `frontend/assets/js/admin-panel.js` | Modify | Dynamic API URL |
| 9 | `frontend/login.html` | Modify | Dynamic API URL |
| 10 | `frontend/signup.html` | Modify | Dynamic API URL |

---

## Detailed Implementation

### 1. `backend/.env` — Development Configuration (Default)

**Keep existing development settings:**

```env
# Server (Development)
PORT=3000
HOST=localhost
NODE_ENV=development

# SSL (Disabled for development)
SSL_ENABLED=false

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ltg_assistant_v1
DB_USER=postgres
DB_PASSWORD=123456

# JWT
JWT_SECRET=ltg_assistant_jwt_secret_key_2025_change_in_production
JWT_EXPIRES_IN=7d

# CORS (Development)
FRONTEND_URL=http://localhost:5500

# Gemini API
GEMINI_API_KEY=your_api_key_here

# File upload settings
MAX_FILE_SIZE=2097152
UPLOAD_DIR=./uploads
```

---

### 2. `backend/.env.production` — Production Configuration (NEW FILE)

**Create this file for production:**

```env
# Server (Production)
PORT=443
HOST=0.0.0.0
NODE_ENV=production

# SSL (Enabled for production)
SSL_ENABLED=true
SSL_CERT_PATH=./certificates/certificate.crt
SSL_KEY_PATH=./certificates/private.key

# PM2 Configuration
PM2_INSTANCES=4

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ltg_assistant_v1
DB_USER=postgres
DB_PASSWORD=your_secure_password_here

# JWT (Use strong secret in production!)
JWT_SECRET=your_strong_random_secret_key_here
JWT_EXPIRES_IN=7d

# CORS (Production)
FRONTEND_URL=https://172.16.209.89

# Gemini API
GEMINI_API_KEY=your_api_key_here

# File upload settings
MAX_FILE_SIZE=2097152
UPLOAD_DIR=./uploads
```

---

### 3. `backend/server.js` — HTTP/HTTPS Dual Mode

**Replace entire file with:**

```javascript
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const app = require('./src/app');
const pool = require('./src/config/database');
const ChatSocketHandler = require('./src/websockets/chat.socket');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const SSL_ENABLED = process.env.SSL_ENABLED === 'true';

let server;

// Create HTTP or HTTPS server based on SSL_ENABLED
if (SSL_ENABLED) {
  // Production: HTTPS
  const sslOptions = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH)
  };
  server = https.createServer(sslOptions, app);
  console.log('SSL enabled - using HTTPS');
} else {
  // Development: HTTP
  server = http.createServer(app);
  console.log('SSL disabled - using HTTP');
}

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5500',
    credentials: true
  }
});

// Initialize chat socket handler
new ChatSocketHandler(io);

// Test database connection and start server
async function startServer() {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('Database connection successful');

    // Start server
    const protocol = SSL_ENABLED ? 'https' : 'http';
    server.listen(PORT, HOST, () => {
      console.log(`Server running on ${protocol}://${HOST}:${PORT}`);
      console.log(`WebSocket server ready`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Process ID: ${process.pid}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
```

---

### 4. `backend/src/app.js` — Static File Serving

**Add these changes:**

```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');  // ADD THIS
require('dotenv').config();

// ... existing route imports ...

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5500',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === ADD: Serve frontend static files (works in both dev & prod) ===
app.use(express.static(path.join(__dirname, '../../frontend')));

// === ADD: Serve uploads folder ===
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes (existing)
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/system-prompts', systemPromptRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/chat', chatRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// === ADD: Root redirect ===
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Error handling middleware (existing)
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Handle multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File size exceeds 2MB limit' });
  }

  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({ error: err.message });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// === MODIFY: 404 handler - serve frontend for non-API routes ===
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'Route not found' });
  } else {
    // Serve login page for unknown routes
    res.sendFile(path.join(__dirname, '../../frontend/login.html'));
  }
});

module.exports = app;
```

---

### 5. `backend/ecosystem.config.js` — PM2 Configuration (NEW FILE)

```javascript
module.exports = {
  apps: [{
    name: 'ltg-assistant',
    script: 'server.js',
    instances: process.env.PM2_INSTANCES || 4,
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '500M',
    env_file: '.env.production',
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
```

---

### 6. `backend/package.json` — Dependencies & Scripts

**Add to dependencies:**
```json
"pm2": "^5.3.0"
```

**Update scripts section:**
```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js",
  "start:prod": "pm2 start ecosystem.config.js --env production",
  "stop:prod": "pm2 stop ltg-assistant",
  "restart:prod": "pm2 restart ltg-assistant",
  "logs": "pm2 logs ltg-assistant",
  "status": "pm2 status"
}
```

---

### 7. `frontend/assets/js/api-service.js` — Dynamic API URL

**Change line 2:**

```javascript
// OLD
const API_BASE_URL = 'http://localhost:3000/api';

// NEW - Works in both dev and prod
const API_BASE_URL = window.location.origin + '/api';
```

---

### 8. `frontend/assets/js/admin-panel.js` — Dynamic API URL

**Change line 2:**

```javascript
// OLD
const API_URL = 'http://localhost:3000/api';

// NEW - Works in both dev and prod
const API_URL = window.location.origin + '/api';
```

---

### 9. `frontend/login.html` — Dynamic API URL

**Find and replace the hardcoded URL in the login fetch call:**

```javascript
// OLD
const response = await fetch('http://localhost:3000/api/auth/login', {

// NEW
const response = await fetch(window.location.origin + '/api/auth/login', {
```

---

### 10. `frontend/signup.html` — Dynamic API URL

**Find and replace the hardcoded URL in the register fetch call:**

```javascript
// OLD
const response = await fetch('http://localhost:3000/api/auth/register', {

// NEW
const response = await fetch(window.location.origin + '/api/auth/register', {
```

---

## Folder Structure After Implementation

```
Project/
├── backend/
│   ├── certificates/
│   │   ├── certificate.crt ✓ (existing)
│   │   └── private.key ✓ (existing)
│   ├── .env                    ← Modified (development)
│   ├── .env.production         ← NEW (production)
│   ├── ecosystem.config.js     ← NEW (PM2)
│   ├── server.js               ← Modified (HTTP/HTTPS switch)
│   ├── package.json            ← Modified (scripts + PM2)
│   └── src/
│       └── app.js              ← Modified (static serving)
└── frontend/
    ├── assets/
    │   └── js/
    │       ├── api-service.js  ← Modified (dynamic URL)
    │       └── admin-panel.js  ← Modified (dynamic URL)
    ├── login.html              ← Modified (dynamic URL)
    └── signup.html             ← Modified (dynamic URL)
```

---

## Usage Commands

### Development Mode

```bash
# Terminal 1: Backend (HTTP on port 3000)
cd backend
npm run dev

# Terminal 2: Frontend (optional - can also access via http://localhost:3000)
cd frontend
npm start
```

**Access URLs (Development):**
- Backend API: http://localhost:3000/api
- Frontend (via backend): http://localhost:3000/
- Frontend (standalone): http://localhost:5500/

---

### Production Mode

```bash
# 1. Install PM2 globally (one-time)
npm install -g pm2

# 2. Navigate to backend
cd backend

# 3. Copy production environment file
copy .env.production .env

# 4. Install dependencies
npm install

# 5. Start production server (Run as Administrator for port 443)
npm run start:prod

# 6. Verify running
npm run status

# 7. View logs
npm run logs

# 8. Stop server
npm run stop:prod

# 9. Restart server
npm run restart:prod
```

**Access URLs (Production):**

| Purpose | URL |
|---------|-----|
| **Login Page** | https://172.16.209.89/ |
| **Login Page (direct)** | https://172.16.209.89/login.html |
| **Signup Page** | https://172.16.209.89/signup.html |
| **Admin Panel** | https://172.16.209.89/pages/admin-panel.html |
| **AI Chatbot** | https://172.16.209.89/pages/ai-chatbot.html |
| **Health Check** | https://172.16.209.89/api/health |

---

## Switching Between Modes

### To switch to Production:
```bash
cd backend
copy .env.production .env
npm run start:prod
```

### To switch back to Development:
```bash
cd backend
# Edit .env and set:
# SSL_ENABLED=false
# PORT=3000
# HOST=localhost
npm run dev
```

---

## WebSocket Notes

The frontend currently uses REST API for chat operations via `api-service.js`. The Socket.io handler exists in backend but is not actively used by frontend.

**Current status**: PM2 cluster mode works without additional configuration.

**Future consideration**: If WebSocket streaming is enabled later, add:
- `@socket.io/pm2` adapter for sticky sessions, OR
- Redis adapter for cross-process Socket.io state sharing

---

## Troubleshooting

### Port 443 requires admin privileges
Run Command Prompt or PowerShell as Administrator before starting the server.

### Certificate errors in browser
If using self-signed certificates, browsers will show a security warning. Click "Advanced" → "Proceed" to continue.

### PM2 not found
Ensure PM2 is installed globally:
```bash
npm install -g pm2
```

### Check running processes
```bash
pm2 list
pm2 logs ltg-assistant --lines 50
```

### Database connection issues
Verify PostgreSQL is running and `.env` database credentials are correct.

### EADDRINUSE error (port already in use)
```bash
# Find process using the port
netstat -ano | findstr :443
# Kill the process
taskkill /PID <process_id> /F
```

---

## Security Checklist

- [ ] Change `JWT_SECRET` to a strong random value in `.env.production`
- [ ] Update `DB_PASSWORD` to a secure password
- [ ] Ensure certificates are from trusted CA (not self-signed) for public use
- [ ] Configure Windows Firewall to allow port 443
- [ ] Consider rate limiting for production
- [ ] Keep `.env.production` out of version control (add to `.gitignore`)

---

## Quick Reference

| Action | Development | Production |
|--------|-------------|------------|
| **Start** | `npm run dev` | `npm run start:prod` |
| **Stop** | Ctrl+C | `npm run stop:prod` |
| **Restart** | Ctrl+C → `npm run dev` | `npm run restart:prod` |
| **Logs** | Console output | `npm run logs` |
| **Status** | N/A | `npm run status` |
| **Port** | 3000 | 443 |
| **Protocol** | HTTP | HTTPS |
