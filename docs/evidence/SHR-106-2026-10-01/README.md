# SHR-106 evidence — atePDF v1 Mac UI overhaul

Implements the owner-approved SHR-105 design system (`docs/design/`) across the v1 Mac surface.
Presentation only: the workspace hook, controller, planner, privacy gate, vault and engines keep
their behaviour (deliberate, listed exceptions in "Behaviour notes").

## Mac build and walkthrough (actual app)

- `scripts/native/mac-build.sh --synthetic-container`: arm64 Release Catalyst build, strict nested
  signature and sandbox-entitlement checks passed; launched from the staged path. The isolated
  `dev.atepdf.synthetic.mac` container was used for every interaction (it existed before launch and
  holds only synthetic data). Captures in [`mac/`](mac/) were taken from that window.
- Mac idiom confirmed visually (1:1 rendering, no 77% scale); light and dark (system and in-app
  override, which also switches the window chrome); window sizes 640 × 600–702, 1026 × 722 and
  1470 × 923 (Files panel docked ≥ 1120, overlay below).
- Exercised on the Mac: bundled sample import (real PDFKit thumbnails), Merge (chip), remove page 2
  (typed, Return to send), Undo (Restored tag, receipts stay with their result), Compress via the
  quality proposal, Make searchable (no scanned pages → honest note), Quick Look paging, save panel
  cancel ("Ready · save cancelled") and save ("Saved to your device"), invalid page error, Start
  Over sheet, Settings (General, Privacy & Storage), Files panel docked and overlay, ⋯ menu.
- Not established here: where my scripted path entry in the system save panel wrote the file (the
  receipt is the existing exporter's; exact-file save/reopen stays SHR-74); workspace restore across
  relaunch (the ad-hoc synthetic build reports its vault unavailable, shown truthfully in the banner;
  signed-Keychain acceptance stays SHR-40); signed, minimum-macOS, Intel and VoiceOver acceptance.

## Web evidence (bounded harness)

`tests/e2e/ui-states.spec.ts` reaches every listed state in light and dark through real local PDF
work or bounded synthetic planner/vault/worker harnesses, asserts it semantically, and writes
[`web/`](web/) captures: A empty · B–C imported · D request · E clarification · F quality
confirmation · G planning · H processing · I cancelling · J result · K saved · L Undo · M–N
refusal/error · O Privacy & Storage · P Delete Local Data · Q retention warning and expiry banner ·
Start Over · Quick Look · palette · onboarding · T 640 · U 1280 · V 1600.

<!-- TESTS -->

## Surfaces

| Surface (COMPONENT_INVENTORY) | Where | Notes |
|---|---|---|
| Tokens → theme (light + dark) | `src/ui/theme` | Generated from `atepdf-tokens.json`; `pnpm check:generated` fails when stale |
| Primitives A1–A16 | `src/ui/primitives.tsx`, `BrandMark.tsx`, `overlays.tsx` | Button (primary/secondary/plain/destructive/destructive-plain, busy), IconButton, Keycap, Tag, StatusPill, SegmentedControl, Meter, ActivityGlyph, Disclosure, Sheet, Popover, Menu, BrandMark, Section, Row, Card |
| B1 toolbar, B2 workspace context | `src/ui/shell.tsx` | No logo in the toolbar (DESIGN_SYSTEM 2.6) |
| B3 Files panel | `src/ui/shell.tsx` | Docks ≥ 1120 pt once files exist; overlay below; results (current first, stable "Result N") and sources in merge order; no internal IDs |
| B4 drop overlay | `src/platform/DropSurface.web.tsx` | Web; native Finder drop stays SHR-73 |
| B5 banners, B6 empty workspace | `src/ui/conversation.tsx` | Notice copy unchanged |
| C2–C12 conversation | `thread.aui.tsx`, `src/ui/conversation.tsx`, `thumbnails.tsx` | Request blocks, source groups with real PDFKit/PDF.js first-page thumbnails, activity row (real stages only), result card, proposal card, choice list, outcome icons |
| D1–D3 composer, chips, palette | `thread.aui.tsx`, `src/ui/shell.tsx`, `palette.tsx` | Chips and palette send a sentence through `submit()` (D-04) |
| E1 Quick Look | `src/ui/sheets.tsx`, `src/platform/Preview.*` | Existing renderers inside a sheet |
| E3 Start Over, E4 Settings, E5 onboarding shell, E8 shortcuts | `src/ui/sheets.tsx`, `src/components/PrivacyStorage.tsx` | Settings: General, Privacy & Storage (SHR-40 behaviour and wording), AI (incl. development connection), About |
| App icon, name, appearance, window | `ios/atepdf/**` | Folio Eight Ink icon set, `atePDF`, Automatic appearance, Mac idiom, 640 × 520 minimum |

## Legacy UI removed

`JobActivity` (sparkles), typing-indicator, shimmer/pulse helpers, template icon-button and Icon
helpers, `lib/utils`, the white/navy/blue `@theme`, pill quick-action footer, dashed welcome card and
paper illustration, raster 8 mark and wordmark assets, header logo/privacy badge/AI/Start-over
buttons, in-chat Start-over question, privacy modal, inline preview container, in-chat key entry and
pairing cards, user-turn bubbles, assistant Refresh/Edit/Branch controls, "Tell me what you'd like
to do next." card footer. `apps/web` (the separate legacy Next workspace) is untouched.

## Not built (no current behaviour to present)

ConsentSheet and privacy receipts (no v1 flow transfers content; SHR-37), SecureInputCard (no
unlock/protect tool yet), CollectionCard and TextResultCard (no split/extract tools), PaywallSheet,
allowance and Account & Pro pane (`COMMERCE_ENABLED = false`), Send Diagnostics.

## Behaviour notes (deliberate, UI-facing)

- **Quick actions are AI-routed (D-04, CONV-01).** Suggestion chips and palette actions send a
  sentence through `submit()`, exactly like typing it. With AI enabled they are planned; without it
  they follow the existing typed-request local fallback (unchanged here; outage policy is OPEN-09).
  The superseded e2e check that buttons bypass planning is replaced by a parity test.
- **Start Over** moved from an in-chat question to a confirmation sheet (X-16); the same clear
  transaction runs (`startOver()`, extracted from `confirm()`), so SHR-39/40/44 ownership holds.
- **Developer connection** moved from chat cards to Settings ▸ AI (X-15). The check is bound to the
  workspace session like every planner call and never writes to the conversation.
- **Display-only entry metadata** (never persisted): outcome kind (error, cancelled, refused,
  unavailable), clarification choices, "restored". Messages and their wording are unchanged.
- **Stopping** is shown only while Stop was requested and the local job is still running; the
  Cancelled message still comes from controller truth.
- **Thumbnails** are rendered locally on first view, one at a time, held in memory only (PDFKit
  output files are removed immediately) and dropped on Start Over, expiry and Delete Local Data.
- **Appearance and conversation text size** apply for the session; v1 has no approved preference
  store outside the workspace vault, so they are not persisted (follow-up for triage).
- **Onboarding** is available from ⋯ ▸ Introduction and Settings; automatic first-launch
  presentation and final copy are SHR-77. Pane 3 ("Start free") is omitted: commerce is disabled.
- **Empty state** says "Drop PDFs here" (not "PDFs or images"): image input is not implemented.
- **Mac Return** sends (native `submitBehavior`); multi-line text arrives by paste until SHR-75
  adds a Shift+Return path.

## Known limitations and triage notes

- Web startup budget passes with ~0.7 KB gzip headroom (sheets and palette are lazy chunks).
- Mac chrome is the hidden-title strip plus the in-content 52 pt toolbar (≈ 84 pt); a unified
  NSToolbar chrome and default/restored window size are SHR-75.
- Native export suggests a UUID file name rather than the result title (existing exporter; SHR-74).
- Segment and tab controls expose generic AX elements on Catalyst; VoiceOver acceptance is SHR-76.
- No Icon Composer `.icon` layered file (needs Icon Composer); the legacy AppIcon set is complete.
- Pre-existing failures on untouched main (`fd74961`), unchanged by this branch: S90-01 (host pnpm
  shim), three "local recovery after a free-form planner error" e2e cases and two ux-journey cases
  (compact submission; delayed-planning scroll whose mock passes the hosted wire to `quickPlan`).

## Deferred to downstream issues

- **SHR-73:** native Finder drop onto the window, source reorder/remove/multi-select (controls
  hidden until then).
- **SHR-74:** exact-file save/reopen, title-based default names, "Saved to {folder}", Show in
  Finder, drag-out.
- **SHR-75:** native menu bar and ⌘-shortcuts on Catalyst (⌘O/S/Z/K/./,), F6 regions, window size
  restore and default, unified toolbar, Shift+Return.
- **SHR-76:** keyboard-only and VoiceOver acceptance of the new structure.
- **SHR-77:** onboarding content, first-launch behaviour, assistant voice.
- **SHR-78:** runtime, cancellation and long-session measurement on the redesigned UI.
