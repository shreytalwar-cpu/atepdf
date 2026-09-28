// Read-only, independent PDF.js verification of an actual native Files export.
// Run after the UI save/relaunch/reopen check, passing that exact saved copy.
// This script alone does not establish where or how a PDF was saved.
import assert from 'node:assert/strict';
import {readFile, realpath, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

assert.ok(process.argv[2], 'Usage: node tests/native/ios/verify-saved-export.mjs SAVED_PDF [EVIDENCE_JSON]');
const savedPath = await realpath(process.argv[2]);
const bytes = await readFile(savedPath);
async function inspect(data) {
  const task = getDocument({data: Uint8Array.from(data), verbosity: 0, useSystemFonts: true});
  try {
    const document = await task.promise;
    const pages = [];
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index);
      const text = await page.getTextContent();
      pages.push({
        text: text.items.map(item => 'str' in item ? item.str : '').join(' ').replace(/\s+/g, ' ').trim(),
        view: page.view,
        rotation: page.rotate,
      });
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

const fixtures = fileURLToPath(new URL('../../fixtures/', import.meta.url));
const expected = [
  ...await inspect(await readFile(resolve(fixtures, 'brief.pdf'))),
  ...await inspect(await readFile(resolve(fixtures, 'appendix.pdf'))),
];
const actual = await inspect(bytes);
assert.equal(actual.length, 3);
assert.deepEqual(actual, expected, 'Saved pages must match original synthetic text, order and geometry');
for (const [index, marker] of ['A1', 'A2', 'B1'].entries()) {
  assert.match(actual[index].text, new RegExp(`\\b${marker}\\b`));
}
const evidence = {
  recordedAt: new Date().toISOString(),
  reader: 'PDF.js',
  input: savedPath,
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  pageCount: actual.length,
  pageMarkers: ['A1', 'A2', 'B1'],
  originalTextOrderAndGeometryMatch: true,
  syntheticOnly: true,
  scope: 'Independent read-only inspection; pair with the separate actual Files UI save/relaunch/reopen evidence.',
};
if (process.argv[3]) await writeFile(process.argv[3], `${JSON.stringify(evidence, null, 2)}\n`, {flag: 'wx'});
console.log(JSON.stringify(evidence, null, 2));
