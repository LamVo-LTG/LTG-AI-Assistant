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
