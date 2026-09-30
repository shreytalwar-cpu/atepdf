# SHR-42 — bounded active references

Scope: SHR-42 only. Base: latest fetched `origin/main` at start,
`37e970025eaff9be35a2b8d5fa0291d9c7eef0a5`. Date: 30 September 2026.
The tested code/tests are fingerprinted in [source-files.sha256](source-files.sha256).
Historical audit files, workspace storage/schema, retention, billing, engines and UI layout are unchanged.

## Reproduction against current main

[boundaries.mts](boundaries.mts) commits two synthetic originals followed by retained
results into the actual `LocalFileStore`, then calls the actual `JobController.request`
and planner `validateRequest`. This is a metadata boundary reproduction, not proof of
hundreds of PDF transformations or Mac memory acceptance. No provider is called.

The same harness ran against archived, unmodified source from the base commit and
against this branch. [before.json](before.json) and [after.json](after.json) retain
complete accepted payloads plus exact refusal stages/messages.

| Retained artifacts | Base request behavior | SHR-42 request behavior |
|---|---|---|
| 40 (2 originals, 38 results) | All 40 projected; planner accepts | Current result only; accepts |
| 41 | All 41 projected; planner rejects `Unsupported context.` | Current result only; accepts |
| 100 | All 100 projected; planner rejects `Unsupported context.` | Current result only; accepts |
| 101 | Shared request construction rejects `Invalid instruction or local manifest.` | Current result only; accepts |
| 121 | Same shared construction rejection | Current result only; accepts |

The audit's two count failures still exist on current main. SHR-17 has since added
bounded clarification and SHR-39 durable recovery; neither removed the all-retained
request projection. Existing import admission is still at most 20 originals per
session. The reproduction grows results, rather than bypassing that import admission.

The request keys remain schemaVersion, requestId, workspaceRevision, locale,
instruction, files, selectionRefs, focusedResultRef, originalRefs,
pendingClarification, previousActionIds, capabilities, previousPlan and ocrLanguages.
Each file projects only ref/kind/pageCount/sizeBytes/encrypted. At 40 retained refs,
the recorded current-result payload shrinks from **4,826 to 532 bytes**. The same
532-byte shape remains accepted at 41, 100, 101 and 121 retained artifacts.

## Active and historical semantics

The durable local store remains authoritative. Imported originals, all committed
result artifacts (including an artifact retained after Undo), conversation cards and
committed history remain in the store/checkpoint. Projection never deletes or edits
those records or their bytes. Active context is a per-request view of the catalog.

`activeRequestContext` takes the current catalog, instruction and optional captured
clarification. It builds the union of the current focus, selected/requested inputs,
explicitly referenced artifacts and pending dependencies. It refuses an oversized
union before request construction or planner setup; it never truncates a list.

Rules:

- A current-result follow-up projects its focus alone. Before any result exists,
  originals remain the default candidates. Merge/original/file-group requests retain
  the relevant original selection; the existing explicit Merge action still uses all
  originals in import order.
- Explicit file/result numbers, ordered lists, known filename aliases and opaque refs
  promote those artifacts to the active set. Explicit references retain instruction
  order. Ambiguous earlier-result requests retain all result candidates, or refuse
  when that candidate set itself exceeds the envelope.
- Global file ordinals come from durable original import order. Result ordinals come
  from durable artifact creation order, **not** the current Undo stack or repeated
  conversation cards. Local resolution replaces supported ordinal references with
  stable opaque IDs before sending. `previous result` uses the committed Undo
  predecessor; `current result` uses current store focus. Unsupported numeric syntax,
  ranges, absent refs and unsupported compound ordinals refuse without partial
  selection. The provider is instructed never to renumber a projected subset.
- Clarification retains its captured selection/focus/original refs, bounded choices
  and prior answers. An answer uses those candidates. Import preserves the captured
  question until an answer/new task, but its revision change causes a stale answer to
  refuse before transport. Imports never silently retarget the question. Explicit
  global file/result answers must belong to the captured candidate set. New tasks,
  Cancel and Start over retain their existing clearing behavior.
- Undo operates on local committed history, independent of projection. A reverted
  artifact remains addressable by its creation number; a new result gets the next
  number. Restoration preserves catalog order and advances revision, so old plans
  cannot execute after relaunch.

The **40-reference planner envelope and 100-reference shared schema remain
unchanged**. Forty genuinely required active refs are admitted; 41 refuse with:

> This request needs more than 40 active file references. Choose fewer files or a specific earlier result. Your existing files and results are still available.

This is a technical context refusal, with no commercial entitlement change. Page,
operation, capability, semantic, ref/revision, staged execution and independent result
validation remain in place. The application still has its pre-existing local quick
routing; SHR-42 does not change the separate approved routing decision.

## Privacy and execution evidence

Positive projection still excludes filenames, paths, checksums, bytes, inspections,
OCR/extracted text, derived facts, notes and conversation/history. Local privacy
screening still checks the whole retained catalog for typed names and copied snippets
before reducing the outbound set. Removing unrelated refs also removes their page
counts, sizes and relationship metadata. Tests inspect the projected payload and
mocked gateway provider input. Plans referring to an unprojected historical artifact
fail complete-plan validation.

The real-PDF regression imports `brief.pdf`, creates a validated result, retains more
than 100 actual fixture-backed artifacts, performs removal, independently reopens the
output with PDF.js, checks A1 and original hashes, undoes, explicitly transforms the
early result, saves encrypted history, restores it with independent file inspection,
and verifies stable ordinals/current focus/Undo. The bulk retained copies are fixture
copies, not a claim of 103 successful transformations.

## Verification

- [focused.log](focused.log): 34/34 — 13 SHR-42 sequences plus 21 existing planner,
  clarification, privacy, gateway and provider regressions.
- [regressions.log](regressions.log): 139/139, zero skipped; includes conversation,
  Undo/history, persistence, protocol, real PDF and optional corpus generation tests.
- [typechecks.json](typechecks.json): web and universal app checks plus new tests and
  harness checks exit 0.
- [browser.log](browser.log): 18/18 planner/clarification browser results against the source
  built in this worktree; transport and provider responses are synthetic/mocked.
- [web-export.log](web-export.log): Expo web export. Existing dependencies were reused;
  Metro's watch roots were temporarily extended to read their symlink destination,
  then restored. No dependency or permanent build-configuration change is included.

The existing secret/clarification browser test expected a conversation element after
Start over removes it; its assertion now requires that element to be absent. No
secret check was weakened. A full run under simultaneous export load exposed an
unchanged checkpoint scheduling timer assertion; the final full suite ran serially
without build load and passed. A sandbox-only TLS bind refusal was rerun with allowed
loopback access. No native Mac application, signing, distribution or memory-pressure
acceptance is claimed by these Node/browser results. No live paid model calls ran.

Reproduce on this branch with existing dependencies:

```sh
node --import tsx docs/evidence/shr-42/boundaries.mts
node --import tsx --test tests/regressions/active-references.test.ts tests/regressions/planner.test.ts
ATEPDF_CORPUS_PYTHON=/path/to/existing/corpus/python node --import tsx --test --test-concurrency=1 tests/regressions/*.test.ts
```

For the before comparison, archive the base's core/contracts/planner source and TS
configuration, copy this harness to the same relative path, reuse existing dependencies
and run it there. This avoids switching or building an owner's active checkout.

## Handoff boundaries

SHR-43 can rely on projection being a non-destructive metadata view: dropping a ref
from a request does not delete its artifact or affect checkpoint/history/Undo. It
must preserve stable catalog order and refs when reclaiming buffers/caches. SHR-42
does not reclaim memory, change storage ownership or complete the parent SHR-19.

SHR-54 can rely on stable opaque identity, explicit ordered input refs, current-focus
binding, bounded clarification and refusal when the required union exceeds the
supported request envelope. It still needs its separately authorized collection
model, validation and ordered export; none is added or started here.
