import {constants} from 'node:fs';
import {lstat, mkdir, open, realpath, rename, unlink} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

export async function privateDirectory(path) {
  // Walk only from an existing parent. Never chmod or follow a substituted root.
  try { await mkdir(path, {mode: 0o700}); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) || info.uid !== process.getuid?.())
    throw new Error(`Unsafe beta directory: ${path}. No permissions were changed.`);
  return path;
}

export async function runtimeDirectory(repo) {
  if (await realpath(repo) !== resolve(repo)) throw new Error('Use the canonical repository path.');
  return privateDirectory(join(await privateDirectory(join(repo, '.local')), 'beta'));
}

export async function readPrivateJSON(path) {
  const parent = await lstat(dirname(path));
  if (!parent.isDirectory() || parent.isSymbolicLink() || (parent.mode & 0o077) || parent.uid !== process.getuid?.())
    throw new Error('Unsafe beta state directory.');
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await file.stat();
    if (!info.isFile() || (info.mode & 0o077) || info.uid !== process.getuid?.() || info.size > 32_768)
      throw new Error('Unsafe beta state file.');
    return JSON.parse(await file.readFile('utf8'));
  } finally { await file.close(); }
}

export async function writePrivateJSON(path, value) {
  // This only replaces launcher metadata, never application files or credentials.
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) || info.uid !== process.getuid?.())
      throw new Error('Refusing to replace unsafe beta state.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = join(dirname(path), `.write-${randomUUID()}`);
  const file = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try {
    await file.writeFile(JSON.stringify(value, null, 2) + '\n');
    await file.sync();
  } finally { await file.close(); }
  try { await rename(temporary, path); } catch (error) { await unlink(temporary); throw error; }
}

export async function optionalState(path) {
  try { return await readPrivateJSON(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
