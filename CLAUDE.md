# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LTG Assistant v1 - Full-stack AI chatbot with user authentication, conversation management, and Google Gemini AI integration.

## Development Commands

### Backend (Node.js/Express - Port 3000)
```bash
cd backend
npm run dev          # Development with auto-reload (nodemon)
npm start            # Production
node make-admin.js <email>  # Make user admin (after registering)
```

### Frontend (Vanilla JS - Port 5500)
```bash
cd frontend
npm start            # Start static file server
```

### Database Setup
```bash
# Create database in PostgreSQL first: ltg_assistant_v1
psql -U postgres -d ltg_assistant_v1 -f backend/database/setup_database.sql
```

### Migration Scripts (backend/scripts/)
```bash
node scripts/runPhase3Migration.js    # Run Phase 3 DB migration
node scripts/fix-prompt-modes.js      # Fix conversation prompt modes
```

## Architecture

### Backend (MVC Pattern)
```
backend/
├── server.js           # Entry point - HTTP + WebSocket server
├── src/
│   ├── app.js          # Express app configuration, routes, middleware
│   ├── config/         # database.js, jwt.js, prompts.config.js
│   ├── routes/         # API route definitions
│   ├── controllers/    # Request handlers, business logic
│   ├── models/         # PostgreSQL data access (pg queries)
│   ├── services/       # External services (Gemini AI)
│   ├── middleware/     # auth.js (JWT), upload.js (multer)
│   └── websockets/     # chat.socket.js - Real-time messaging
```

### Frontend (No Build Required)
```
frontend/
├── login.html          # Entry point (root redirect)
├── pages/
│   ├── admin-panel.html
│   └── ai-chatbot.html
├── assets/             # CSS/JS files
└── server.js           # Simple HTTP file server
```

## API Routes

| Prefix | Purpose |
|--------|---------|
| `/api/auth` | Login, register, profile |
| `/api/users` | User CRUD (admin only) |
| `/api/conversations` | Conversation management |
| `/api/messages` | Message history |
| `/api/system-prompts` | System prompt templates |
| `/api/resources` | URL/file resources |
| `/api/chat` | AI chat endpoint |
| `/api/health` | Health check |

## Database Schema (PostgreSQL)

Core tables: `users`, `system_prompts`, `prompt_shares`, `conversations`, `messages`, `resources`

Conversation modes: `ai_agent`, `custom_prompt`, `url_context`

## Environment Variables

Required in `backend/.env`:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - PostgreSQL
- `JWT_SECRET` - Token signing key
- `FRONTEND_URL` - CORS origin (default: http://localhost:5500)
- `GEMINI_API_KEY` - Google Gemini API key

## Key Technical Details

- **Auth**: JWT tokens (7-day expiry), bcrypt password hashing
- **Real-time**: Socket.io WebSocket for chat streaming
- **AI**: Google Gemini API via `@google/generative-ai` SDK
- **File uploads**: Multer middleware, stored in `backend/uploads/`
- **CORS**: Configured for frontend URL origin

## Project Status

- Phase 1: Auth & User Management (complete)
- Phase 2: Conversation & Message Management (in progress)
- Phase 3: Real-time Features
- Phase 4: Advanced Features

See `docs/Phase X - Implementation Plan.md` for detailed specs.
