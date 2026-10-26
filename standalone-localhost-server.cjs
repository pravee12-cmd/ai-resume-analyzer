/**
 * Zero-Dependency Localhost Server for ResuMetric AI Resume Analyzer
 * Run with: node standalone-localhost-server.cjs
 * Opens on: http://localhost:3000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const safeUrl = (req.url || '/').split('?')[0];

  // Serve standalone-index.html when visiting "/" so it loads ./styles.css and ./app.bundle.js immediately
  let targetRel = safeUrl === '/' ? 'standalone-index.html' : safeUrl.replace(/^\/+/, '');
  let filePath = path.join(ROOT_DIR, targetRel);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const distFallback = path.join(ROOT_DIR, 'dist', safeUrl === '/' ? 'index.html' : safeUrl.replace(/^\/+/, ''));
    if (fs.existsSync(distFallback) && fs.statSync(distFallback).isFile()) {
      filePath = distFallback;
    } else {
      filePath = path.join(
        ROOT_DIR,
        fs.existsSync(path.join(ROOT_DIR, 'standalone-index.html'))
          ? 'standalone-index.html'
          : 'index.html'
      );
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log('==============================================================');
  console.log(' ResuMetric AI Resume Analyzer running at http://localhost:' + PORT);
  console.log(' For full Express API + MongoDB backend, run: npm install && npm run dev');
  console.log('==============================================================');
});
