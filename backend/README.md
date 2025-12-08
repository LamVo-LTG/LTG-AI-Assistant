# LTG Assistant - Backend API

Node.js + Express backend for the LTG Assistant AI Chatbot with JWT authentication and PostgreSQL database.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Server](#running-the-server)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Authentication](#authentication)
- [Utilities](#utilities)
- [Troubleshooting](#troubleshooting)

---

## Overview

This backend provides RESTful API endpoints for:
- User authentication (register, login)
- User management (CRUD operations)
- Role-based access control (admin/user)
- JWT token-based authentication
- PostgreSQL database integration

**Current Status:** Phase 1 Complete ✅

---

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | v18+ | Runtime environment |
| Express.js | ^4.18.2 | Web framework |
| PostgreSQL | 14+ | Database |
| pg | ^8.11.3 | PostgreSQL driver |
| bcrypt | ^5.1.1 | Password hashing |
| jsonwebtoken | ^9.0.2 | JWT authentication |
| dotenv | ^16.3.1 | Environment variables |
| cors | ^2.8.5 | Cross-origin requests |
| nodemon | ^3.0.1 | Development auto-reload |

---

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js       # PostgreSQL connection pool
│   │   └── jwt.js            # JWT token generation & verification
│   │
│   ├── middleware/
│   │   └── auth.js           # Authentication & authorization middleware
│   │
│   ├── models/
│   │   └── user.model.js     # User database queries
│   │
│   ├── controllers/
│   │   ├── auth.controller.js    # Authentication logic
│   │   └── users.controller.js   # User CRUD operations
│   │
│   ├── routes/
│   │   ├── auth.routes.js    # Auth endpoints
│   │   └── users.routes.js   # User management endpoints
│   │
│   ├── utils/
│   │   └── bcrypt.js         # Password hashing utilities
│   │
│   └── app.js                # Express app configuration
│
├── .env                      # Environment variables (not in git)
├── .env.example              # Example environment file
├── .gitignore                # Git ignore rules
├── package.json              # Dependencies & scripts
├── server.js                 # Server entry point
├── make-admin.js             # Utility to make users admin
└── README.md                 # This file
```

---

## Installation

### Prerequisites

1. **Node.js v18 or higher**
   ```bash
   node --version
   ```

2. **PostgreSQL 14 or higher**
   - Database name: `ltg_assistant_v1`
   - Run the schema from `../Back-end/setup_database.sql`

### Install Dependencies

```bash
npm install
```

This will install:
- express
- pg
- bcrypt
- jsonwebtoken
- dotenv
- cors
- nodemon (dev dependency)

---

## Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ltg_assistant_v1
DB_USER=postgres
DB_PASSWORD=your_password_here

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=7d

# CORS Configuration
FRONTEND_URL=http://localhost:5500

# AI Configuration (Phase 2+)
GEMINI_API_KEY=your_gemini_api_key_here
```

### Important Notes

- ⚠️ **Never commit `.env` to git**
- ✅ Use `.env.example` as a template
- 🔐 Change `JWT_SECRET` in production
- 🔐 Use strong passwords for `DB_PASSWORD`

---

## Running the Server

### Development Mode (with auto-reload)

```bash
npm run dev
```

Uses `nodemon` to automatically restart on file changes.

### Production Mode

```bash
npm start
```

### Expected Output

```
✅ Connected to PostgreSQL database
✅ Database connection successful
🚀 Server running on http://localhost:3000
```

### Verify Server is Running

```bash
curl http://localhost:3000/api/health
```

Response:
```json
{"status":"OK","message":"Server is running"}
```

---

## API Endpoints

### Base URL
```
http://localhost:3000/api
```

### Health Check

#### GET /api/health
Check if server is running.

**Response:**
```json
{
  "status": "OK",
  "message": "Server is running"
}
```

---

### Authentication Endpoints

#### POST /api/auth/register
Register a new user.

**Request Body:**
```json
{
  "username": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "username": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

**Errors:**
- `400` - Missing required fields or password too short
- `409` - Email already registered
- `500` - Server error

---

#### POST /api/auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "username": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

**Errors:**
- `400` - Missing email or password
- `401` - Invalid credentials
- `500` - Server error

---

#### GET /api/auth/profile
Get current user profile (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "username": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "created_at": "2025-10-24T04:52:49.742Z"
  }
}
```

**Errors:**
- `401` - No token or invalid token
- `404` - User not found
- `500` - Server error

---

### User Management Endpoints (Admin Only)

All user management endpoints require:
1. Valid JWT token in Authorization header
2. User role must be `admin`

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

---

#### GET /api/users
Get all users.

**Response (200):**
```json
{
  "users": [
    {
      "id": "uuid",
      "username": "Admin User",
      "email": "admin@test.com",
      "role": "admin",
      "created_at": "2025-10-24T04:52:49.742Z"
    },
    ...
  ]
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not admin
- `500` - Server error

---

#### GET /api/users/:id
Get user by ID.

**Parameters:**
- `id` - User UUID

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "username": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "created_at": "2025-10-24T04:52:49.742Z"
  }
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not admin
- `404` - User not found
- `500` - Server error

---

#### POST /api/users
Create a new user (admin only).

**Request Body:**
```json
{
  "username": "New User",
  "email": "newuser@example.com",
  "password": "password123",
  "role": "user"
}
```

**Response (201):**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "uuid",
    "username": "New User",
    "email": "newuser@example.com",
    "role": "user",
    "created_at": "2025-10-24T05:00:00.000Z"
  }
}
```

**Errors:**
- `400` - Missing required fields
- `401` - Not authenticated
- `403` - Not admin
- `409` - Email already exists
- `500` - Server error

---

#### PUT /api/users/:id
Update user information.

**Parameters:**
- `id` - User UUID

**Request Body:**
```json
{
  "username": "Updated Name",
  "email": "updated@example.com",
  "role": "admin"
}
```

**Response (200):**
```json
{
  "message": "User updated successfully",
  "user": {
    "id": "uuid",
    "username": "Updated Name",
    "email": "updated@example.com",
    "role": "admin",
    "updated_at": "2025-10-24T05:10:00.000Z"
  }
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not admin
- `404` - User not found
- `500` - Server error

---

#### DELETE /api/users/:id
Delete a user.

**Parameters:**
- `id` - User UUID

**Response (200):**
```json
{
  "message": "User deleted successfully"
}
```

**Errors:**
- `400` - Cannot delete your own account
- `401` - Not authenticated
- `403` - Not admin
- `404` - User not found
- `500` - Server error

---

## Database Schema

### Users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_role CHECK (role IN ('admin', 'user')),
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);
```

**Fields Used in Phase 1:**
- `id` - UUID primary key
- `username` - Display name
- `email` - Login email (unique)
- `password_hash` - Bcrypt hashed password
- `role` - User role (admin/user)
- `created_at` - Registration timestamp

---

## Authentication

### JWT Token Structure

**Payload:**
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "role": "user",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Token Expiration
- Default: 7 days
- Configurable via `JWT_EXPIRES_IN` in `.env`

### Password Security
- Hashed using bcrypt
- Salt rounds: 10
- Never stored in plain text
- Never returned in API responses

---

## Utilities

### make-admin.js

Utility script to promote a user to admin role.

**Usage:**
```bash
node make-admin.js <email>
```

**Example:**
```bash
node make-admin.js admin@test.com
```

**Output:**
```
✅ Connected to PostgreSQL database
✅ User updated to admin:
{
  id: 'uuid',
  username: 'Test Admin',
  email: 'admin@test.com',
  role: 'admin'
}
```

---

## Troubleshooting

### Port 3000 Already in Use

**Windows:**
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process
taskkill //F //PID <PID>
```

**Linux/Mac:**
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9
```

---

### Database Connection Errors

**Error: "connection refused"**
- Check PostgreSQL is running
- Verify `DB_HOST` and `DB_PORT` in `.env`

**Error: "database does not exist"**
- Create database: `CREATE DATABASE ltg_assistant_v1;`
- Run schema: `psql -U postgres -d ltg_assistant_v1 -f ../Back-end/setup_database.sql`

**Error: "password authentication failed"**
- Verify `DB_USER` and `DB_PASSWORD` in `.env`
- Check PostgreSQL user has access

---

### JWT Token Errors

**Error: "Invalid or expired token"**
- Token has expired (default 7 days)
- User needs to login again
- Check `JWT_SECRET` matches token generation

**Error: "No token provided"**
- Missing `Authorization` header
- Header format: `Bearer <token>`

---

### CORS Errors

**Error: "CORS policy blocked"**
- Check `FRONTEND_URL` in `.env`
- Ensure frontend URL matches exactly
- Default: `http://localhost:5500`

---

## Development Scripts

```bash
# Start server (production)
npm start

# Start server with auto-reload (development)
npm run dev

# Make user admin
node make-admin.js <email>
```

---

## Security Best Practices

✅ **Implemented:**
- Password hashing with bcrypt
- JWT token authentication
- Role-based access control
- CORS configuration
- Input validation
- SQL injection prevention (parameterized queries)

⚠️ **For Production:**
- Use HTTPS only
- Set strong `JWT_SECRET`
- Enable rate limiting
- Add request logging
- Use environment-specific configs
- Set up monitoring and alerts

---

## Future Enhancements (Phase 2+)

- [ ] Conversation management
- [ ] Message storage and retrieval
- [ ] Gemini AI integration
- [ ] WebSocket for real-time chat
- [ ] File upload handling
- [ ] Email verification
- [ ] Password reset
- [ ] Rate limiting
- [ ] API documentation (Swagger)

---

## License

MIT

## Author

Levis Lam

---

**Last Updated:** October 24, 2025
**Status:** ✅ Phase 1 Complete - Production Ready
