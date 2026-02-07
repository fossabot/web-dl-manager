import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5492;
const MAIN_PORT = 6275;
const CAMOUFLAGE_DIR = path.join(__dirname, 'public', 'camouflage');

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
  const host = req.headers.host || 'localhost';
  const domain = host.split(':')[0];
  const url = new URL(req.url, `http://${host}`);
  const pathname = url.pathname;

  // 1. Check if user is already logged in via cookie
  const cookies = req.headers.cookie || '';
  const hasSession = cookies.includes('session=');

  if (hasSession && pathname === '/') {
    res.writeHead(302, { Location: `http://${domain}:${MAIN_PORT}/` });
    return res.end();
  }

  // 2. Redirect /login to main app
  if (pathname === '/login' || pathname === '/setup') {
    res.writeHead(302, { Location: `http://${domain}:${MAIN_PORT}${pathname}` });
    return res.end();
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
        // If file not found, serve index.html for SPA-like behavior or just 404
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
  console.log(`Camouflage server running at http://0.0.0.0:${PORT}/`);
  console.log(`Main application expected at http://127.0.0.1:${MAIN_PORT}/`);
});
