// Lokaler Entwicklungs-Server für die HautApp
// Start: node server.js  -> http://localhost:8766
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8766;
const ROOT = __dirname;
const TYPES = {
  '.html':'text/html; charset=utf-8', '.js':'application/javascript', '.css':'text/css',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg',
  '.ico':'image/x-icon'
};

http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (url === '/') url = '/index.html';
  const filePath = path.join(ROOT, url);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('HautApp läuft auf http://localhost:' + PORT);
  console.log('Preview:     http://localhost:' + PORT + '/app.html?preview=1');
  console.log('Studio:      http://localhost:' + PORT + '/studio.html');
});
