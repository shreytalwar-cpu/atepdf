# atepdf: final branded Codex handoff
**Version 6.0 | 28 September 2026**

## What is now final
Public name: **atepdf**, all lowercase. Primary logo: the approved rounded gradient **8**. The user's supplied JPEG is bundled unchanged, alongside exact source-pixel crops of the main mark, wordmark and lockup.

The instruction to ignore the mock-ups is explicit throughout the new entrypoint, design rules and brand configuration. The earlier approved one-screen file-drop/chat interface remains the product specification. Its older A logo and Attenlo PDF label are replaced during implementation; the secondary paper illustration, local processing and cloud-instruction disclosure remain.

## What changed in v6
- Canonical brand configuration, asset provenance and brand-versus-UI precedence.
- Updated current product-facing documentation, copy, marketing context and starting prompt.
- A focused implementation checklist and ten not-yet-run application brand acceptance cases.
- Full source-preservation ledger and a new version-aware archive validator.

## What is retained
Original technical tasks, operation contracts, reference code/tests and synthetic inputs; approved UI pixels; shadcn/AI SDK stack decision and assistant-ui fallback; onboarding, paywall, entitlement and recovery work; Appllama research; Rohan-inspired acquisition strategy; marketing MCPs, skills, setup and approval controls; monetization and growth workbooks and their assumptions.

Protected financial files, contracts, fixture/test inputs and original UI references are retained byte-for-byte. Internal paths and identifiers can still say attenlo. This preserves provenance and compatibility; it is not a competing public brand.

## Asset limitation
The logo source is an approved raster board, not a vector master. The PNG crops retain their source background and resolution. No typeface was identified and no fonts are bundled. Prepare faithful production exports and inspect them before public release; do not call the current crops App Store-ready assets.

## Start
Extract into the actual app repository, for example `handoff/atepdf/`, without overwriting source. Read `00_READ_FIRST.md` and paste `CODEX_PROMPT.txt`. The first deliverable is a working local merge, preview/save, follow-up and undo, not another mock-up or marketing-tool setup round.

No new capabilities, prices, paid tools, domains, company details, accounts or publication permissions are implied by the rebrand. Existing contracts and store identifiers require deliberate migration if a change is needed.

Run `PYTHONDONTWRITEBYTECODE=1 python3 scripts/validate_v6_handoff.py` from the pack root. The report records archive/reference checks, not a built application, live payments, connected MCP accounts, campaigns or conversion results.
