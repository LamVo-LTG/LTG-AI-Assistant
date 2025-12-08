# LTG Assistant v1 - AI Chatbot

A full-stack AI chatbot application with user authentication, conversation management, and Gemini AI integration.

## Project Structure

```
Project/
├── backend/              # Node.js Express backend
│   ├── src/
│   │   ├── config/      # Database & JWT config
│   │   ├── middleware/  # Auth middleware
│   │   ├── models/      # Database models
│   │   ├── controllers/ # Business logic
│   │   ├── routes/      # API routes
│   │   └── utils/       # Helper functions
│   ├── .env             # Environment variables
│   └── server.js        # Entry point
│
├── frontend/            # HTML/CSS/JS frontend
│   ├── login.html
│   ├── admin-dashboard.html
│   ├── ai-chatbot.html
│   └── *.js
│
└── README.md
```

## Tech Stack

### Backend
- **Runtime:** Node.js v18+
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Authentication:** JWT + bcrypt
- **AI:** Google Gemini API
- **Real-time:** Socket.io (planned)

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript
- No framework dependencies

## Getting Started

### Prerequisites

- Node.js v18+
- PostgreSQL 14+
- Gemini API key (for Phase 2+)

### Installation

1. **Clone the repository**

2. **Setup Database**
   ```bash
   # Create database
   psql -U postgres
   CREATE DATABASE ltg_assistant_v1;
   \q

   # Run schema
   psql -U postgres -d ltg_assistant_v1 -f ../Back-end/setup_database.sql
   ```

3. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

4. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

5. **Start the Backend Server**
   ```bash
   npm start
   # Server runs on http://localhost:3000
   ```

6. **Open Frontend**
   - Use VS Code Live Server or any web server
   - Open `frontend/login.html`

## Default Credentials

After running the backend once, you can create an admin user:

```bash
cd backend
node make-admin.js admin@test.com
```

Then login with:
- **Email:** admin@test.com
- **Password:** admin123

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT
- `GET /api/auth/profile` - Get current user (protected)

### User Management (Admin only)
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Health Check
- `GET /api/health` - Server status

## Development Progress

### ✅ Phase 1: Authentication & User Management (Completed)
- User registration and login
- JWT authentication
- Role-based access control
- Admin dashboard for user management
- Password hashing with bcrypt

### 🚧 Phase 2: Conversation & Message Management (Next)
- Conversation tracking
- Message storage
- Gemini AI integration
- File attachments

### 📋 Phase 3: Real-time Features (Planned)
- WebSocket integration
- Streaming responses
- Typing indicators

## Scripts

```bash
# Development with auto-reload
npm run dev

# Production
npm start

# Make user admin
node make-admin.js <email>
```

## Security Features

- ✅ Password hashing with bcrypt (10 rounds)
- ✅ JWT tokens with 7-day expiration
- ✅ Protected routes with middleware
- ✅ Role-based access control
- ✅ CORS configuration
- ✅ Input validation

## Environment Variables

See `.env.example` for required variables:

- `PORT` - Server port (default: 3000)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - PostgreSQL config
- `JWT_SECRET` - Secret key for JWT (change in production!)
- `JWT_EXPIRES_IN` - Token expiration (default: 7d)
- `FRONTEND_URL` - CORS allowed origin
- `GEMINI_API_KEY` - Google Gemini API key (Phase 2+)

## Testing

### Manual API Testing

Use curl or Postman:

```bash
# Health check
curl http://localhost:3000/api/health

# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"Test","email":"test@example.com","password":"test123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

## Troubleshooting

### Port 3000 already in use
```bash
# Windows
netstat -ano | findstr :3000
taskkill //F //PID <PID>

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Database connection errors
- Check PostgreSQL is running
- Verify database name and credentials in `.env`
- Ensure database schema is loaded

### Frontend can't connect to backend
- Check CORS configuration in `.env`
- Verify backend server is running on port 3000
- Check browser console for specific errors

## License

MIT

## Author

Levis Lam

---

**Current Status:** Phase 1 Complete ✅
**Last Updated:** October 24, 2025
