import {spawn} from 'node:child_process';
import {createHash, createHmac, randomBytes, randomUUID, timingSafeEqual} from 'node:crypto';
import {readFile, realpath, stat, open, mkdir, rmdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {request} from 'node:http';
import {isIP} from 'node:net';
import {runtimeDirectory, privateDirectory, optionalState, writePrivateJSON} from './files.mjs';

const serverScript = fileURLToPath(new URL('./server.mjs', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function buildIdentity(repo) {
  const site = join(repo, 'apps/universal/dist-web');
  const gateway = join(repo, '.build/planner/gateway.mjs');
  try {
    if (await realpath(site) !== site) throw new Error();
    const index = await readFile(join(site, 'index.html'));
    const info = await stat(join(site, 'index.html'));
    return {site, indexSha256: hash(index), indexMtimeMs: info.mtimeMs,
      gatewaySha256: hash(await readFile(gateway))};
  } catch { throw new Error('A built browser app is required. Run pnpm expo:web from the repository, then start the beta. No build or install was attempted.'); }
}

function validRecord(record) {
  return record?.version === 1 && /^[a-f0-9-]{36}$/.test(record.id) && /^[a-f0-9]{64}$/.test(record.token)
    && Number.isInteger(record.port) && record.port > 0 && record.port < 65536 && record.host === '127.0.0.1';
}

export function management(record, action = 'status') {
  if (!validRecord(record)) return Promise.reject(new Error('Invalid beta launch record; nothing was stopped.'));
  const nonce = randomBytes(32).toString('hex');
  const method = action === 'stop' ? 'POST' : 'GET', path = `/__atepdf_beta/${action}`;
  const signature = createHmac('sha256', record.token).update(`${record.id}\n${nonce}\n${method}\n${path}`).digest('hex');
  return new Promise((resolve, reject) => {
    // Do not reuse an idle socket while the owner is deliberately shutting down.
    const req = request({host: record.host, port: record.port, path, method, agent: false,
      headers: {'Host': `127.0.0.1:${record.port}`, 'Authorization': `Atepdf-Beta-HMAC ${signature}`, 'X-Atepdf-Launch': record.id, 'X-Atepdf-Nonce': nonce}}, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', part => { body += part; if (body.length > 16_384) req.destroy(new Error('Unexpected server response.')); });
      res.on('end', () => {
        try {
          const expected = createHmac('sha256', record.token).update(`response\n${nonce}\n${body}`).digest('hex');
          const proof = res.headers['x-atepdf-proof'];
          if (typeof proof !== 'string' || !/^[a-f0-9]{64}$/.test(proof) || !timingSafeEqual(Buffer.from(proof), Buffer.from(expected))) throw new Error();
          const result = JSON.parse(body);
          if (res.statusCode !== 200 || result.id !== record.id || result.protocol !== 'atepdf-beta-v1') throw new Error();
          resolve(result);
        } catch { reject(new Error('The port does not belong to this beta launch. Nothing was stopped.')); }
      });
    });
    req.setTimeout(1500, () => req.destroy(new Error('The beta server did not answer. Nothing was stopped.')));
    req.on('error', reject); req.end();
  });
}

export async function webStatus(repo) {
  const directory = await runtimeDirectory(repo);
  const record = await optionalState(join(directory, 'web.json'));
  if (!record) return {state: 'not-started'};
  try {
    const result = await management(record);
    // Do not expose the stop token, gateway token, or any key in CLI output.
    return {...result, url: `http://localhost:${record.port}`, log: record.log, startedAt: record.startedAt};
  } catch (error) {
    if (error.code === 'ECONNREFUSED') return {state: 'stopped', lastUrl: `http://localhost:${record.port}`, log: record.log};
    throw error;
  }
}

export async function startWeb(repo, {port = 3211, localOnly = false, shareWithDevices, startupTimeoutMs = 15_000} = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Use a valid TCP port.');
  if (shareWithDevices) {
    const bytes = shareWithDevices.split('.').map(Number);
    if (isIP(shareWithDevices) !== 4 || !(bytes[0] === 10 || shareWithDevices === '127.0.0.1' || (bytes[0] === 192 && bytes[1] === 168) || (bytes[0] === 172 && bytes[1] >= 16 && bytes[1] <= 31)))
      throw new Error('Device sharing requires this computer’s explicit private IPv4 address. Public addresses and wildcard binds are not allowed.');
    if (![3210, 3211, 3212].includes(port)) throw new Error('Device pairing requires browser port 3210, 3211, or 3212. Nothing was started.');
  }
  if (shareWithDevices && localOnly) throw new Error('Device pairing requires the existing planner configuration.');
  const directory = await runtimeDirectory(repo);
  const lock = join(directory, 'start.lock');
  try { await mkdir(lock, {mode: 0o700}); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('Another beta start is in progress, or a start was interrupted. Inspect .local/beta/start.lock; no process was stopped and no lock was removed.'); throw error; }
  try {
    const build = await buildIdentity(repo);
    const previous = await optionalState(join(directory, 'web.json'));
    if (previous) {
      try {
        const live = await management(previous);
        if (previous.port !== port || live.localOnly !== localOnly || live.shareWithDevices !== (shareWithDevices ?? null))
          throw new Error('An owned beta is already running with different options. Save your results, then use web stop before changing them.');
        if (live.buildChanged || live.build.indexSha256 !== build.indexSha256 || live.build.gatewaySha256 !== build.gatewaySha256)
          throw new Error('The browser build changed. Save your results, then use web stop and web start to load the new build.');
        return {...await webStatus(repo), reused: true};
      } catch (error) { if (error.code !== 'ECONNREFUSED') throw error; }
    }
    const id = randomUUID(), token = randomBytes(32).toString('hex');
    const run = await privateDirectory(join(directory, id));
    const log = join(run, 'server.log');
    const config = {version: 1, repo, id, token, host: '127.0.0.1', port, localOnly, shareWithDevices: shareWithDevices ?? null, build, startedAt: new Date().toISOString(), log};
    const configPath = join(run, 'launch.json');
    await writePrivateJSON(configPath, config);
    const output = await open(log, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    let child;
    try {
      child = spawn(process.execPath, [serverScript, configPath], {cwd: repo, detached: true,
        env: {PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, LANG: process.env.LANG, EXPO_NO_TELEMETRY: '1', NEXT_TELEMETRY_DISABLED: '1'},
        stdio: ['ignore', output.fd, output.fd, 'ipc']});
      const ready = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Beta startup timed out. Inspect ${log}.`)), startupTimeoutMs);
        const cleanup = () => { clearTimeout(timer); child.off('message', onMessage); child.off('exit', onExit); child.off('error', onError); };
        const onMessage = message => {
          if (message?.id !== id) return;
          cleanup();
          if (message.type === 'ready') resolve(message);
          else reject(new Error(message.error || `Beta startup failed. Inspect ${log}.`));
        };
        const onExit = () => { cleanup(); reject(new Error(`Beta startup failed. Inspect ${log}.`)); };
        const onError = error => { cleanup(); reject(error); };
        child.on('message', onMessage); child.once('exit', onExit); child.once('error', onError);
      });
      const record = {...config, port: ready.port, pid: child.pid};
      await writePrivateJSON(join(directory, 'web.json'), record);
      await new Promise((resolve, reject) => child.send({type: 'commit', id}, error => error ? reject(error) : resolve()));
      child.disconnect(); child.unref();
      return {...await webStatus(repo), reused: false};
    } catch (error) {
      // This is the exact child created by this attempt, not a PID from a file.
      // Disconnection before commit makes that child close itself.
      if (child?.connected) child.disconnect();
      child?.unref();
      throw error;
    } finally { await output.close(); }
  } finally { await rmdir(lock); }
}

export async function stopWeb(repo) {
  const directory = await runtimeDirectory(repo);
  const record = await optionalState(join(directory, 'web.json'));
  if (!record) return {state: 'not-started'};
  try { await management(record); await management(record, 'stop'); }
  catch (error) { if (error.code === 'ECONNREFUSED') return {state: 'stopped'}; throw error; }
  for (let attempt = 0; attempt < 80; attempt++) {
    await sleep(100);
    try { await management(record); }
    catch (error) { if (error.code === 'ECONNREFUSED') return {state: 'stopped', id: record.id}; throw error; }
  }
  throw new Error('The owned server is still shutting down. Check web status; no process was killed.');
}
