// Test-only Safari downloads for the real native Files picker. No planner,
// credentials, arbitrary path access, customer files or application-state writes.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';

const fixtures = new Map([
  ['/mixed-text-and-scan.pdf', new URL('../../fixtures/mixed-text-and-scan.pdf', import.meta.url)],
  ['/image-heavy.pdf', new URL('../../fixtures/image-heavy.pdf', import.meta.url)],
]);
const page = '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>atepdf synthetic fixtures</title></head><body><h1>Local synthetic PDF fixtures</h1><p>Test inputs only. No account or planner.</p><p><a href="/mixed-text-and-scan.pdf" download>Download mixed-text-and-scan.pdf</a></p><p><a href="/image-heavy.pdf" download>Download image-heavy.pdf</a></p></body></html>';
const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Security-Policy', "default-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') { response.writeHead(405); response.end(); return; }
  if (request.url === '/') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(page); return; }
  const file = fixtures.get(request.url);
  if (!file) { response.writeHead(404); response.end(); return; }
  try {
    const bytes = await readFile(file);
    // Safari otherwise prefers its inline PDF viewer despite attachment; the
    // generic download MIME preserves the exact bytes and .pdf filename.
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('Content-Disposition', `attachment; filename="${request.url.slice(1)}"`);
    response.setHeader('Content-Length', bytes.byteLength);
    response.end(bytes);
  } catch { response.writeHead(500); response.end(); }
});
server.listen(3448, '127.0.0.1', () => console.log('Synthetic PDF download server: 127.0.0.1:3448; two tracked fixtures only.'));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.closeAllConnections(); server.close(); });
