# atepdf: fresh-start Codex handoff
**Version 7.0 | 28 September 2026 | Current entrypoint**

## The owner has changed the implementation decision
**Build atepdf in a NEW, SEPARATE repository. Attenlo PDF is a READ-ONLY REFERENCE, not the app to edit, rename, fork or clone wholesale.**

This explicitly supersedes v6 and earlier instructions to integrate into the existing Attenlo PDF application. Preserve that old project unchanged. Start new atepdf source, project history, dependency lockfiles and development configuration. Keep the approved product, branding, design, scope and commercial hypotheses.

## Open the right folder
1. Create a new `atepdf` project folder outside the old Attenlo PDF repository. It must not contain or be contained by the old checkout.
2. Extract this handoff beneath it, preferably as `handoff/atepdf/`. This handoff is a specification and reference-test pack, NOT the new app source.
3. Open the new `atepdf` project root in Codex. Paste [CODEX_PROMPT.txt](CODEX_PROMPT.txt).
4. Supply the old project's exact path or an owner-provided source snapshot as a read-only reference if available. Do not grant it workspace-write access. A missing reference blocks verified legacy conclusions, not the new app scaffold or synthetic-file workflow.

Recommended conceptual layout:
```text
<projects>/
  AttenloPDF/                 old project; read-only and unchanged
  atepdf/                    NEW Codex project and NEW Git root
    handoff/atepdf/           this pack's contents
    apps/web/                new application source, created by Codex
    apps/apple/              new native Apple implementation
    apps/android/            new native Android implementation
```
These are examples, not claims about your actual local paths. Do not scaffold over a nonempty unrelated directory. If the new atepdf build has already begun, resume it; a fresh-start decision never means deleting new work on the next session.

## First-session reading order
[START_HERE.md](START_HERE.md) -> [fresh-start/README.md](fresh-start/README.md) -> [brand/APPROVED_BRAND.md](brand/APPROVED_BRAND.md) -> [STACK_DECISION.md](STACK_DECISION.md) -> [DESIGN.md](DESIGN.md) -> [implementation/FIRST_BUILD_SEQUENCE.md](implementation/FIRST_BUILD_SEQUENCE.md).

**Selected stack:** new Next.js/React/TypeScript web app, shadcn/ui and Vercel AI SDK; selectively reuse the minimal shadcn Chatbot's appropriate components. assistant-ui stays fallback-only. New SwiftUI Apple targets; new Kotlin/Compose Android target. Share contracts and behaviour, not an old application skeleton.

**First result:** new app -> local import -> actual merge -> validated PDF -> preview/save -> follow-up page removal -> undo. Record useful old lessons as tests in the new app. No new naming, main-screen redesign, model download or marketing-tool installation round before that result.

## What remains approved
Public name **atepdf**, lowercase, with the gradient numeral **8** logo. The brand board is name/logo reference only: ignore its mock-ups. Keep the earlier approved friendly file-drop/chat workspace. Local document processing; cloud instruction interpretation. No editing, annotation, forms, signing, redaction or unsupported content-analysis promises.

Onboarding, paywalls, financial models, marketing plan, MCP/skills selection and spending safeguards remain. None is a live account or launch approval.

## Validation and navigation
Current check: `PYTHONDONTWRITEBYTECODE=1 python3 scripts/validate_v7_handoff.py` from the handoff root. Current inventory: [V7_FILE_MANIFEST.json](V7_FILE_MANIFEST.json). See [FINAL_VALIDATION_REPORT.md](FINAL_VALIDATION_REPORT.md).

Earlier version-specific manifests/reports and `HANDOFF_SUMMARY_V5.md` / `HANDOFF_SUMMARY_V6.md` are historical provenance, not active startup instructions. The current [decision register](DECISIONS_AND_PRECEDENCE.md), [fresh-build architecture](fresh-start/NEW_REPOSITORY_BLUEPRINT.md) and [learning protocol](fresh-start/LEGACY_LEARNING_PROTOCOL.md) control implementation.
