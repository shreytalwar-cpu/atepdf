// Run only while the synthetic native gateway has no other planner clients.
// Uses counter deltas; never resets evidence or reads owner credentials.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {writeFile} from 'node:fs/promises';

const base = 'http://localhost:3212';
const evidence = async () => {
  const response = await fetch(`${base}/test/evidence`, {signal: AbortSignal.timeout(3000)});
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.provider, 'synthetic-only', 'Refuse any non-synthetic provider');
  assert.ok(Number.isInteger(data.calls) && Number.isInteger(data.cancelled));
  return data;
};
// Validate the synthetic marker before asking for the local gateway token.
const before = await evidence();
const status = await fetch(`${base}/api/planner/status`, {signal: AbortSignal.timeout(3000)});
assert.equal(status.status, 200);
const {token} = await status.json();
assert.equal(typeof token, 'string');
const refs = ['file_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'file_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'];
const request = instruction => ({
  schemaVersion: '1.0', requestId: `req_${randomUUID().replaceAll('-', '')}`,
  workspaceRevision: 2, locale: 'en-IN', instruction,
  files: refs.map((ref, index) => ({ref, kind: 'pdf', pageCount: 2 - index, sizeBytes: 3000 - index * 1000, encrypted: false})),
  selectionRefs: refs, focusedResultRef: null, originalRefs: refs, pendingClarification: null,
  previousActionIds: [], previousPlan: null,
  capabilities: ['merge_pdf', 'select_pages', 'ocr_pdf', 'compress_pdf'], ocrLanguages: ['eng'],
});
const send = (instruction, signal = AbortSignal.timeout(15000)) => fetch(`${base}/api/planner`, {
  method: 'POST', headers: {'content-type': 'application/json', origin: base, 'x-atepdf-token': token},
  body: JSON.stringify(request(instruction)), signal,
});
const started = Date.now();
const result = await send('Wait for cancellation');
assert.equal(result.status, 200);
await result.json();
const completed = await evidence();
assert.equal(completed.calls, before.calls + 1, 'Run without simultaneous planner clients');
assert.equal(completed.cancelled, before.cancelled);
// The completed 10-second response must not count the later 30-second gateway deadline.
await delay(Math.max(0, 31500 - (Date.now() - started)));
const afterDeadline = await evidence();
assert.equal(afterDeadline.calls, before.calls + 1);
assert.equal(afterDeadline.cancelled, before.cancelled, 'Settled success cannot later count as cancellation');

const abort = new AbortController();
const pending = send('Wait for interruption', AbortSignal.any([abort.signal, AbortSignal.timeout(5000)]))
  .catch(error => {assert.equal(error.name, 'AbortError'); return null;});
await delay(250);
abort.abort();
await pending;
let afterAbort = await evidence();
for (let attempt = 0; attempt < 20 && afterAbort.cancelled === before.cancelled; attempt++) {
  await delay(100);
  afterAbort = await evidence();
}
assert.equal(afterAbort.calls, before.calls + 2);
assert.equal(afterAbort.cancelled, before.cancelled + 1, 'Pending request cancellation is counted exactly once');
const proof = {
  recordedAt: new Date().toISOString(), syntheticOnly: true, paidCalls: 0,
  before, completed, afterDeadline, afterAbort, elapsedMilliseconds: Date.now() - started,
  checks: ['Completed 10-second response is HTTP 200', 'No cancellation after the 30-second deadline', 'Pending 25-second request abort is counted exactly once'],
};
if (process.argv[2]) await writeFile(process.argv[2], `${JSON.stringify(proof, null, 2)}\n`);
console.log(JSON.stringify(proof, null, 2));
