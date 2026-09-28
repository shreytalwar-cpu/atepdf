import {readFile} from 'node:fs/promises';
import {resolve, sep, relative} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

// Check the actual export's initial scripts. Lazy PDF engines are outside this
// startup budget; their functional/resource checks remain separate.
const directory = resolve(process.argv[2] ?? 'apps/universal/dist-web');
const html = await readFile(resolve(directory, 'index.html'), 'utf8');
const urls = [...new Set([...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(match => match[1]))];
if (!urls.length) throw new Error('No initial application scripts found in the export.');
const scripts = [];
for (const url of urls) {
  if (/^(?:[a-z]+:)?\/\//i.test(url)) throw new Error('Unexpected remote application script.');
  const file = resolve(directory, decodeURIComponent(url.split(/[?#]/)[0]).replace(/^\//, ''));
  if (!file.startsWith(directory + sep)) throw new Error('Application script is outside the export.');
  const bytes = await readFile(file);
  scripts.push({path: relative(directory, file), bytes: bytes.length,
    gzipBytes: gzipSync(bytes, {level: 9}).length,
    sha256: createHash('sha256').update(bytes).digest('hex')});
}
const totals = scripts.reduce((total, script) => ({bytes: total.bytes + script.bytes, gzipBytes: total.gzipBytes + script.gzipBytes}), {bytes: 0, gzipBytes: 0});
const limits = {bytes: 2_500_000, gzipBytes: 500_000};
const passed = totals.bytes <= limits.bytes && totals.gzipBytes <= limits.gzipBytes;
console.log(JSON.stringify({passed, directory, limits, totals, scripts,
  note: 'Gzip is a computed artifact size, not a claim that the server sends compressed responses.'}, null, 2));
if (!passed) process.exitCode = 1;
