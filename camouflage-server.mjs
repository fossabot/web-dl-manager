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

// Error handling
proxy.on('error', (err, req, res) => {
  if (!res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Main application is starting or unavailable.');
  }
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
  const cookies = req.headers.cookie || '';
  const hasSession = cookies.includes('session=');
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. Paths that ALWAYS go to the Main Application
  const isManagerPath = pathname.startsWith('/login') || 
                        pathname.startsWith('/api/') || 
                        pathname.startsWith('/_next/') ||
                        pathname.startsWith('/status/') ||
                        pathname.startsWith('/settings/') ||
                        pathname.startsWith('/tasks/') ||
                        pathname === '/favicon.ico' ||
                        pathname === '/manifest.json' ||
                        pathname === '/sw.js';

  // 2. Routing Logic
  // If user is logged in OR accessing a manager-specific path, proxy to Next.js
  if (hasSession || isManagerPath) {
    return proxy.web(req, res, { target: MAIN_APP_URL });
  }

  // 3. Otherwise, serve Static Blog (Camouflage)
  let filePath = path.join(CAMOUFLAGE_DIR, pathname === '/' ? 'index.html' : pathname);
  
  if (!filePath.startsWith(CAMOUFLAGE_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  const extname = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // Blog fallback (for SPA)
        fs.readFile(path.join(CAMOUFLAGE_DIR, 'index.html'), (err, indexContent) => {
          if (err) {
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
  console.log(`[Camouflage Gateway] Running at http://0.0.0.0:${PORT}`);
  console.log(`[Camouflage Gateway] Forwarding to App at ${MAIN_APP_URL}`);
});