# atePDF shared application — design

The visual and interaction design of this app is the owner-approved SHR-105 system in
[`docs/design/`](../../docs/design/README.md): [DESIGN_SYSTEM.md](../../docs/design/DESIGN_SYSTEM.md),
[UX_SPEC.md](../../docs/design/UX_SPEC.md), [COMPONENT_INVENTORY.md](../../docs/design/COMPONENT_INVENTORY.md),
[MIGRATION_MAP.md](../../docs/design/MIGRATION_MAP.md) and the [tokens](../../docs/design/tokens/atepdf-tokens.json).
SHR-106 implemented it; its evidence is in [`docs/evidence/SHR-106-2026-10-01/`](../../docs/evidence/SHR-106-2026-10-01/README.md).

The incumbent white/navy/blue visual record that used to live here (palette, 12–28 pt radii, pill quick
actions, paper illustration, raster 8 header) is superseded by that system (MIGRATION_MAP section 1) and
is kept only in git history. Behavioural contracts in [UX_STATE_CONTRACT.md](../../docs/UX_STATE_CONTRACT.md)
remain in force.

## Where the system lives in code

| Concern | Location |
|---|---|
| Tokens (generated from `docs/design/tokens/atepdf-tokens.json`; `pnpm design:tokens`, checked by `pnpm check:generated`) | `src/ui/theme/tokens.ts`, `src/ui/theme/theme.css` |
| Appearance, text size, type and elevation helpers | `src/ui/theme/index.ts` |
| Primitives (A1–A16): Txt, Glyph, Button, IconButton, Keycap, Tag, ActivityGlyph, Disclosure, SegmentedControl, Meter, Card, Row, Section | `src/ui/primitives.tsx`, `src/ui/BrandMark.tsx` |
| Sheets, popovers, menus, status pill | `src/ui/overlays.tsx` |
| Shell: toolbar, workspace context, composer context row, chips, hint row | `src/ui/shell.tsx`; actions palette `src/ui/palette.tsx` |
| First paint: empty workspace, banners, outcome icons; shared facts | `src/ui/empty.tsx`, `src/ui/facts.ts` |
| Conversation views (loaded after first paint): source group, file row, result card, proposal, choice list, activity row, progress bar, Files panel | `src/ui/conversation.tsx`, `src/ui/thumbnails.tsx` |
| Motion (Appear, one-shot moments, activity presence) and the activity model (labels, real progress, presence timing; unit tested) | `src/ui/motion.tsx`, `src/ui/progress.ts` |
| Sheets: Settings, Start Over, Quick Look, onboarding shell, shortcuts | `src/ui/sheets.tsx` (loaded on first use) |
| Thread scroll/follow logic and message roots (assistant-ui derived) | `src/components/assistant-ui/elements/thread.aui.tsx` |
| Workspace behaviour (the single source of truth) | `src/workspace/useWorkspace.ts` |

Rules: no hard-coded colours outside the generated tokens (the brand mark's and thumbnail fold's own colours excepted);
no animation library (React Native's Animated only; Reduce Motion becomes short fades); no invented progress;
suggestion chips and palette actions send a sentence through `submit()` like typed text (D-04);
only the user's request gets a filled block; one Iris action per region.
