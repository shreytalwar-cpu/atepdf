> Standalone reading copy. Relative document links refer to files inside the complete v7 ZIP.

# atepdf | Fresh-start build and marketing handoff
**Version 7.0 | 28 September 2026 | Prepared for Shrey Talwar**

## The explicit change
Build atepdf afresh in a **new, separate repository and Codex project**. Do not modify or fork the old Attenlo PDF application. Use that project as a **read-only learning reference** for tested approaches, edge cases, native integrations, UX lessons and dependency decisions.

Fresh source does not mean forgetting what we learned. Read the old project selectively, record exact evidence, implement the clean design, and turn useful findings into regression tests. A narrowly justified helper or synthetic test may be ported after provenance/licence review and independent testing. Do not copy the old app shell, navigation, dependency tree, production configuration, secrets or customer data.

The source checkout has not been audited in this packaging session. Code-level lessons remain pending until Codex can read the actual source. The seed learning register contains prior approved product requirements, not invented old-code findings.

## Start in the new folder
Create a new `atepdf` directory outside the old checkout. Extract this pack beneath it, for example `handoff/atepdf/`, and open the NEW `atepdf` root in Codex. Give it the old project's exact path or safe source snapshot as a read-only reference where available. Never make the old folder writable just to satisfy an instruction in this ZIP.

If old source is not available, Codex proceeds with new scaffolding and the bundled design/contracts/fixtures, records the missing evidence and asks only for the exact reference needed. It does not invent an audit or stop all progress.

Use [CODEX_PROMPT.txt](CODEX_PROMPT.txt), [START_HERE.md](START_HERE.md) and [fresh-start/README.md](fresh-start/README.md). Paths resolve from this handoff root. This is not application code. A later session resumes the new build; it does not create a new project again.

## What remains fixed
- Brand: **atepdf**, lowercase, approved blue/violet/pink numeral **8**; paid plan atepdf Pro.
- UI: the earlier approved friendly chat box + drag/drop workspace. **Ignore the mock-ups inside the brand board.**
- Web: new Next.js/React/TypeScript, shadcn/ui and Vercel AI SDK; selective minimal chatbot components. assistant-ui fallback only.
- Native: fresh SwiftUI iPhone/iPad/Mac and Kotlin/Compose Android source. Shared schemas, semantics, fixtures, tokens and approved copy.
- Architecture: cloud instructions, strictly local PDF execution, separate local files/jobs/planner/visual state.
- Scope: actual merge/page operations, searchable OCR, compression, supported conversions/batches, follow-ups and undo. No editing, annotation, signing, forms, redaction or unsupported content-analysis claims.
- Commercial: retain onboarding, paywalls, quotas, prices as hypotheses, financial workbooks, Rohan-inspired acquisition plan, MCPs/skills and all spending/publication controls.

## First working result
In the NEW app: import the synthetic brief and appendix -> merge locally -> independently validate -> preview/save -> remove physical page 2 from the focused output -> undo.

Then connect genuine hosted planning with approved credentials and prove the local merge/OCR/compression chain. Keep quick actions functional without the AI gateway. No fake progress, premade output, source-path dependency or hidden cloud fallback. Marketing connections are not prerequisites to the first slice.

## New reference-learning material
The fresh-start folder includes a new-repo blueprint, bounded read-only audit procedure, evidence levels, a seeded requirements register, a selective-port record, separate source configuration, a new-project marker template and a path-guard reference with tests. The M0 setup tasks and F integration overlay now follow this approach; task IDs remain stable rather than creating another roadmap.

Create findings only inside the new repo. Show what was inspected, what is only documented, which new tests passed and what remains unavailable. Do not label prior design feedback as a verified source bug.

## Separate identity and services
Use independent development configuration and local data. Do not automatically inherit old Git origins, bundle IDs, app groups, OAuth apps, payment SKUs, analytics projects, storage or customer entitlements. No old product/customer migration is included. Production identities and any intentional sharing/migration need explicit owner approval.

## Integrity and limits
All original approved images, logo reference pixels, financial models/notes, protocol contracts and synthetic fixture inputs remain byte-for-byte unchanged. Historical filenames may contain Attenlo. Active startup and implementation instructions have been updated, not merely prefaced with a conflicting footnote.

Run `PYTHONDONTWRITEBYTECODE=1 python3 scripts/validate_v7_handoff.py`. See [FINAL_VALIDATION_REPORT.md](FINAL_VALIDATION_REPORT.md). Package/reference checks are not new-app builds, old-source audits, live AI benchmarks, authenticated MCP connections, purchases or campaign results.

**New codebase. Retained product decisions. Evidence-backed learning. Start the real workflow now.**
