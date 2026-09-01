import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

/** Serves the built demo app on a fixed port so the adapter's origin matches. */
export function serveStatic(rootDir, port) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const relative = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let filePath = join(rootDir, relative);
    try {
      let body;
      try {
        body = await readFile(filePath);
      } catch {
        // SPA fallback.
        filePath = join(rootDir, 'index.html');
        body = await readFile(filePath);
      }
      response.writeHead(200, { 'content-type': TYPES[extname(filePath)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    // Bind the dual-stack wildcard rather than letting Node pick: if another
    // dev server already holds [::1]:PORT, this must fail loudly instead of
    // binding IPv4 only and letting the browser resolve `localhost` to someone
    // else's app.
    server.listen(port, '::', () => resolve({ server, close: () => new Promise((done) => server.close(done)) }));
  });
}
