import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import httpProxy from 'http-proxy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5492;
const MAIN_APP_URL = 'http://127.0.0.1:6275';
const CAMOUFLAGE_DIR = path.join(__dirname, 'public', 'camouflage');

const proxy = httpProxy.createProxyServer({});

// Error handling for proxy
proxy.on('error', (err, req, res) => {
  console.error('Proxy Error:', err);
  if (!res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
  }
  res.end('Bad Gateway: Main application might be starting or down.');
});

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. Check Auth Status via session cookie
  const cookies = req.headers.cookie || '';
  const hasSession = cookies.includes('session=');

  // 2. Logic:
  // - If it's a login/auth related path, proxy to main app
  // - If user has session, proxy to main app
  // - Otherwise, serve static blog
  const isAuthPath = pathname.startsWith('/login') || 
                     pathname.startsWith('/api/') || 
                     pathname.startsWith('/_next/') ||
                     pathname === '/favicon.ico';

  if (hasSession || isAuthPath) {
    return proxy.web(req, res, { target: MAIN_APP_URL });
  }

  // 3. Serve Camouflage Static Files
  let filePath = path.join(CAMOUFLAGE_DIR, pathname === '/' ? 'index.html' : pathname);
  
  // Basic security check to prevent directory traversal
  if (!filePath.startsWith(CAMOUFLAGE_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  const extname = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // If file not found in public/camouflage, fallback to main app (might be a dynamic route)
        // This allows Next.js to handle its own 404s if needed, or we can stay on blog.
        // For "blog first" logic, we usually serve index.html if it's an SPA, or 404.
        fs.readFile(path.join(CAMOUFLAGE_DIR, 'index.html'), (err, indexContent) => {
          if (err) {
            // If blog doesn't have it, maybe it's a manager route? 
            // But we don't want to leak manager existence to unauth users.
            res.writeHead(404);
            res.end('Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(indexContent, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Smart Camouflage Proxy running at http://0.0.0.0:${PORT}/`);
  console.log(`Proxying to Main application at ${MAIN_APP_URL}`);
});