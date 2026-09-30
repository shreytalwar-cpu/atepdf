# atePDF v1 design system

**Issue:** SHR-105 · **Status:** approved by the owner on 30 September 2026 (OD-1 to OD-7, [section 18](#18-owner-decisions)); authoritative once PR #91 merges · **Implements in:** SHR-106
**Companion files:** [UX_SPEC.md](UX_SPEC.md) · [COMPONENT_INVENTORY.md](COMPONENT_INVENTORY.md) · [MIGRATION_MAP.md](MIGRATION_MAP.md) · [tokens](tokens/atepdf-tokens.json) · [mockups](mockups/index.html) · [brand assets](brand/)

This document defines how atePDF looks, moves and sounds. It changes presentation only. The product model in [PRODUCT_V1.md](../PRODUCT_V1.md) stays the same: Mac-first, conversation-first, AI-orchestrated intent (including quick actions), deterministic local PDF engines, local-first understanding, explicit consent for any content transfer, and passwords kept out of chat. If this document appears to conflict with PRODUCT_V1.md, PRODUCT_V1.md wins and the conflict is a design bug.

The benchmark is **Raycast-level speed and polish for an AI-first PDF workspace**. Raycast sets the bar for density, keyboard speed, restraint and settings quality. Apple's macOS HIG supplies the platform grammar. atePDF differs from both in one respect: documents, not commands, are the objects on screen, so files and results get richer treatment than a launcher row.

---

## 1. Principles

1. **The conversation is the workspace. The file is the output.** Every surface serves one loop: add files, say what you want, get a verified file. Nothing competes with the thread and the composer.
2. **Documents are first-class objects.** Real page thumbnails, real names, real facts. A PDF never appears as a generic icon when its first page can be shown.
3. **Quiet chrome, loud content.** Neutral surfaces with hairline borders. Colour is reserved for the one next action (Iris), privacy state (Local teal, Outbound amber) and outcome (success, warning, danger).
4. **Keyboard first, pointer complete.** Every action has a focus path and most have a shortcut. Nothing requires a mouse, and nothing requires the keyboard.
5. **Receipts, not theatre.** Progress shows real stages. Results show measured facts. "Saved" appears only after the write succeeds. No fake percentages, no "thinking" animations, no sparkles.
6. **Privacy is visible, not legal.** Where content goes is shown as a state (On this Mac / Leaves this Mac), not as paragraphs.
7. **Compact, not cramped.** Mac-native density (13 pt UI, 28 pt controls). Conversation text is a step larger (14 pt) for reading comfort.

---

## 2. Brand

### 2.1 Personality

Precise, calm, quick and trustworthy. atePDF is the colleague who does the tedious PDF step correctly and tells you exactly what it did. It is not playful, magical or loud. The name's pun (*ate* = 8) is its one moment of wit, and the mark carries it.

### 2.2 Name and wordmark

- **Name in prose:** `atePDF`. PRODUCT_V1.md, current runtime copy (`atePDF couldn't save…`) and the latest owner instructions all use this spelling. It **supersedes** the lowercase `atepdf` in `atepdf_codex_build_pack/brand/APPROVED_BRAND.md` (**OD-2, approved**).
- **Wordmark:** `ate` in Semibold, `PDF` in Semibold at the same size and baseline, coloured `text.secondary`. Tracking −1%. The contrast between the two halves reads "ate · PDF" without a separator.
- **Paid plan:** `atePDF Pro`. "Pro" is set in the same weight, never as a badge inside the wordmark.
- **Lockup:** mark + 8 pt gap + wordmark, with the wordmark cap height equal to 42% of the mark height.
- **Wordmark type:** SF Pro inside the app, where system text is permitted. For marketing and store assets, SHR-106 (or a follow-up asset task) must convert the wordmark to outlines from a font whose licence allows logo use (candidates: Inter or Geist, both OFL). Do not ship SF Pro outlines as a logo.

### 2.3 Directions explored

Three original directions were explored. All keep the equity of the 8 (ate), which PRODUCT_V1.md MAC-04 and the approved brand treat as the identity, and all replace the current raster gradient 8. SVG masters are in [`brand/`](brand/). The mockup page shows them side by side at 16–512 pt ([mockups/index.html#brand](mockups/index.html#brand)).

| | A · Folio Eight (**approved**) | B · Speaking Page | C · Continuity Eight |
|---|---|---|---|
| Idea | An upright 8 built from two stacked sheets. The upper sheet is narrower, and its top-right corner is folded. | A page with a folded corner. Its lower-left corner becomes a speech tail, and two stacked counters form the 8. | A heavy monoline 8 whose upper bowl stays open, followed by a caret dot. |
| Reads as | "8", then "pages" | "a document you talk to" | "8", then "flow / continuing" |
| Strengths | Keeps the 8 silhouette and unequal bowls from the approved mark. The document cue is one fold, not a PDF cliché. Geometric, so it survives 16 px. Matches a precise, Raycast-grade icon style. | Most literal statement of conversation + document. Very distinctive shape. | Friendliest, and closest to the current rounded 8. |
| Risks | Two stacked rectangles read as "8" only if the counters stay generous. The rules in 2.4 protect this. | The speech bubble drifts toward "generic AI chat app". The 8 is secondary and weak at 16 px. | Least document-specific. The open stroke looks unfinished at small sizes. It resembles common "loop" marks. |
| Files | `mark-a-folio-eight.svg`, `icon-a-folio-eight-ink.svg`, `icon-a-folio-eight-paper.svg` | `mark-b-speaking-page.svg`, `icon-b-speaking-page.svg` | `mark-c-continuity-eight.svg`, `icon-c-continuity-eight.svg` |

**Approved: A · Folio Eight (OD-1).** It keeps the one piece of brand equity that works (8 = ate) and adds exactly one document cue. It is ownable and precise, and it holds up at menu-bar and Dock sizes. B and C are retained in `brand/` as the explored alternatives only; they must not be used in the product.

### 2.4 Mark construction (direction A)

- 100-unit grid. Upper sheet `27,8 → 73,52`, radius 13. Lower sheet `21,44 → 79,92`, radius 16. The sheets overlap by 8 units, which forms the waist.
- Counters: upper `40,21 → 60,38` radius 6.5, lower `37,57 → 63,79` radius 8. Counters never shrink below these proportions at any size.
- Fold: a 45° cut on the line `x − y = 54`, with the flap as a triangle `61.5,8.5 / 72.5,19.5 / 61.5,19.5` in `brand.fold` (or a 40% tint of the mark colour when monochrome).
- **Clear space:** 25% of the mark height on all sides.
- **Minimum size:** 16 px (favicon, menu). Below 24 px, drop the fold flap tint and keep the cut.
- **Colour:** one colour. `brand.iris` on light, `brand.irisLight` on dark, or `text.primary` monochrome in UI chrome. A two-stop vertical Iris gradient (`brand.irisLight → accent.fill` dark value) is allowed **only on the app icon and marketing hero**, never in the UI.
- **Don't:** rotate it, outline it, add shadows or glows, place it on busy imagery, recolour it outside the tokens, animate the silhouette, or combine it with the old gradient 8 or with the Attenlo A.

### 2.5 App icon

- Canvas 1024 × 1024 with the macOS 824-pt body and a continuous-corner radius of about 185. Built in **Icon Composer** as layers: background (Ink gradient `brand.inkTop → brand.ink`), mark (Iris gradient), fold (flat `brand.fold`). The layers let the system render the Default, Dark, Clear and Tinted icon appearances without a separate drawing for each.
- Default appearance: **Ink** (`icon-a-folio-eight-ink.svg`). Dark icons read as premium, precise tools on a Mac Dock, and they separate atePDF from the red, white and blue PDF-app norm. **Paper** (`icon-a-folio-eight-paper.svg`) is the reference for the light and tinted appearances and for web/marketing on dark backgrounds.
- Required exports for SHR-106: `.icon` (Icon Composer) plus the legacy AppIcon set 16/32/64/128/256/512/1024 @1x/@2x for Catalyst, and favicon.svg for the web host. Review every size at 1×.

### 2.6 Brand in the product

The brand appears in exactly four places: the app icon, the onboarding first pane, the About pane, and the empty-state mark (monochrome, `text.tertiary`, 32 pt). The toolbar carries **no** logo, because the window title and Dock icon already identify the app. That restraint is part of the Raycast-grade feel.

---

## 3. Colour

### 3.1 Roles

| Role | Tokens | Used for | Never for |
|---|---|---|---|
| Window and structure | `bg.window`, `bg.sunken`, `bg.panel` | Window background, preview well, Files panel | Buttons |
| Surfaces | `surface.raised`, `surface.elevated`, `surface.request` | Cards, composer, sheets and popovers; user request blocks | Text |
| Interaction overlays | `surface.hover`, `surface.pressed`, `surface.selected` | Row and button states; selected rows and items | Static fills |
| Lines | `border.hairline`, `border.strong` | Card and field outlines, separators; field outline on hover and drop target | Emphasis |
| Text | `text.primary`, `text.secondary`, `text.tertiary`, `text.disabled`, `text.onAccent` | Content, facts, hints and keycaps; disabled labels; text on Iris | — |
| **Iris accent** | `accent.fill`, `accent.fillHover`, `accent.fillPressed`, `accent.text`, `accent.subtle`, `accent.subtleBorder` | The single primary action in view, focus ring, links, selection, "Current" tag | Decoration, backgrounds of large areas |
| Status | `status.success.*`, `status.warning.*`, `status.danger.*` | Verified check; quality caveat and allowance low; errors and refusal. `status.danger.fill` is the only fill for destructive buttons (white text passes in both appearances). | Brand accents |
| Privacy | `status.local.*`, `status.outbound.*` | "On this Mac" state; "Leaves this Mac" consent, receipts and hosted-AI waiting | Anything else |
| Document | `page.paper` | PDF thumbnails and preview pages, in both appearances (documents are never inverted) | UI surfaces |
| Overlays | `scrim`, `dropzone.fill` | Sheet backdrop; drag-over tint | — |
| Brand | `brand.*` | App icon, onboarding mark, About, marketing | UI controls |

**One Iris per view.** At most one `accent.fill` button is visible in any region. When a result card is current, its Save is the Iris button, and the composer's Send is Iris only while it holds text.

**Why Iris.** It carries forward the blue-violet of the approved 8. It is clearly different from Raycast's coral, Adobe's red and the generic blue of system accents, and it reads as calm and technical rather than urgent.

### 3.2 Values

Full values for both appearances are in [`tokens/atepdf-tokens.json`](tokens/atepdf-tokens.json) and mirrored in [`atepdf-tokens.css`](tokens/atepdf-tokens.css). Key values:

| Token | Light | Dark |
|---|---|---|
| `bg.window` | `#F7F7F8` | `#141417` |
| `surface.raised` | `#FFFFFF` | `#1C1C21` |
| `surface.elevated` | `#FFFFFF` | `#24242A` |
| `text.primary` | `#17171C` | `#EDEDF2` |
| `text.secondary` | `#5E5E6B` | `#A2A2B0` |
| `text.tertiary` | `#6B6B77` | `#8A8A96` |
| `accent.fill` | `#5646F0` | `#6354FF` |
| `accent.text` | `#5646F0` | `#8C80FF` |
| `status.local.fg` | `#0B7285` | `#45C4D6` |
| `status.outbound.fg` | `#8F5500` | `#F0B24A` |
| `status.success.fg` | `#18794E` | `#3DCB85` |
| `status.danger.fg` | `#C8283F` | `#FF6F80` |

### 3.3 Rules

- Text on a status or privacy background uses the matching `.fg` token (every pair is validated in section 16).
- Hairline borders are translucent so they adapt to any surface. Fields use `border.strong` so their boundary is visible without focus.
- `text.disabled` is only for disabled controls, which are exempt from contrast requirements. Never use it for information.
- Colour is never the only signal. Every status also has an icon and a word (for example "Verified", "Leaves this Mac", "Couldn't finish").

---

## 4. Typography

The system font only: SF Pro Text and Display (chosen automatically by size), with SF Mono for technical identifiers in About and Diagnostics. Use `tabular-nums` for every number that can change: sizes, page counts, allowance, times.

| Token | Size / line | Weight | Used for |
|---|---|---|---|
| `display` | 26 / 32 | 600, −0.4 | Onboarding and paywall titles only |
| `title1` | 20 / 26 | 600, −0.2 | Sheet titles, empty-state headline |
| `title2` | 15 / 20 | 600 | Settings pane titles, preview title |
| `headline` | 13 / 18 | 600 | Result and file titles, proposal titles |
| `body` | 14 / 21 | 400 | Assistant messages, composer text |
| `bodyStrong` | 14 / 21 | 500 | User requests |
| `ui` | 13 / 18 | 400 | Rows, settings labels, menus |
| `uiStrong` | 13 / 18 | 500 | Button labels, selected rows |
| `meta` | 12 / 16 | 400 | Facts (pages · size), receipts, hints |
| `section` | 12 / 16 | 600 | Section labels in panels, palette and settings |
| `caption` | 11 / 14 | 500, +0.1 | Tags (Current, Earlier, Locked), badges |
| `kbd` | 11 / 14 | 500 | Keycaps |

- Sentence case everywhere. No all-caps labels. No title case except for macOS menu commands, which follow Apple convention (for example "Add Files…", "Save Result…").
- At most two weights per component (regular + semibold, or medium).
- **Dynamic sizing.** The conversation (`body`, `bodyStrong`) scales with the Settings ▸ General ▸ Text size control (Small 13 / Default 14 / Large 16 / Larger 18) and with system text size where the platform supplies it. Chrome stays at `ui` sizes. At Large and above, result-card actions wrap under the facts (see COMPONENT_INVENTORY: ResultCard).

---

## 5. Spacing and layout

**Base unit 4 pt.** Scale: 0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64 (`space.*`).

| Relationship | Space |
|---|---|
| Icon to label | 6 |
| Inside a control (horizontal) | 10 (md), 12 (lg) |
| Inside cards | 12 vertical, 14 horizontal (compact 12) |
| Between items in a group (file rows, choices) | 2 (rows touch; hover shows the boundary) |
| Message to its attached artifact | 8 |
| Between turns in a task | 16 |
| Between tasks | 28 (24 + 4 hairline divider space) |
| Section padding in sheets and settings | 20 |
| Window gutters | 24 (compact: 16) |

**Window layout (default 1024 × 720; minimum 640 × 520).**

```
┌───────────────────────────── toolbar 52 ─────────────────────────────┐
│ ● ● ●   Workspace context ▾               On this Mac   ◫   ⋯      │
├──────────────────────────────────────────────┬───────────────────────┤
│                                              │ Files panel 280       │
│          conversation column ≤ 720           │ (240–360, toggle ⌥⌘I) │
│                                              │                       │
│  ┌──── composer (docked, ≤ 720) ─────────┐   │                       │
│  └───────────────────────────────────────┘   │                       │
└──────────────────────────────────────────────┴───────────────────────┘
```

- The conversation column is centred in the space left of the panel, with a maximum width of 720 and gutters of 24.
- **Files panel** (right-hand inspector) shows automatically when the window is ≥ 1120 pt wide and the workspace has files, unless the user has hidden it. The user's choice persists. Below 1120 it opens as an overlay panel over the conversation (`elevation.3`) and closes on Esc or on click-away.
- **Compact** (< 760 pt): 16 pt gutters, the toolbar privacy pill collapses to its icon, suggestion chips reduce to the first two plus "⌘K".
- There is no left sidebar. v1 has one workspace (STATE-01), so a navigation sidebar would be empty chrome.

---

## 6. Radii

| Token | Value | Used for |
|---|---|---|
| `thumb` | 3 | Page thumbnails (paper corners stay nearly square) |
| `xs` | 4 | Keycaps, tags, inline badges |
| `sm` | 6 | Buttons, text fields, segmented controls, chips |
| `md` | 8 | List rows, file rows, menu items, request blocks, choices |
| `lg` | 10 | Cards (result, proposal, secure input, file group) |
| `xl` | 12 | Composer, popovers, palette, drop overlay |
| `2xl` | 16 | Sheets (consent, settings, onboarding, paywall, preview) |
| `full` | 999 | Status pills, the toggle knob, the allowance meter |

Nested radii follow *outer − padding*. There are no pill-shaped buttons: only status pills are fully rounded. This deliberately departs from the incumbent 12–28 pt radii.

---

## 7. Elevation and materials

| Level | Light | Dark | Used for |
|---|---|---|---|
| 0 | none | none | Everything flat on `bg.window` (messages, requests, panel) |
| 1 | `0 1 2 rgba(16,16,32,.05)` + hairline | hairline only | Cards |
| 2 | two-layer soft shadow + hairline | `0 8 24 rgba(0,0,0,.4)` + hairline | Composer, popovers, palette |
| 3 | `0 24 64 rgba(16,16,32,.22)` | `0 24 64 rgba(0,0,0,.6)` | Sheets, overlay Files panel, Quick Look preview |
| page | ring + 1–3 pt shadow | ring + shadow | Page thumbnails and preview pages |

**Materials.** Only the toolbar may use translucency (`bg.window` at 85% with a 20 pt backdrop blur) where the platform supports it. Everywhere else is solid. No glass cards, no gradient surfaces. In dark mode, depth comes from surface lightness steps (window 141417 → raised 1C1C21 → elevated 24242A) more than from shadow.

---

## 8. Borders and separators

- Cards: 1 pt `border.hairline`. Fields: 1 pt `border.strong`, which becomes the focus ring when focused.
- Separators: 1 pt `border.hairline`, inset to the content edge (not full-bleed) in lists. Full-bleed only under the toolbar and beside the Files panel.
- Between tasks in the conversation: no line. Whitespace (28) separates tasks, and the request block marks where each begins.
- The drop overlay is the only dashed border: 1.5 pt dashed `accent.fill` at 12 pt radius.

---

## 9. Focus

- Keyboard focus ring: 2 pt `accent.fill`, 2 pt offset, radius = element radius + 2. Shown only for keyboard focus (`:focus-visible`, or the native equivalent), never on click.
- The composer shows focus by changing its border to `accent.subtleBorder` plus the ring at 40% opacity, because it is focused most of the time and a full ring would be noisy.
- Lists (palette, choices, Files panel, collections) use **row focus**: `surface.selected` background plus the ring on the focused row only. Arrow keys move focus; Return activates.
- Focus order per window: toolbar → conversation (newest-first landmarks) → composer → Files panel. F6 / ⌃F6 cycle between these regions.

---

## 10. Motion

### 10.1 Tokens

| Token | Value | Used for |
|---|---|---|
| `duration.fast` | 120 ms | Hover/press colour, tag changes, chip appear |
| `duration.base` | 180 ms | Disclosure expand/collapse, new message/card enter (opacity + 4 pt rise) |
| `duration.slow` | 240 ms | Files panel show/hide, palette open |
| `duration.sheet` | 280 ms | Sheet present (scale 0.98 → 1 + fade), dismiss 180 ms |
| `duration.activityCycle` | 1200 ms | Activity glyph loop |
| `easing.standard` | `cubic-bezier(0.2,0,0,1)` | Default |
| `easing.enter` / `easing.exit` | `(0,0,0,1)` / `(0.3,0,1,1)` | Present / dismiss |

### 10.2 Rules

- Motion confirms a change of state. It never implies work that isn't happening.
- No bouncing, no parallax, no animated gradients, no typing dots.
- Auto-scroll to a new result uses 180 ms, or jumps when Reduce Motion is on.
- **Reduce Motion:** every movement becomes an opacity change of at most 120 ms; the activity glyph is static; scrolling jumps.

### 10.3 Activity glyph

A 14 pt glyph made from the mark's two counters as two small rounded squares stacked vertically. The top and bottom alternate between 100% and 35% opacity over 1200 ms. It appears only while real work is running (planning, waiting on the AI, local processing, verification). It is derived from the brand, so it replaces generic spinners and typing dots everywhere. With Reduce Motion it is static at full opacity, and the stage label carries the meaning.

---

## 11. Iconography

The app keeps **Lucide** (`lucide-react-native`, already a dependency) and restricts it to one style: 16 pt default, 1.75 stroke, round joins, coloured with `text.secondary` (or with the status or accent colour when semantic). Sizes are 14 (inline in meta), 16 (controls) and 20 (empty states and sheet headers). No filled icons, no duotone, no emoji.

| Meaning | Lucide name | Notes |
|---|---|---|
| Add files | `plus` | Composer, empty state |
| PDF file (fallback when no thumbnail) | `file-text` | |
| Image file | `image` | |
| Collection | `files` | Split, PDF → images |
| Text result | `text` | Extract text |
| Save | `arrow-down-to-line` | |
| Save all | `folder-down` | |
| Quick Look / Preview | `eye` | |
| Undo | `undo-2` | |
| Send | `arrow-up` | Inside a 28 pt Iris square, radius 6 |
| Stop | `square` | Filled 8 pt square glyph inside the button |
| Verified | `check` | `status.success.fg` |
| Warning / quality caveat | `triangle-alert` | |
| Error / refused | `circle-x` / `ban` | `ban` = safe refusal (unchanged file) |
| Locked PDF | `lock-keyhole` | |
| Password field | `key-round` | |
| On this Mac | `laptop-minimal` + `lock` composite, or `shield-check` fallback | `status.local.fg` |
| Leaves this Mac | `arrow-up-right` | `status.outbound.fg` |
| Hosted AI | `cloud` | Only in privacy explanations, never as decoration |
| Files panel toggle | `panel-right` | |
| More | `ellipsis` | |
| Settings | `settings-2` | Menu only |
| Drag handle | `grip-vertical` | Visible on row hover and focus only |
| Remove from list | `x` | |
| Help | `circle-help` | |

Banned: `sparkles`, `wand`, `bot` and any "AI magic" iconography (principle 5). The incumbent `JobActivity` uses `sparkles` for planning; that is replaced by the activity glyph.

---

## 12. Light and dark

- Both appearances are fully specified. The app follows the system setting by default; Settings ▸ General ▸ Appearance offers System / Light / Dark.
- **Dark mode ships at launch (OD-3, approved).** This is the owner approval that PRODUCT_V1.md MAC-04 requires to make dark mode part of v1. Both appearances are therefore in scope for SHR-106 and for Mac acceptance.
- Documents keep their own colours in both appearances: `page.paper` is always white, and previews are never colour-inverted.
- In dark mode, cards lose their shadow and rely on the hairline plus a lighter surface. Iris lightens (`accent.text` #8C80FF) for text, while fills use #6354FF so white text passes contrast.

---

## 13. Voice and content formatting

Voice follows PRODUCT_V1.md UX-02 and D-16: brief, specific, warm, factual. The design system adds formatting rules:

- **Facts line:** `12 pages · 3.4 MB` uses a middle dot with spaces, tabular numbers, decimal MB above 1 MB, kB below, and no "~". A size change is shown as `8.2 MB → 3.7 MB`.
- **File names** use `headline` in cards and middle truncation (`Quarterly-rep…final.pdf`), always with the full name in the tooltip and accessibility label.
- **Status words:** Verified · Saved · Current · Earlier · Locked · Unsupported · Couldn't finish · Cancelled. Use these exact words everywhere (tags, announcements, receipts).
- **Buttons** are verbs that describe the outcome: "Save", "Save All…", "Create Copy", "Send 3 Pages", "Don't Send", "Keep Current Result". Never use "OK", "Yes" or "Submit". Use an ellipsis when a further choice follows (a save panel or a sheet).
- The assistant never says "successfully", "magic", "AI-powered" or "I think" about outcomes it can measure.

---

## 14. Platform implementation notes (for SHR-106)

1. **Units and the Catalyst idiom.** Tokens are rendered macOS points. The current build runs Mac Catalyst with the **iPad idiom**, which scales the whole UI to 77%. Until the app adopts the Mac idiom (`UIUserInterfaceIdiomMac`, "Optimize for Mac"), React Native style values must be `token / 0.77`, rounded to the nearest 0.5. SHR-106 should put this factor in exactly one place (`theme.scale`). **Moving to the Mac idiom is approved (OD-6)**, subject to engineering confirmation in SHR-106 (or SHR-75 if it needs native window work). If a blocker is found, keep `theme.scale` and report the blocker rather than silently staying on the iPad idiom.
2. **Hit targets.** Pointer minimum 24 pt, default control height 28. On touch idioms (iPhone/iPad builds, which remain preserved but are not v1 launch surfaces) every control expands its hit area to 44 via `hitSlop`, without changing its visual size.
3. **Theme plumbing.** Generate the Uniwind/Tailwind `@theme` block and a typed RN `theme.ts` from `atepdf-tokens.json`. Replace the incumbent `global.css` colours; do not keep both.
4. **Appearance.** Use `useColorScheme()` plus the Settings override. The native window background must match `bg.window` to avoid a white flash on launch in dark mode.
5. **Fonts.** No bundled fonts. `fontVariant: ['tabular-nums']` for facts.
6. **Toolbar.** Hide the Catalyst title (`titlebar.titleVisibility = .hidden`) and render the 52 pt toolbar in React Native, reserving the traffic-light area (78 pt leading inset). If the native `NSToolbar` bridge is adopted instead, the same layout applies.
7. **Menus and shortcuts.** In-window key handling is part of SHR-106. Native menu-bar items (UIMenuBuilder) are specified in UX_SPEC section 15. If SHR-106 cannot bridge them, they belong to SHR-75, and SHR-106 must still expose every command in-window.
8. **Assets.** SVG sources in `brand/` are the masters. Export @1x/@2x PNG only where required (app icon set). In-app marks use SVG (`react-native-svg`, already present via lucide).

---

## 15. Component principles

- **Artifacts, not bubbles.** Only the user's request gets a filled block. Assistant text sits directly on the window background. Files, choices, activity and results are the only bordered objects in the thread.
- **One card per outcome.** A task produces at most one result card (or one collection card). Intermediate steps live inside the activity row, never as separate cards.
- **Current wins.** The current result is the only one with an Iris Save and full actions. Earlier results collapse to a single row.
- **Inline first, sheet when consequential.** Clarifications, quality choices and secure input appear inline in the thread. Sheets are reserved for content transfer consent, destructive workspace actions, settings, onboarding, the paywall and Quick Look.
- **Everything has all its states.** Every component in COMPONENT_INVENTORY lists default, hover, focus, pressed, selected, disabled, busy and error where they apply. A component without a defined state is not ready.

---

## 16. Validation (SHR-105)

**Contrast.** Every text/background pairing used by the components was computed with the WCAG 2.x relative-luminance formula (33 pairs checked). All text pairs are ≥ 4.5:1, including tertiary text and 11–12 pt meta. The focus ring and non-text indicators are ≥ 3:1 against their background. `text.disabled` is exempt (disabled controls only).

| Pair | Light | Dark |
|---|---|---|
| text.primary / bg.window | 16.7 | 15.8 |
| text.secondary / surface.raised | 6.4 | 6.7 |
| text.tertiary / bg.window | 4.9 | 5.4 |
| text.tertiary / surface.elevated | 5.3 | 4.5 |
| text.tertiary / bg.sunken (chips, keycaps) | 4.6 | — |
| accent.text / surface.raised | 6.0 | 5.4 |
| text.onAccent / accent.fill | 6.0 | 5.0 |
| status.local.fg / status.local.bg | 5.0 | 7.3 |
| status.warning.fg / status.warning.bg | 5.4 | 8.1 |
| status.danger.fg / status.danger.bg | 4.8 | 6.0 |
| status.success.fg / surface.raised | 5.4 | 8.2 |
| text.onAccent / status.danger.fill | 5.5 | 5.0 |
| accent.text / accent.subtle (Current tag) | 5.1 | 5.0 |
| focus ring (`accent.fill`) / bg.window (≥ 3) | 5.6 | 3.7 |

**Token coverage.** Every token in `atepdf-tokens.json` (120 tokens) is referenced by COMPONENT_INVENTORY.md, DESIGN_SYSTEM.md or UX_SPEC.md; this was checked by script, and one unused token (`status.success.bg`) was removed. `atepdf-tokens.css` matches the JSON value for value in both appearances. Every component in the inventory uses only tokens defined here.

**Mockups.** [`mockups/index.html`](mockups/index.html) renders every required state in both appearances (use the Light/Dark switch, or `?theme=dark`; `?only=<id>` renders a single screen). All product UI in it uses only `atepdf-tokens.css` variables. Synthetic page content, the traffic lights and brand-board backgrounds are illustration. The PNG captures in [`mockups/png/`](mockups/png/) were made from that file with headless Chrome at 1× scale. They are design references, not evidence of an implemented app.

---

## 17. Superseded incumbent rules

The incumbent rules (white canvas, navy `#18213b`, blue `#1769df`, pill quick actions, 20–28 pt radii, paper illustration, gradient raster 8, "no sidebar or permanent preview rail", "Dark mode is not implemented") are superseded as listed in [MIGRATION_MAP.md, section 1](MIGRATION_MAP.md#1-superseded-ux-constraints). Behavioural contracts in [UX_STATE_CONTRACT.md](../UX_STATE_CONTRACT.md) (document identity, current and earlier results, scroll intent, focus restoration, receipts) **remain in force** and are restated with their new presentation in UX_SPEC.md.

---

## 18. Owner decisions

All seven were approved by the owner on 30 September 2026, as recommended.

| ID | Decision | Approved outcome |
|---|---|---|
| OD-1 | Logo and app-icon direction | **A · Folio Eight**, Ink icon (Paper variant for light/tinted appearances) |
| OD-2 | Name casing and wordmark | `atePDF` in prose and wordmark, superseding lowercase `atepdf` |
| OD-3 | Dark appearance in launch scope (MAC-04) | Ship light and dark together |
| OD-4 | Accent colour | Iris `#5646F0` / `#6354FF` |
| OD-5 | Right-hand Files panel (supersedes "no sidebar or permanent preview rail") | Right-hand Files panel, auto-shown ≥ 1120 pt, toggleable ⌥⌘I |
| OD-6 | Mac idiom vs iPad idiom for Catalyst | Mac idiom, pending engineering confirmation in SHR-106/75 |
| OD-7 | Settings as an in-window sheet rather than a separate Settings window | Sheet for v1 (avoids multi-window work, MAC-02) |

Items that stay open under PRODUCT_V1.md (prices, allowance, retention defaults, outage policy, consent wording) are **not** decided here. The design shows where they appear, using placeholders.
