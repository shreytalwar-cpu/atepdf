import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, chmod, symlink, realpath, rm, lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createServer, request} from 'node:http';
import {request as secureRequest} from 'node:https';
import {connect} from 'node:net';
import {execFile, spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {startWeb, stopWeb, webStatus, management, sleep, buildIdentity} from './web.mjs';
import {randomBytes, randomUUID, X509Certificate} from 'node:crypto';
import {readPrivateJSON, writePrivateJSON} from './files.mjs';
import {gunzipSync} from 'node:zlib';

const realRepo = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
async function fixture(t) {
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'atepdf-beta-test-')));
  await mkdir(join(repo, 'apps/universal/dist-web'), {recursive: true});
  await writeFile(join(repo, 'apps/universal/dist-web/index.html'), '<!doctype html><title>synthetic atepdf beta</title>');
  await mkdir(join(repo, '.build/planner'), {recursive: true});
  // Use the actual built gateway and LocalConfig. The config directory is this
  // fresh synthetic fixture; real owner credentials are never opened by tests.
  for (const [name, symbol] of [['gateway', 'createGateway'], ['local-config', 'LocalConfig']])
    await writeFile(join(repo, `.build/planner/${name}.mjs`), `export {${symbol}} from ${JSON.stringify(pathToFileURL(join(realRepo, `.build/planner/${name}.mjs`)).href)};\n`);
  t.after(async () => {
    try { await stopWeb(repo); } catch { /* Failure cases intentionally substitute ownership; each test restores it. */ }
    await rm(repo, {recursive: true}); // Only the mkdtemp directory created above.
  });
  return repo;
}
const record = repo => readPrivateJSON(join(repo, '.local/beta/web.json'));
const fetchWithTimeout = (url, options = {}) => fetch(url, {...options, signal: AbortSignal.timeout(3000)});

test('detached browser launch survives its caller, reuses its own process, and stops only itself', async t => {
  const repo = await fixture(t);
  // This launcher process actually exits. The child must remain independently usable.
  const source = `import {startWeb} from ${JSON.stringify(new URL('./web.mjs', import.meta.url).href)}; console.log(JSON.stringify(await startWeb(process.argv[1], {port:0,localOnly:true})));`;
  const launched = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', source, repo], {timeout: 15_000});
  const first = JSON.parse(launched.stdout);
  assert.equal(first.state, 'running'); assert.equal(first.reused, false);
  assert.notEqual(first.pid, process.pid);
  const response = await fetchWithTimeout(first.url);
  assert.equal(response.status, 200); assert.match(await response.text(), /synthetic atepdf beta/);
  assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const repeated = await startWeb(repo, {port: new URL(first.url).port * 1, localOnly: true});
  assert.equal(repeated.pid, first.pid); assert.equal(repeated.reused, true);
  const info = await lstat(join(repo, '.local/beta/web.json'));
  assert.equal(info.mode & 0o077, 0);
  assert.equal(JSON.stringify(await webStatus(repo)).includes((await record(repo)).token), false);
  await assert.rejects(startWeb(repo, {port: new URL(first.url).port * 1}), /different options/);
  assert.equal((await stopWeb(repo)).state, 'stopped');
  assert.equal((await webStatus(repo)).state, 'stopped');
  const next = await startWeb(repo, {port: 0, localOnly: true});
  assert.notEqual(next.id, first.id);
});

test('management rejects a browser context and an incorrect ownership token', async t => {
  const repo = await fixture(t), running = await startWeb(repo, {port: 0, localOnly: true}), current = await record(repo);
  const refused = await fetchWithTimeout(`${running.url}/__atepdf_beta/stop`, {method: 'POST', headers: {Authorization: `Bearer ${current.token}`, 'X-Atepdf-Launch': current.id, Origin: running.url}});
  assert.equal(refused.status, 403);
  await assert.rejects(management({...current, token: 'f'.repeat(64)}, 'stop'), /does not belong/);
  assert.equal((await webStatus(repo)).state, 'running');
});

test('malformed non-ASCII management authorization is rejected without crashing the server', async t => {
  const repo = await fixture(t), running = await startWeb(repo, {port: 0, localOnly: true}), current = await record(repo);
  const status = await new Promise((resolve, reject) => {
    const req = request(`${running.url}/__atepdf_beta/status`, {agent: false, headers: {
      Authorization: `Atepdf-Beta-HMAC ${'a'.repeat(63)}é`, 'X-Atepdf-Launch': current.id, 'X-Atepdf-Nonce': randomBytes(32).toString('hex'),
    }}, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
    req.on('error', reject); req.end();
  });
  assert.equal(status, 403);
  assert.equal((await webStatus(repo)).state, 'running');
});

test('occupied port leaves the unrelated server running', async t => {
  const repo = await fixture(t);
  const foreign = createServer((request, response) => response.end('foreign fixture'));
  await new Promise(resolve => foreign.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => foreign.close(resolve)));
  const port = foreign.address().port;
  await assert.rejects(startWeb(repo, {port, localOnly: true}), /port is occupied/);
  assert.equal(await (await fetchWithTimeout(`http://127.0.0.1:${port}`)).text(), 'foreign fixture');
});

test('an IPv6-only localhost owner prevents a conflicting IPv4 beta launch', async t => {
  const repo = await fixture(t);
  const foreign = createServer((request, response) => response.end('foreign IPv6 fixture'));
  await new Promise((resolve, reject) => { foreign.once('error', reject); foreign.listen(0, '::1', resolve); });
  t.after(() => new Promise(resolve => foreign.close(resolve)));
  const port = foreign.address().port;
  await assert.rejects(startWeb(repo, {port, localOnly: true}), /port is occupied/);
  assert.equal(await (await fetchWithTimeout(`http://[::1]:${port}`)).text(), 'foreign IPv6 fixture');
  await assert.rejects(fetchWithTimeout(`http://127.0.0.1:${port}`));
});

test('stale launch metadata never authorizes stopping the new owner of that port', async t => {
  const repo = await fixture(t), first = await startWeb(repo, {port: 0, localOnly: true});
  const current = await record(repo); await stopWeb(repo);
  const seen = [];
  const foreign = createServer((request, response) => {
    seen.push({url: request.url, authorization: request.headers.authorization});
    response.end(JSON.stringify({state: 'running', id: request.headers['x-atepdf-launch'], protocol: 'atepdf-beta-v1'}));
  });
  await new Promise(resolve => foreign.listen(current.port, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => foreign.close(resolve)));
  await assert.rejects(stopWeb(repo), /does not belong/);
  await assert.rejects(startWeb(repo, {port: current.port, localOnly: true}), /does not belong/);
  assert.equal(seen.some(item => item.url.endsWith('/stop')), false);
  assert.equal(JSON.stringify(seen).includes(current.token), false);
  assert.equal((await fetchWithTimeout(first.url)).status, 200);
});

test('local-only mode cannot save keys or reserve a paid planning request', async t => {
  const repo = await fixture(t), running = await startWeb(repo, {port: 0, localOnly: true});
  const status = await (await fetchWithTimeout(`${running.url}/api/planner/status`)).json();
  assert.equal(status.connected, false); assert.equal(status.enabled, false);
  const headers = {Origin: running.url, 'Content-Type': 'application/json', 'x-atepdf-token': status.token};
  assert.equal((await fetchWithTimeout(`${running.url}/api/planner/key`, {method: 'POST', headers, body: '{"key":"sk-synthetic-no-network-test"}'})).status, 503);
  assert.equal((await fetchWithTimeout(`${running.url}/api/planner`, {method: 'POST', headers, body: '{}'})).status, 503);
  await assert.rejects(readFile(join(repo, '.local/openai-key')), {code: 'ENOENT'});
});

test('normal launch reuses private local settings without replenishing allowance or exposing the key', async t => {
  const repo = await fixture(t);
  await mkdir(join(repo, '.local'), {mode: 0o700});
  const dummyKey = 'sk-synthetic-test-never-sent-to-provider';
  const settings = '{"enabled":false,"model":"deliberately-disabled","approvedRequests":3}';
  await writeFile(join(repo, '.local/openai-key'), dummyKey, {mode: 0o600});
  await writeFile(join(repo, '.local/planner-settings.json'), settings, {mode: 0o600});
  const running = await startWeb(repo, {port: 0});
  assert.equal(running.localOnly, false); assert.equal(running.planner.connected, true); assert.equal(running.planner.enabled, false);
  assert.equal(running.planner.remaining, 3);
  assert.equal(JSON.stringify(running).includes(dummyKey), false);
  assert.equal(await readFile(join(repo, '.local/planner-settings.json'), 'utf8'), settings);
  assert.equal(await readFile(running.log, 'utf8'), '');
});

test('static serving blocks symlink escapes and rejects foreign Host headers', async t => {
  const repo = await fixture(t);
  await writeFile(join(repo, 'private-canary.txt'), 'do-not-serve');
  await symlink(join(repo, 'private-canary.txt'), join(repo, 'apps/universal/dist-web/escape.txt'));
  const running = await startWeb(repo, {port: 0, localOnly: true});
  assert.equal((await fetchWithTimeout(`${running.url}/escape.txt`)).status, 404);
  const foreignHost = await new Promise((resolve, reject) => {
    const req = request(running.url, {headers: {Host: 'attacker.invalid'}}, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
    req.on('error', reject); req.end();
  });
  assert.equal(foreignHost, 403);
  assert.equal((await fetchWithTimeout(`${running.url}/.local/openai-key`)).status, 404);
});

test('static scripts and styles negotiate gzip without changing bytes or the privacy policy', async t => {
  const repo = await fixture(t), site = join(repo, 'apps/universal/dist-web');
  const source = Buffer.from('/* synthetic public app asset */\n'.repeat(300));
  for (const name of ['entry.js', 'worker.mjs', 'style.css']) await writeFile(join(site, name), source);
  const running = await startWeb(repo, {port: 0, localOnly: true});
  // node:http preserves encoded wire bytes; fetch transparently decompresses.
  const raw = (path, encoding, method = 'GET') => new Promise((resolve, reject) => {
    const req = request(running.url + path, {method, agent: false, headers: encoding === undefined ? {} : {'Accept-Encoding': encoding}}, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({status: response.statusCode, headers: response.headers, bytes: Buffer.concat(chunks)}));
    });
    req.setTimeout(3000, () => req.destroy(new Error('Synthetic static response timed out.')));
    req.on('error', reject); req.end();
  });
  for (const name of ['entry.js', 'worker.mjs', 'style.css']) {
    const encoded = await raw('/' + name, 'gzip, deflate, br');
    assert.equal(encoded.status, 200); assert.equal(encoded.headers['content-encoding'], 'gzip');
    assert.equal(encoded.headers['content-type'], name.endsWith('.css') ? 'text/css' : 'text/javascript');
    assert.ok(encoded.bytes.length < source.length); assert.deepEqual(gunzipSync(encoded.bytes), source);
    assert.equal(Number(encoded.headers['content-length']), encoded.bytes.length);
    assert.equal(encoded.headers.vary, 'Accept-Encoding'); assert.equal(encoded.headers['cache-control'], 'no-store');
    assert.equal(encoded.headers['x-content-type-options'], 'nosniff');
    assert.match(encoded.headers['content-security-policy'], /connect-src 'self'/);
    const head = await raw('/' + name, 'gzip', 'HEAD');
    assert.equal(head.bytes.length, 0); assert.equal(head.headers['content-encoding'], 'gzip');
    assert.equal(head.headers['content-length'], encoded.headers['content-length']);
    const identityHead = await raw('/' + name, 'identity', 'HEAD');
    assert.equal(identityHead.bytes.length, 0); assert.equal(identityHead.headers['content-encoding'], undefined);
    assert.equal(Number(identityHead.headers['content-length']), source.length);
  }
  for (const encoding of [undefined, '', 'identity', 'br', 'gzip;q=0', '*;q=0, identity;q=1', 'gzip;q=0.2, identity;q=0.8', 'gzip;q=bogus', 'gzip;q=1.5', 'gzip;q=1, gzip;q=0', 'gzip;q=0;q=1', 'gzip;q=1;q=0']) {
    const response = await raw('/entry.js', encoding);
    assert.equal(response.status, 200, String(encoding)); assert.equal(response.headers['content-encoding'], undefined);
    assert.deepEqual(response.bytes, source); assert.equal(response.headers.vary, 'Accept-Encoding');
  }
  for (const encoding of ['GZIP ; q=1', '*', 'gzip;q=0.8, identity;q=0.2', 'gzip;q=0.5, identity;q=0', '*;q=0, gzip;q=1']) {
    const response = await raw('/entry.js', encoding);
    assert.equal(response.status, 200, encoding); assert.equal(response.headers['content-encoding'], 'gzip');
    assert.deepEqual(gunzipSync(response.bytes), source);
  }
  for (const encoding of ['gzip;q=0, identity;q=0', '*;q=0', 'br, identity;q=0']) {
    const response = await raw('/entry.js', encoding);
    assert.equal(response.status, 406, encoding); assert.equal(response.bytes.length, 0);
    assert.equal(response.headers.vary, 'Accept-Encoding');
  }
  await writeFile(join(site, 'tiny.js'), '1');
  assert.equal((await raw('/tiny.js', 'gzip')).headers['content-encoding'], undefined);
  assert.deepEqual(gunzipSync((await raw('/tiny.js', 'gzip, identity;q=0')).bytes), Buffer.from('1'));
  const incompressible = randomBytes(4096);
  await writeFile(join(site, 'random.js'), incompressible);
  const unchanged = await raw('/random.js', 'gzip');
  assert.equal(unchanged.headers['content-encoding'], undefined); assert.deepEqual(unchanged.bytes, incompressible);
  const concurrent = await Promise.all(Array.from({length: 8}, (_, index) => raw('/entry.js', index % 2 ? 'gzip' : 'identity')));
  for (const [index, response] of concurrent.entries()) {
    assert.deepEqual(index % 2 ? gunzipSync(response.bytes) : response.bytes, source);
    assert.equal(response.headers['content-encoding'], index % 2 ? 'gzip' : undefined);
  }
  // There is no compressed response cache to return an earlier asset revision.
  const next = Buffer.from('/* revised synthetic asset */\n'.repeat(300));
  await writeFile(join(site, 'entry.js'), next);
  assert.deepEqual(gunzipSync((await raw('/entry.js', 'gzip')).bytes), next);

  for (const name of ['document.pdf', 'image.png', 'metadata.json', 'engine.wasm']) {
    await writeFile(join(site, name), source);
    const response = await raw('/' + name, 'gzip');
    assert.equal(response.headers['content-encoding'], undefined); assert.equal(response.headers.vary, undefined);
    assert.deepEqual(response.bytes, source);
  }
  for (const path of ['/', '/api/planner/status', '/__atepdf_beta/status', '/missing.js']) {
    const response = await raw(path, 'gzip');
    assert.equal(response.headers['content-encoding'], undefined, path);
    assert.equal(response.headers['cache-control'], 'no-store');
  }
  await writeFile(join(repo, 'private.js'), source);
  await symlink(join(repo, 'private.js'), join(site, 'escaped.js'));
  assert.equal((await raw('/escaped.js', 'gzip')).status, 404);
  await sleep(20); await writeFile(join(site, 'index.html'), '<title>changed synthetic build</title>');
  const stale = await raw('/entry.js', 'gzip');
  assert.equal(stale.status, 503); assert.equal(stale.headers['content-encoding'], undefined);
});

test('changed builds fail closed instead of mixing old gateway and new browser assets', async t => {
  const repo = await fixture(t), running = await startWeb(repo, {port: 0, localOnly: true});
  await sleep(20); await writeFile(join(repo, 'apps/universal/dist-web/index.html'), '<title>changed build</title>');
  assert.equal((await webStatus(repo)).buildChanged, true);
  assert.equal((await fetchWithTimeout(running.url)).status, 503);
  await assert.rejects(startWeb(repo, {port: new URL(running.url).port * 1, localOnly: true}), /build changed/);
});

test('unsafe private directory and substituted state file are rejected without changing permissions', async t => {
  const repo = await fixture(t);
  await mkdir(join(repo, '.local'), {mode: 0o755});
  await assert.rejects(startWeb(repo, {port: 0, localOnly: true}), /Unsafe beta directory/);
  assert.equal((await lstat(join(repo, '.local'))).mode & 0o077, 0o055);
  await chmod(join(repo, '.local'), 0o700);
  await startWeb(repo, {port: 0, localOnly: true}); await stopWeb(repo);
  const original = await readFile(join(repo, '.local/beta/web.json'));
  await rm(join(repo, '.local/beta/web.json'));
  await writeFile(join(repo, '.local/beta/outside.json'), original, {mode: 0o600});
  await symlink(join(repo, '.local/beta/outside.json'), join(repo, '.local/beta/web.json'));
  await assert.rejects(webStatus(repo));
});

test('device sharing rejects public and wildcard addresses before starting anything', async t => {
  const repo = await fixture(t);
  for (const host of ['0.0.0.0', '8.8.8.8', 'localhost', '../outside', '192.168.1.1:3443'])
    await assert.rejects(startWeb(repo, {port: 0, shareWithDevices: host}), /private IPv4/);
  await assert.rejects(startWeb(repo, {port: 3211, localOnly: true, shareWithDevices: '192.168.1.2'}), /requires the existing planner/);
  await assert.rejects(startWeb(repo, {port: 45000, shareWithDevices: '192.168.1.2'}), /requires browser port/);
});

test('missing build reports the next action without installing or creating a server', async t => {
  const repo = await fixture(t);
  await rm(join(repo, 'apps/universal/dist-web/index.html'));
  await assert.rejects(startWeb(repo, {port: 0}), /pnpm expo:web/);
  assert.equal((await webStatus(repo)).state, 'not-started');
});

test('TLS startup failure closes the new browser listener instead of reporting a partial launch', async t => {
  const repo = await fixture(t);
  await mkdir(join(repo, 'scripts/native'), {recursive: true});
  await writeFile(join(repo, 'scripts/native/beta-tls.mjs'), `export async function prepareBetaTLS() { return {key:Buffer.from('synthetic'),cert:Buffer.from('synthetic'),endpoint:{origin:'https://127.0.0.1:3443',fingerprint:'${'a'.repeat(64)}'},expiresAt:'synthetic'}; }`);
  await writeFile(join(repo, '.build/planner/native-beta.mjs'), `export function createNativeBetaServer() { throw new Error('synthetic TLS bind failure'); }`);
  await mkdir(join(repo, '.local'), {mode: 0o700});
  const configPath = join(repo, '.local/test-launch.json'), id = randomUUID();
  await writePrivateJSON(configPath, {version: 1, repo, id, token: randomBytes(32).toString('hex'), host: '127.0.0.1', port: 0, localOnly: false, shareWithDevices: '127.0.0.1', build: await buildIdentity(repo)});
  const child = spawn(process.execPath, [fileURLToPath(new URL('./server.mjs', import.meta.url)), configPath], {stdio: ['ignore', 'ignore', 'ignore', 'ipc']});
  t.after(() => { if (child.exitCode === null) child.kill(); }); // Exact test-owned child only.
  const messages = []; child.on('message', message => messages.push(message));
  const exit = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Failed TLS startup leaked a listener.')), 5000);
    child.once('exit', code => { clearTimeout(timer); resolve(code); }); child.once('error', reject);
  });
  assert.equal(exit, 1); assert.equal(messages.length, 1); assert.equal(messages[0].type, 'error');
  assert.equal((await webStatus(repo)).state, 'not-started');
});

test('real device-sharing launcher pairs over trusted loopback TLS and renews privately on restart', async t => {
  // These are the protocol's fixed ports, not the owner's 3211 server. A conflict
  // fails startup and leaves the unexpected owner alone; never kill by port/PID.
  const repo = await fixture(t);
  await mkdir(join(repo, 'scripts/native'), {recursive: true});
  await writeFile(join(repo, 'scripts/native/beta-tls.mjs'), `export {prepareBetaTLS} from ${JSON.stringify(pathToFileURL(join(realRepo, 'scripts/native/beta-tls.mjs')).href)};\n`);
  await writeFile(join(repo, '.build/planner/native-beta.mjs'), `export {createNativeBetaServer} from ${JSON.stringify(pathToFileURL(join(realRepo, '.build/planner/native-beta.mjs')).href)};\n`);
  await mkdir(join(repo, '.local'), {mode: 0o700});
  const settings = '{"enabled":false,"model":"deliberately-disabled","approvedRequests":0}';
  const syntheticKey = 'sk-synthetic-disabled-launcher-integration-only';
  await writeFile(join(repo, '.local/openai-key'), syntheticKey, {mode: 0o600});
  await writeFile(join(repo, '.local/planner-settings.json'), settings, {mode: 0o600});

  const tlsJSON = (origin, ca, path, {method = 'GET', headers = {}, body} = {}) => new Promise((resolve, reject) => {
    const req = secureRequest(origin + path, {agent: false, ca, rejectUnauthorized: true, method,
      headers: {...headers, ...(body === undefined ? {} : {'Content-Type': 'application/json'})}}, response => {
      let text = ''; response.setEncoding('utf8');
      response.on('data', part => { text += part; if (text.length > 16_384) req.destroy(new Error('Unexpected TLS response size.')); });
      response.on('end', () => { try { resolve({status: response.statusCode, body: JSON.parse(text)}); } catch { reject(new Error('Unexpected TLS response format.')); } });
    });
    req.setTimeout(3000, () => req.destroy(new Error('Synthetic TLS request timed out.')));
    req.on('error', reject); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
  const closed = (host, port) => new Promise((resolve, reject) => {
    const socket = connect({host, port});
    socket.once('connect', () => { socket.destroy(); reject(new Error(`Expected closed synthetic listener on ${host}:${port}.`)); });
    socket.once('error', error => error.code === 'ECONNREFUSED' ? resolve() : reject(error));
    socket.setTimeout(2000, () => socket.destroy(new Error('Listener-close check timed out.')));
  });
  const stoppedListeners = () => Promise.all([closed('127.0.0.1', 3210), closed('::1', 3210), closed('127.0.0.1', 3443)]);

  const first = await startWeb(repo, {port: 3210, shareWithDevices: '127.0.0.1'});
  assert.equal(first.state, 'running'); assert.equal(first.localOnly, false);
  assert.equal(first.nativeEndpoint.origin, 'https://127.0.0.1:3443');
  assert.equal(first.planner.enabled, false); assert.equal(first.planner.remaining, 0);
  const firstDirectory = join(repo, '.local/beta', first.id, 'native-tls');
  const ca = await readFile(join(firstDirectory, 'ca.pem'));
  const certificate = await readFile(join(firstDirectory, 'cert.pem'));
  const keyInfo = await lstat(join(firstDirectory, 'key.pem'));
  assert.equal((await lstat(firstDirectory)).mode & 0o077, 0);
  assert.equal(keyInfo.mode & 0o077, 0);
  assert.equal(new X509Certificate(certificate).fingerprint256.replaceAll(':', '').toLowerCase(), first.nativeEndpoint.fingerprint);

  const browser = await (await fetchWithTimeout(`${first.url}/api/planner/status`)).json();
  const pairingResponse = await fetchWithTimeout(`${first.url}/api/planner/pairing`, {method: 'POST',
    headers: {Origin: first.url, 'Content-Type': 'application/json', 'x-atepdf-token': browser.token}, body: '{}'});
  assert.equal(pairingResponse.status, 200);
  const wrapped = await pairingResponse.json();
  assert.equal(wrapped.code.startsWith('atepdf-beta:'), true);
  const pairing = JSON.parse(Buffer.from(wrapped.code.slice('atepdf-beta:'.length), 'base64url').toString('utf8'));
  assert.equal(pairing.v, 1); assert.equal(pairing.origin, first.nativeEndpoint.origin);
  assert.equal(pairing.fingerprint, first.nativeEndpoint.fingerprint);
  assert.equal(/^atepdf-local:3210:[a-f0-9]{64}$/.test(pairing.code), true);
  assert.equal(pairing.expiresAt > Date.now(), true);

  const exchanged = await tlsJSON(pairing.origin, ca, '/api/native/pair', {method: 'POST', body: {code: pairing.code}});
  assert.equal(exchanged.status, 200); assert.equal(/^[a-f0-9]{64}$/.test(exchanged.body.token), true);
  const authorization = {Authorization: `Bearer ${exchanged.body.token}`};
  const status = await tlsJSON(pairing.origin, ca, '/api/native/planner/status', {headers: authorization});
  assert.equal(status.status, 200);
  assert.deepEqual(Object.keys(status.body).sort(), ['connected', 'enabled', 'gateAvailable', 'gateReason', 'model', 'remaining']);
  assert.equal(status.body.gateAvailable, false);
  assert.equal(status.body.gateReason, 'recipient_undisclosed');
  assert.equal(status.body.connected, true); assert.equal(status.body.enabled, false); assert.equal(status.body.remaining, 0);
  assert.equal(JSON.stringify(status.body).includes(syntheticKey), false);
  assert.equal((await tlsJSON(pairing.origin, ca, '/api/native/planner', {method: 'POST', headers: authorization, body: {}})).status, 503);
  for (const path of ['/', '/fixtures/brief.pdf', '/.local/openai-key', '/__atepdf_beta/status'])
    assert.equal((await tlsJSON(pairing.origin, ca, path)).status, 403);
  for (const path of ['/api/planner/key', '/api/planner/pairing'])
    assert.equal((await tlsJSON(pairing.origin, ca, path, {method: 'POST', body: {}})).status, 403);
  assert.equal((await tlsJSON(pairing.origin, ca, '/api/native/planner/status', {headers: {...authorization, Origin: first.url}})).status, 403);
  assert.equal(await readFile(join(repo, '.local/planner-settings.json'), 'utf8'), settings);

  const reused = await startWeb(repo, {port: 3210, shareWithDevices: '127.0.0.1'});
  assert.equal(reused.id, first.id); assert.equal(reused.nativeEndpoint.fingerprint, first.nativeEndpoint.fingerprint);
  assert.equal((await stopWeb(repo)).state, 'stopped'); await stoppedListeners();
  const second = await startWeb(repo, {port: 3210, shareWithDevices: '127.0.0.1'});
  assert.notEqual(second.id, first.id); assert.notEqual(second.nativeEndpoint.fingerprint, first.nativeEndpoint.fingerprint);
  assert.equal((await readFile(join(firstDirectory, 'cert.pem'))).equals(certificate), true);
  const preservedKey = await lstat(join(firstDirectory, 'key.pem'));
  assert.equal(preservedKey.ino, keyInfo.ino); assert.equal(preservedKey.mtimeMs, keyInfo.mtimeMs);
  assert.equal((await lstat(join(repo, '.local/beta', second.id, 'native-tls'))).mode & 0o077, 0);
  assert.equal(await readFile(join(repo, '.local/planner-settings.json'), 'utf8'), settings);
  assert.equal((await stopWeb(repo)).state, 'stopped'); await stoppedListeners();
});
