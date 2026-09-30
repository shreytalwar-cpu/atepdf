# atePDF v1 UI migration map

**Issue:** SHR-105 · **Status:** proposed · **Implements in:** SHR-106 · **Baseline:** `origin/main` at `524af24` (includes SHR-39 persistence and SHR-45 corpus; SHR-40 is not included and was not used)

This maps every visible element of the current app (`apps/universal/App.tsx`, `src/components/**`, `src/platform/**`, `global.css`, `assets/`) to its fate: **Keep**, **Modify**, **Replace** or **Remove**. It records the incumbent UX constraints this redesign supersedes (the SHR-105 acceptance item) and the test selectors that change. It also lists interactions that need behaviour from another issue, and gives SHR-106 an order of work.

**Rule for SHR-106:** remove or replace an old element only once the new system fully covers its supported state (SHR-106 Migration). Behavioural code (controller, vault, planner, privacy, clarification, entitlement) is **not** touched by this map. Only presentation and presentation state are.

---

## 1. Superseded UX constraints

Each row is an incumbent rule that the owner-approved redesign track (SHR-26 → SHR-105/106) replaces **once SHR-105 is approved**. Until approval, the incumbent documents remain the reference.

| # | Incumbent constraint | Source | Superseded by |
|---|---|---|---|
| X-1 | "No redesign is authorized." Preserve the white/navy/blue palette and conversational layout, and fix usability only | `docs/DESIGN_SYSTEM.md`, `apps/universal/DESIGN.md`, PRODUCT_V1 MAC-04 (visual part) | SHR-26/SHR-105 owner decision. The conversational layout (one thread + docked composer) **is kept**. The palette, radii, type and components are replaced. |
| X-2 | Palette `#ffffff` / `#18213b` / `#1769df`, mint privacy badge, blush/violet shortcut icon colours | `global.css`, `DESIGN.md` | DESIGN_SYSTEM 3 (Paper/Graphite neutrals, Iris accent, status/privacy tokens) |
| X-3 | Radii 12/16/20/24/28 (pill controls, 28 pt composer and welcome) | `DESIGN.md` | DESIGN_SYSTEM 6 (4–16; status pills are the only full rounding) |
| X-4 | Body 16 pt, captions 11–12 at 1:1 in the iPad idiom | `DESIGN.md` | DESIGN_SYSTEM 4 (Mac scale: body 14, UI 13, rendered pt) |
| X-5 | "No sidebar or permanent preview rail" | `docs/DESIGN_SYSTEM.md`, `DESIGN.md` Don'ts | A right-hand **Files panel** (OD-5). Still no navigation sidebar. Preview is a Quick Look sheet, not a rail. |
| X-6 | Inline preview inside the result card | `DESIGN.md` Preview, `UX_STATE_CONTRACT` Preview row | QuickLookPreview sheet (UX_SPEC S9.6). The contract's behaviour (read-only, page nav, zoom, fit, focus return, no retargeting) is kept. |
| X-7 | Three always-visible quick-action pills under the composer | `App.tsx` Footer, `UI_FIDELITY_LEDGER` | Context-aware SuggestionChips inside the composer + ⌘K ActionPalette, AI-routed (D-04) |
| X-8 | Dashed welcome card with the paper illustration; "Drop files here" / "Add your files" heading | `App.tsx` Welcome, `APPROVED_BRAND.md` | EmptyWorkspace (mark + headline + examples). The paper illustration is retired. |
| X-9 | Approved raster gradient 8 and lowercase `atepdf` wordmark in the header | `APPROVED_BRAND.md`, `brand.json`, `App.tsx` header | The new mark (OD-1) and `atePDF` wordmark (OD-2). No logo in the toolbar. |
| X-10 | Privacy badge text "Processed on your device" | `App.tsx`, `brand.json` | StatusPill "On this Mac" (accessibility label kept for tests, see section 4) |
| X-11 | "Full dark mode is not implemented"; dark mode not a launch gate | `docs/DESIGN_SYSTEM.md`, MAC-04 | Full dark token set. Launch inclusion is OD-3. |
| X-12 | 44-pt minimum hit targets on all platforms | `docs/DESIGN_SYSTEM.md`, `DESIGN.md` | 28 pt controls / 24 pt pointer minimum on Mac; 44 pt hit areas kept on touch idioms (DESIGN_SYSTEM 14.2) |
| X-13 | User messages as right-aligned bubbles (assistant-ui default) | `thread.aui.tsx` UserMessage | Left-aligned RequestBlock (COMPONENT_INVENTORY C2) |
| X-14 | Result card copy "Tell me what you'd like to do next." inside the card | `App.tsx` MessageExtras | Removed. The composer placeholder "What next for {title}?" carries it. |
| X-15 | Connection, pairing and key entry cards in the conversation | `App.tsx` KeyEntry, BrowserPairing, NativePairing, connection-help | Settings ▸ AI ▸ Developer connection (development builds only) |
| X-16 | Start over as an in-thread question with "Clear session" / "Keep working" | `App.tsx` header + MessageExtras | ConfirmSheet "Start Over" (a destructive workspace action → sheet, DESIGN_SYSTEM 15) |
| X-17 | Privacy explanation as a modal dialog with "Got it" | `App.tsx` Modal | PrivacyPopover + Settings ▸ Privacy & Storage |
| X-18 | Planning shown with a `sparkles` icon | `JobActivity.tsx` | ActivityGlyph. No "AI magic" iconography. |

Behavioural contracts that are **not** superseded: the whole of UX_STATE_CONTRACT (document identity, one current result, earlier results inspectable, scroll intent, focus restoration, receipts, clear-session semantics, data lifetime), CONV-01–09, PRIV-*, PDF-06 secure input, BILL-04 access after exhaustion.

---

## 2. Element map

### 2.1 Shell and theme

| Current element | File | Fate | New component / notes |
|---|---|---|---|
| `@theme` colours in `global.css` | `global.css` | **Replace** | Generated from `docs/design/tokens/atepdf-tokens.json` (light + dark). Remove the old values in the same change. |
| `.aui-composer-shell` shadow/focus CSS | `global.css` | **Replace** | Composer focus (COMPONENT_INVENTORY D1) |
| `.atepdf-button` hover/transition CSS | `global.css` | **Modify** | Keep the mechanism; use token colours and `duration.fast` |
| `focus-visible` 2px outline rule | `global.css` | **Keep** (values updated) | 2 pt `accent.fill`, offset 2 |
| Reduced-motion media rule | `global.css` | **Keep** | Extend to all motion tokens |
| `SafeAreaView` white background | `App.tsx` Screen | **Modify** | `bg.window`, appearance-aware |
| Header row: 8 crop + wordmark crop | `App.tsx` Screen | **Remove** | No toolbar logo (DESIGN_SYSTEM 2.6) |
| Header privacy badge | `App.tsx` Screen | **Replace** | StatusPill Local + PrivacyPopover |
| Header AI-connection button (`sliders-horizontal`) | `App.tsx` Screen | **Replace** | Settings ▸ AI (and ⋯ menu). Development-only for key/pairing. |
| Header Start over button (`square-pen`) | `App.tsx` Screen | **Replace** | ⋯ menu "Start Over…" ⇧⌘⌫ → ConfirmSheet |
| — | — | **New** | WindowToolbar, WorkspaceContext, FilesPanel, InlineBanner, ActionPalette, SettingsSheet, OnboardingSheet, PaywallSheet (placeholder), ShortcutsSheet |
| "Native development preview · local PDF processing is not connected yet." caption | `App.tsx` | **Modify** | InlineBanner Info (development builds only) |
| Workspace notice caption + Try again | `App.tsx` | **Replace** | InlineBanner variants (UX_SPEC S3.3). Copy unchanged. |
| "Restoring your workspace…" centred text | `App.tsx` | **Keep** (restyled) | UX_SPEC S3.2 |
| Privacy `Modal` | `App.tsx` | **Replace** | PrivacyPopover + Settings. Durable/session copy moves to Settings ▸ Privacy & Storage. |
| `DropSurface` (web) overlay: 2px dashed `#1769df`, 28 radius, "Drop your PDFs here" | `DropSurface.web.tsx` + `workspace.css` | **Replace** | DropOverlay (B4). Keep `data-testid="drop-feedback"` and the depth-count logic. |
| `DropSurface.native` | `DropSurface.native.tsx` | **Modify** | Native Catalyst drop (SHR-73) uses the same DropOverlay visuals |
| App icon / Catalyst asset catalog | `ios/…/Images.xcassets` | **Replace** | Icon Composer `.icon` + legacy set from `docs/design/brand/` (DESIGN_SYSTEM 2.5) |
| `assets/approved-8-mark-source-crop.png`, `approved-atepdf-wordmark-source-crop.png` | `assets/` | **Remove** from the app (keep in the build pack as history) | BrandMark SVG |
| `assets/paper.png` | `assets/` | **Remove** from the app | — |

### 2.2 Conversation (`thread.aui.tsx`, `App.tsx` MessageExtras)

| Current element | Fate | New component / notes |
|---|---|---|
| assistant-ui `Thread`, FlatList, viewport store, scroll-follow logic | **Keep** | Behaviour is the UX_STATE_CONTRACT scroll intent. Restyle only. |
| `Latest message` floating control | **Modify** | LatestButton (C16), ⌘↓ |
| `UserMessage` right-aligned bubble | **Replace** | RequestBlock (C2), left-aligned |
| `AssistantMessage` / `SpokenMessage` | **Modify** | AssistantMessage (C3). Keep the live-region announce and the `assistant-message` test ID. |
| Accessibility labels "You said" / "Assistant said" | **Modify** | "You" / "atePDF" prefixes (UX_SPEC 16) |
| Assistant action bar: Copy | **Modify** | Hover-only Copy (C3) |
| Assistant action bar: Refresh (reload), user Edit, BranchPicker | **Remove** from the rendered thread | Not v1 behaviour (regenerating or editing a turn would bypass the controller history). Leave the primitives unused. |
| `ThreadWelcome`, `ThreadSuggestions` (template) | **Remove** | EmptyWorkspace + SuggestionChips |
| `TypingIndicator` dots | **Remove** | ActivityGlyph (A14) |
| `ShimmerLabel` | **Remove** | No shimmer (principle 5) |
| `MessageError` | **Modify** | OutcomeNotice (couldn't finish) |
| `ThreadHistorySkeleton` | **Modify** | S3.2 restoring state, with no skeleton shimmer |
| Attached files in the user turn ("I've added 3 PDFs" + file rows with the blush `file-text` icon, "Original · 1") | **Replace** | SourceGroup (C4) + FileRow source (C5) with a real thumbnail |
| Import confirmation text "Your 3 PDFs are ready. N pages in total…" | **Keep** (trimmed) | UX_SPEC S4.4 |
| `JobActivity` (pulse circle, title, detail, "On your device", show steps) | **Replace** | ActivityRow (C7). Keep the stage derivation logic (operationTitles, step statuses, announcement de-duplication) and the `progress-message` and `activity-pulse` test IDs. |
| Result card (icon tile, title, facts, Current/Earlier text, check, Save PDF / Preview / Undo, receipt, note, "Tell me…") | **Replace** | ResultCard current / earlier (C12). Keep `current-result`, `previous-result`, `result-facts`, receipts-per-ref and the "only current has primary Save" rule. |
| Inline `Preview` (native + web) | **Replace** (container) / **Keep** (rendering) | QuickLookPreview sheet (E1). Keep the renderers (`Preview.native.tsx` raster pipeline including the raster-scale fix; `Preview.web.tsx` canvas) as the page view inside the sheet. |
| Choice buttons "Create optimised copy" / "Keep working" | **Replace** | ProposalCard quality variant: "Create Copy" / "Keep Current Result" |
| Choice buttons "Clear session" / "Keep working" | **Replace** | ConfirmSheet Start Over |
| "This question is closed." | **Keep** (restyled) | ChoiceList / ProposalCard stale (C8, C9) |
| Planner clarification question (plain assistant text) | **Modify** | Question text + ChoiceList when the response carries choices. Free-text answers are unchanged. |
| `KeyEntry`, `BrowserPairing`, `NativePairing`, `connection-help` button | **Move** | Settings ▸ AI ▸ Developer connection (development only). The secure field treatment is kept. |
| Local help text (`localCapabilityHelp`) | **Modify** | Help message (S6.5), generated from the runtime capability catalogue |
| `SECRET_CHAT_WARNING` reply | **Modify** | Inline composer warning (D1 secret detected). The same check and copy source. |

### 2.3 Composer and footer

| Current element | Fate | New component / notes |
|---|---|---|
| Native uncontrolled composer input (`ComposerInput.native.tsx`) | **Keep** | Protects typing/IME (UX_STATE_CONTRACT). Restyle only. |
| Placeholder "Tell atepdf what to do…" | **Modify** | Context placeholders (D1). The accessibility name becomes "Tell atePDF what to do". |
| Add (`plus`) button | **Keep** (restyled) | Attach IconButton, ⌘O |
| Send / Cancel buttons | **Modify** | 28 pt square Send (Iris when active) / Stop. Names "Send message" and "Cancel" kept. |
| Footer quick-action pills (Merge / Compress / Make searchable, coloured icons) | **Replace** | SuggestionChips (D2) + ActionPalette (D3), both AI-routed |
| Footer "Current: {title} · N pages" / "N originals in this chat" / "Your files stay on this device" | **Replace** | Composer context row (D1) + WorkspaceContext (B2) |
| Footer Help button | **Move** | ⋯ menu, palette, ⌘?, hint-row `?` |
| Keyboard-visible / landscape / large-text footer hiding logic | **Keep** for touch idioms; **Modify** for Mac | The Mac has no software keyboard; large-text wrapping per DESIGN_SYSTEM 4 |

### 2.4 Code paths that the design depends on but does not change

| Item | Status |
|---|---|
| `action()` compiles quick actions locally (`controller.quick`), bypassing AI | **Known source/target mismatch** (DECISIONS.md). The design requires AI routing (UX_SPEC S7). Restoring the routing is **behaviour work**, not part of the visual migration. SHR-106 must not deepen the bypass by wiring SuggestionChips or the palette to `controller.quick`. Wire them to the same `submit()` path as typed text, and raise the remaining routing restoration for Linear triage. |
| Planner outage policy | OPEN-09. S7.3 shows the conservative presentation until it is decided. |
| Entitlement / allowance values | `COMMERCE_ENABLED = false`. Commercial surfaces ship as components behind this flag (placeholders only). |

---

## 3. New interactions that need behaviour owned elsewhere

These appear in the design. SHR-106 builds their **presentation**. The behaviour belongs to the named issue or decision. If that behaviour is not ready, SHR-106 hides the control rather than faking it.

| Interaction | Owner |
|---|---|
| Reorder sources (drag, ⌥↑/⌥↓), remove a source, multi-select | SHR-73 (Finder import, selection and ordering) |
| Drag-out of results to Finder, "Show in Finder", exact-file reopen | SHR-74 |
| Native menu-bar commands, ⌘-shortcut routing, F6 region cycling, window size restore | SHR-75 (SHR-106 provides the in-window equivalents) |
| VoiceOver acceptance of the new structure | SHR-76 |
| Onboarding content final wording, assistant voice | SHR-77 (the layout is defined here) |
| Retention picker values, storage breakdown, delete-local-data semantics | SHR-40 / OPEN-05 |
| Collections, text results, Protect/Unlock secure input | The respective tool issues. The components are ready. |
| Content-transfer consent and receipts | PRIV-04 feature work. No v1 flow triggers them. |
| Paywall, restore, allowance | BILL/DIST issues. Placeholders until commerce is enabled. |

---

## 4. Test selector changes (for SHR-106 to update with the UI)

| Selector used by `tests/e2e` | New state |
|---|---|
| `getByTestId('conversation' / 'assistant-message' / 'user-message' / 'progress-message' / 'activity-pulse' / 'current-result' / 'previous-result' / 'result-facts' / 'drop-feedback' / 'welcome')` | **Kept** |
| textbox `Tell atepdf what to do` | Renamed **`Tell atePDF what to do`** |
| button `Merge`, `Compress`, `Make searchable` | **Kept** as chip accessibility names while they are suggested. Tests that assume they are always visible must first add files (chips appear only with files). |
| button `Try the two sample PDFs` | Renamed **`Try with sample PDFs`** |
| heading `Drop files here` | Renamed **`Drop PDFs or images here`** |
| button `Save PDF` | **Kept** as the accessibility name (the visible label is "Save…") |
| button `Preview` | **Kept** (opens Quick Look) |
| region `Read-only preview`, buttons `Next page`, `Zoom in`, `Close preview` | **Kept** (inside the Quick Look sheet) |
| button `Undo`, `Send message`, `Cancel`, `Latest message` | **Kept** |
| button `Create optimised copy` / `Keep working` | Renamed **`Create Copy`** / **`Keep Current Result`** |
| button `Clear session` / `Start over` | **`Start Over…`** (menu) → sheet button **`Start Over`** |
| button `Processed on your device` / `Got it` | StatusPill keeps the accessibility label **`Processed on your device`** (visible "On this Mac"). "Got it" is removed (popover, Esc). |
| button `OpenAI connection` / `AI connection`, textboxes `OpenAI project key`, `Native pairing code` | Moved to Settings ▸ AI ▸ Developer connection. Tests open Settings first. |
| button `Plan this request` | Tests assert it is **absent**. Keep that assertion: the redesign adds no separate plan-approval button. |
| img `atepdf` | Removed from the toolbar. The window title and BrandMark (onboarding/About) use `atePDF`. |

---

## 5. Recommended SHR-106 order of work

1. **Tokens and theme:** generate the Tailwind/Uniwind theme and RN `theme.ts` from `atepdf-tokens.json`, add the appearance plumbing and the Catalyst scale factor. No visual component changes yet; the existing tests must stay green.
2. **Primitives:** A1–A16, plus a hidden component gallery screen for review.
3. **Shell:** WindowToolbar, WorkspaceContext, InlineBanner, DropOverlay, EmptyWorkspace, window sizes. Remove the header and welcome card.
4. **Thread:** RequestBlock, AssistantMessage, SourceGroup/FileRow/PageThumbnail, ActivityRow, OutcomeNotice, ResultCard, ChoiceList, ProposalCard, SecureInputCard. Remove the inline preview container.
5. **Composer:** context row, SuggestionChips and ActionPalette wired to `submit()` (not `controller.quick`), Send/Stop, hint row, ExhaustedBar (flagged off).
6. **Sheets:** QuickLookPreview (wrapping the existing renderers), ConfirmSheet, SettingsSheet (General, Privacy & Storage with SHR-40 values when merged, AI, Account & Pro placeholders, About), OnboardingSheet, PaywallSheet (flag off), ShortcutsSheet.
7. **Files panel** (if OD-5 is approved).
8. **Brand assets:** app icon set, BrandMark SVGs.
9. **Cleanup:** remove the retired assets, CSS and template components. Update `apps/universal/DESIGN.md` to point at `docs/design/`. Update the e2e selectors (section 4). Capture actual Mac builds at 640, 1024 and 1440 widths in both appearances.
