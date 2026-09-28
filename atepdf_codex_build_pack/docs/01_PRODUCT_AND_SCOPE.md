# 01 | Product, boundaries and success

## Product thesis
The user should describe a result, not operate a toolbox. atepdf removes the need to choose tools, decide ordering, reupload intermediate files and navigate settings. The selected visual language is deliberately friendly; operational screens must remain simple after the empty state disappears.

The primary advantage is interaction quality, not a claim to unique merge algorithms or the first AI PDF service. Local processing is a second meaningful property, but do not let privacy messaging overwhelm the task.

## Locked decisions
| Topic | Decision |
|---|---|
| Approved brand | atepdf (lowercase), with the approved blue/violet/pink numeral 8 logo; central config in brand/brand.json. |
| Targets | Browser, Android, iPhone, iPad and native Mac. |
| Windows/Linux | Supported browser use initially; no native desktop builds in this scope. |
| AI location | Inexpensive hosted planner. |
| Document location | Local browser/app processing only; user-chosen import/export providers remain under their control. |
| Main interface | Add/drop files, one instruction box, three shortcuts, in-place results. |
| Files | PDF and tested image types first. Do not display unsupported file types. |
| Account | No account required for basic local operations. Bounded guest AI access is a proposed default. |
| Model selection | No user-facing model picker. |
| Exclusions | Text/layout editing, annotations, highlights/drawing, forms, signing, redaction, stamps, watermarks, positioned headers/footers. |
| Existing work | Audit and reuse. Hide excluded UI without destroying unrelated working modules. |

## Core journeys
**Simple:** choose two PDFs, tap Merge, get a combined file. No AI is required.

**Conversational:** add PDFs, ask for merge + OCR + compression, receive one result with actual size and page count.

**Follow-up:** request removal of the final page from the current result, receive a new version, then undo.

**Batch:** compress each input separately; preserve one output per input; export the collection as ZIP.

**Uncertain:** request a target size that requires too much quality loss; show the best verified candidate and one meaningful choice.

**Unsupported:** request text editing or cloud-dependent analysis; explain the boundary in one sentence and preserve files.

## Scope by release gate
### Core public release
- Multi-file local import, preflight, thumbnails and read-only preview.
- Merge in explicit/displayed order; split; extract/delete/reorder/rotate/reverse pages.
- JPEG/PNG to PDF; PDF pages to JPEG/PNG; digital text to UTF-8 text.
- Genuine local compression with a target-size attempt, preservation policy and truthful unmet-target result.
- OCR for supported/tested languages, producing a real searchable PDF and/or local text output.
- Multi-step sequences, per-file batch operations, actual progress and cancellation.
- Current-result context, explicit originals, new versions and undo.
- Save/export/share; ZIP packaging; safe local renaming.
- Saved recipes built from validated plans, with fresh input binding and validation.
- Clear disclosure before the first cloud interpretation request, without forcing login.
- Working narrow quick actions even when cloud interpretation is unavailable.

Core public release is conditional on real compression and OCR on each advertised platform. Do not advertise four-platform parity until all four execution environments pass the same core tests. A labelled preview may have a narrower capability set.

### Additional local features, after the core is stable
- Known-password unlock and password protection through tested local encryption engines.
- Scoped document-information/XMP cleanup, not a promise of anonymisation.
- Page duplication, interleaving front/back scans and splitting by existing bookmarks.
- Blank-page candidates with review; never silently delete faint-content pages.
- Local file-name templates, folder batching where the OS/browser grants access.
- HEIC and additional image types only after decoder/licence/platform validation.
- Local text/table extraction and CSV with source-page references, only after quality testing.

These are in the backlog but must not displace the hero workflow or create an editor UI.

### Research only, not advertised in V1
PDF-to-editable-Word/PowerPoint, high-fidelity Office-to-PDF, general table-to-Excel conversion, semantic contract comparison, summaries, document Q&A, automatic invoice classification and semantic date sorting. Local processing remains required. No server conversion service may be quietly substituted. Content-aware cloud AI would require a separate future product/privacy decision, not an engineering workaround.

## Interaction-based success criteria
Proposed goals to test, not verified performance claims:
- At least 8 of 10 first-time usability participants complete the core merge task without coaching; improve towards 9 of 10 before wider launch.
- User can complete a simple known quick action with file selection plus one action tap, then save.
- A complete, unambiguous multi-step request does not trigger unnecessary clarification.
- First useful app interaction is available without loading every PDF/OCR engine.
- User never needs to reimport the current output for a follow-up.
- All successful file operations create verifiable outputs and leave originals unchanged.
- No file-content or password leakage in the privacy regression corpus.

## Explicit non-goals
No six-app atepdf suite build, bill payments, enterprise document repository, cloud drive, collaboration, vector database, general autonomous agent, model training, chatbot personality project or local-LLM distribution system. Do not turn one useful utility into a platform before it works.
