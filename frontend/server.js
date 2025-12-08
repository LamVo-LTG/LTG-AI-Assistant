const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5500;

// MIME types for different file extensions
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    // Parse URL and handle root path
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './login.html';
    }

    // Get file extension
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // Read and serve the file
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // File not found
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            } else {
                // Server error
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`, 'utf-8');
            }
        } else {
            // Success
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`🌐 Frontend server running at http://localhost:${PORT}/`);
    console.log(`📝 Login page: http://localhost:${PORT}/login.html`);
    console.log(`👤 Admin dashboard: http://localhost:${PORT}/pages/admin-panel.html`);
    console.log(`💬 Chatbot: http://localhost:${PORT}/pages/ai-chatbot.html`);
    console.log('\nPress Ctrl+C to stop the server');
});
