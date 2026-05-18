import http from 'http';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
};

http.createServer((req, res) => {
  const pathname = req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0].slice(1));
  const filePath = path.join(root, pathname);
  fs.readFile(filePath, (err, body) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'text/plain' });
    res.end(body);
  });
}).listen(8000);
