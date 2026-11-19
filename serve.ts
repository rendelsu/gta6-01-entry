// Tiny static server for local playtesting of SOLMAR — Vice Harbor.
// Serves game/ at http://localhost:8080. Standard library only.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, 'game');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const server = createServer(async (req, res) => {
  try {
    const raw = req.url.split('?')[0];
    const path = raw === '/' ? '/index.html' : raw;
    const file = join(root, path);
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(8080, () => {
  console.log('SOLMAR — Vice Harbor at http://localhost:8080');
});
