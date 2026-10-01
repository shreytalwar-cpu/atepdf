# SHR-106 evidence — atePDF v1 Mac UI overhaul

Implements the owner-approved SHR-105 design system (`docs/design/`) across the v1 Mac surface.
Presentation only: the workspace hook, controller, planner, privacy gate, vault and engines keep
their behaviour (deliberate, listed exceptions in "Behaviour notes").

<!-- RESULTS -->

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
