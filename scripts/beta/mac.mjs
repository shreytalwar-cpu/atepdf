import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstat, mkdir, readFile, realpath} from 'node:fs/promises';
import {join, resolve, sep} from 'node:path';
import {privateDirectory, writePrivateJSON, readPrivateJSON} from './files.mjs';

function command(program, args, input) {
  try { return execFileSync(program, args, {encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 2 * 1024 * 1024}); }
  catch { throw new Error(`Mac artifact verification failed at ${program.split('/').at(-1)}. No app was launched or re-signed.`); }
}
const digest = value => createHash('sha256').update(value).digest('hex');

export async function verifyMacArtifact(record, run = command) {
  if (process.platform !== 'darwin') throw new Error('Mac verification requires macOS.');
  if (record?.identifier !== 'dev.atepdf.fresh.mac' || !/^[a-f0-9]{64}$/.test(record.binarySha256) || typeof record.app !== 'string')
    throw new Error('Invalid Mac build record. Rebuild using scripts/native/mac-build.sh.');
  const app = resolve(record.app);
  if (!app.startsWith('/private/tmp/atepdf-mac-') || !app.endsWith('/atepdf.app') || await realpath(app) !== app || !(await lstat(app)).isDirectory())
    throw new Error('Expected the exact fresh, local Mac staging directory. Nothing was launched.');
  const binary = join(app, 'Contents/MacOS/atepdf');
  if (!(await realpath(binary)).startsWith(app + sep) || digest(await readFile(binary)) !== record.binarySha256)
    throw new Error('The Mac binary changed or is missing. Nothing was launched.');
  const info = JSON.parse(run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', join(app, 'Contents/Info.plist')]));
  if (info.CFBundleIdentifier !== record.identifier || info.CFBundleExecutable !== 'atepdf') throw new Error('Unexpected Mac app identity.');
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
  // codesign prints its display report on stderr. A shell is never used.
  const details = run === command ? signatureDetails(app) : run('/usr/bin/codesign', ['-dvv', app]);
  if (!details.includes('Signature=adhoc') || !details.includes('TeamIdentifier=not set') || /flags=.*runtime/.test(details))
    throw new Error('Expected a local ad-hoc development artifact. Nothing was launched.');
  const signed = run('/usr/bin/codesign', ['--display', '--entitlements', ':-', app]);
  const entitlements = JSON.parse(run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', '--', '-'], signed));
  const required = ['com.apple.security.app-sandbox', 'com.apple.security.files.user-selected.read-write'];
  const allowed = new Set([...required, 'com.apple.security.network.client']);
  if (required.some(key => entitlements[key] !== true) || Object.entries(entitlements).some(([key, value]) => !allowed.has(key) || value !== true))
    throw new Error('Unexpected Mac sandbox permissions. Nothing was launched.');
  const bundle = join(app, 'Contents/Resources/main.jsbundle');
  return {app, identifier: record.identifier, binarySha256: record.binarySha256, bundleSha256: digest(await readFile(bundle)),
    builtAt: record.builtAt, entitlements, strictSignatureVerification: 'passed', signature: 'local ad-hoc, development only',
    scope: 'Local Mac test artifact. Not notarized or distributable. Verification does not prove app launch or document processing.'};
}

function signatureDetails(app) {
  const result = spawnSync('/usr/bin/codesign', ['-dvv', app], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  if (result.status !== 0 || result.error) throw new Error('Unable to inspect Mac signature.');
  return result.stderr;
}

async function manifestPath(repo) {
  const root = join(repo, '.build');
  await mkdir(root, {recursive: true});
  if (await realpath(root) !== root || !(await lstat(root)).isDirectory()) throw new Error('Unsafe build directory.');
  return join(await privateDirectory(join(root, 'beta')), 'mac.json');
}

export async function registerMac(repo) {
  const record = JSON.parse(await readFile(join(repo, '.build/mac-last-build.json'), 'utf8'));
  const checked = await verifyMacArtifact(record);
  const path = await manifestPath(repo);
  await writePrivateJSON(path, {version: 1, registeredAt: new Date().toISOString(), ...checked});
  return {state: 'registered', manifest: path, ...checked};
}

export async function macStatus(repo, launch = false) {
  const path = await manifestPath(repo);
  let record;
  try { record = await readPrivateJSON(path); }
  catch (error) { if (error.code === 'ENOENT') return {state: 'not-registered', next: 'Run mac register after the Mac build.'}; throw error; }
  try {
    const checked = await verifyMacArtifact(record);
    if (checked.bundleSha256 !== record.bundleSha256) throw new Error('The registered app bundle changed.');
    if (launch) command('/usr/bin/open', ['-n', '-a', checked.app]);
    return {state: launch ? 'launch-requested' : 'verified', manifest: path, ...checked};
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('The temporary Mac artifact was removed. Rebuild with scripts/native/mac-build.sh and run mac register.');
    throw error;
  }
}
