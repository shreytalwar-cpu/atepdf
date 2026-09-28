// Private detached child. The CLI is the supported entry point.
import {createServer} from 'node:http';
import {createHmac, timingSafeEqual} from 'node:crypto';
import {readFile, realpath, stat} from 'node:fs/promises';
import {resolve, join, extname, sep, dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readPrivateJSON} from './files.mjs';
import {staticResponse} from './static-response.mjs';

const mime = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.pdf': 'application/pdf', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const routes = new Set(['/api/planner', '/api/planner/status', '/api/planner/key', '/api/planner/pairing', '/api/native/pair', '/api/native/planner', '/api/native/planner/status', '/api/native/disconnect']);
const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";
let config, server, ipv6Server, nativeServer, committed = false, stopping = false, actualPort, certificate;
const managementNonces = new Map();

function close() {
  const alreadyStopping = stopping;
  stopping = true;
  for (const target of [nativeServer, ipv6Server, server]) {
    if (target?.listening) { target.close(); target.closeIdleConnections(); }
  }
  // Abort connections to release outstanding planner reservations. Do not erase
  // config/locks, retry paid calls, or force-exit before provider cleanup.
  if (!alreadyStopping) setTimeout(() => { nativeServer?.closeAllConnections(); ipv6Server?.closeAllConnections(); server?.closeAllConnections(); }, 500).unref();
}
process.on('message', message => { if (message?.type === 'commit' && message.id === config?.id) committed = true; });
process.on('disconnect', () => { if (!committed) close(); });
process.once('SIGTERM', close); process.once('SIGINT', close);

function json(response, status, body) {
  response.writeHead(status, {'Content-Type': 'application/json'}); response.end(JSON.stringify(body));
}
function owns(request) {
  const nonce = request.headers['x-atepdf-nonce'];
  if (typeof nonce !== 'string' || !/^[a-f0-9]{64}$/.test(nonce)) return false;
  const now = Date.now();
  for (const [key, time] of managementNonces) if (now - time > 60_000) managementNonces.delete(key);
  if (managementNonces.has(nonce) || managementNonces.size >= 256) return false;
  const candidate = request.headers.authorization ?? '';
  if (typeof candidate !== 'string' || !/^Atepdf-Beta-HMAC [a-f0-9]{64}$/.test(candidate)) return false;
  const signature = createHmac('sha256', config.token).update(`${config.id}\n${nonce}\n${request.method}\n${request.url}`).digest('hex');
  const expected = `Atepdf-Beta-HMAC ${signature}`;
  const accepted = !request.headers.origin && !request.headers['sec-fetch-site'] && request.headers['x-atepdf-launch'] === config.id
    && candidate.length === expected.length && timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
  if (accepted) managementNonces.set(nonce, now);
  return accepted;
}
function managementReply(request, response, body) {
  const text = JSON.stringify(body);
  response.setHeader('X-Atepdf-Proof', createHmac('sha256', config.token).update(`response\n${request.headers['x-atepdf-nonce']}\n${text}`).digest('hex'));
  response.writeHead(200, {'Content-Type': 'application/json'}); response.end(text);
}
async function listen(target, port, host) {
  await new Promise((resolve, reject) => { target.once('error', reject); target.listen(port, host, resolve); });
}

try {
  if (!process.send || !process.argv[2]) throw new Error('Use the beta launcher.');
  config = await readPrivateJSON(process.argv[2]);
  const {createGateway} = await import(pathToFileURL(join(config.repo, '.build/planner/gateway.mjs')));
  const {LocalConfig} = await import(pathToFileURL(join(config.repo, '.build/planner/local-config.mjs')));
  if (config.shareWithDevices) {
    const {prepareBetaTLS} = await import(pathToFileURL(join(config.repo, 'scripts/native/beta-tls.mjs')));
    // A restart already requires a new pairing. Fresh per-launch credentials
    // permit renewal without overwriting or deleting any earlier certificate.
    certificate = await prepareBetaTLS(join(dirname(process.argv[2]), 'native-tls'), config.shareWithDevices, 3443);
  }
  const localConfig = config.localOnly ? {status: async () => ({connected: false, enabled: false, remaining: 0}), reserve: async () => { throw new Error('Local-only beta.'); }} : new LocalConfig(join(config.repo, '.local'));
  const gateway = createGateway(localConfig, undefined, certificate ? {nativeEndpoint: certificate.endpoint} : {});
  const root = await realpath(config.build.site);
  const handleRequest = async (request, response) => {
    response.setHeader('Content-Security-Policy', csp); response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Cache-Control', 'no-store');
    if (![`127.0.0.1:${actualPort}`, `localhost:${actualPort}`].includes(request.headers.host) || !request.url?.startsWith('/') || request.url.startsWith('//')) {
      json(response, 403, {error: 'Use the local beta address.'}); return;
    }
    if (request.url.startsWith('/__atepdf_beta/')) {
      if (!owns(request)) { json(response, 403, {error: 'Launcher authentication required.'}); return; }
      if (request.url === '/__atepdf_beta/stop' && request.method === 'POST') {
        response.once('finish', close);
        managementReply(request, response, {id: config.id, protocol: 'atepdf-beta-v1', state: 'stopping'}); return;
      }
      if (request.url !== '/__atepdf_beta/status' || request.method !== 'GET') { json(response, 404, {error: 'Not found.'}); return; }
      const info = await stat(join(root, 'index.html')).catch(() => null);
      managementReply(request, response, {id: config.id, protocol: 'atepdf-beta-v1', state: stopping ? 'stopping' : 'running', pid: process.pid,
        localOnly: config.localOnly, shareWithDevices: config.shareWithDevices, buildChanged: info?.mtimeMs !== config.build.indexMtimeMs,
        build: config.build, planner: await localConfig.status(),
        ...(certificate ? {nativeEndpoint: certificate.endpoint, certificateExpiresAt: certificate.expiresAt} : {})}); return;
    }
    if (request.url === '/' && request.headers.host !== `localhost:${actualPort}`) {
      response.writeHead(307, {Location: `http://localhost:${actualPort}/`}); response.end(); return;
    }
    if (certificate && request.url === '/api/planner/pairing' && request.headers.host !== `localhost:${actualPort}`) {
      json(response, 403, {error: 'Create the pairing code from the localhost beta address.'}); return;
    }
    try {
      if ((await stat(join(root, 'index.html'))).mtimeMs !== config.build.indexMtimeMs) {
        json(response, 503, {error: 'The browser build changed. Save any current result, then restart the local beta.'}); return;
      }
      if (routes.has(request.url)) {
        const abort = new AbortController(); response.on('close', () => { if (!response.writableEnded) abort.abort(); });
        try {
          const incoming = new Request(`http://${request.headers.host}${request.url}`, {method: request.method, headers: request.headers, signal: abort.signal,
            ...(request.method === 'POST' ? {body: request, duplex: 'half'} : {})});
          const result = await gateway(incoming);
          response.writeHead(result.status, Object.fromEntries(result.headers)); response.end(await result.text());
        } catch { json(response, 400, {error: 'Invalid local request.'}); }
        return;
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return; }
      const pathname = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${actualPort}`).pathname);
      const file = await realpath(resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname)));
      if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) throw new Error();
      response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
      if (['.js', '.mjs', '.css'].includes(extname(file))) {
        const result = await staticResponse(await readFile(file), request.headers['accept-encoding']);
        response.writeHead(result.status, result.headers);
        response.end(request.method === 'HEAD' ? undefined : result.body); return;
      }
      response.end(request.method === 'HEAD' ? undefined : await readFile(file));
    } catch { response.writeHead(404); response.end('Not found'); }
  };
  server = createServer({maxHeaderSize: 8192}, handleRequest);
  server.requestTimeout = 35_000;
  if (stopping || !process.connected) throw new Error('The launcher disconnected before startup.');
  await listen(server, config.port, '127.0.0.1');
  actualPort = server.address().port;
  // localhost may resolve to either family. Own both loopback addresses so an
  // older IPv6-only server cannot silently receive this beta's browser session.
  ipv6Server = createServer({maxHeaderSize: 8192}, handleRequest);
  ipv6Server.requestTimeout = 35_000;
  await listen(ipv6Server, actualPort, '::1');
  if (certificate) {
    const {createNativeBetaServer} = await import(pathToFileURL(join(config.repo, '.build/planner/native-beta.mjs')));
    nativeServer = createNativeBetaServer({gateway, origin: certificate.endpoint.origin, loopbackOrigin: `http://localhost:${actualPort}`, key: certificate.key, cert: certificate.cert});
    await listen(nativeServer, 3443, config.shareWithDevices);
  }
  if (stopping || !process.connected) throw new Error('The launcher disconnected before startup.');
  process.send({type: 'ready', id: config.id, port: actualPort});
} catch (error) {
  const message = error.code === 'EADDRINUSE' ? 'The requested port is occupied. The existing process was left running; choose another port or stop it through its own owner.'
    : 'Beta startup failed. Verify the browser build, private configuration, and optional TLS setup. No existing server was stopped.';
  console.error(message);
  if (process.connected) process.send({type: 'error', id: config?.id, error: message}, () => process.disconnect());
  close(); process.exitCode = 1;
}
