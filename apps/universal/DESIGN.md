---
name: atepdf shared application
description: The incumbent friendly drop-and-instruct conversation
colors:
  background: "#ffffff"
  foreground: "#18213b"
  primary: "#1769df"
  primary-hover: "#125ac4"
  primary-foreground: "#ffffff"
  muted: "#f2f4f8"
  muted-foreground: "#5d6980"
  border: "#e2e7ee"
  accent: "#eef4ff"
  destructive: "#b4233a"
  welcome-surface: "#f8faff"
  welcome-border: "#ccd9ec"
  privacy-surface: "#edf9f4"
  privacy-ink: "#26715c"
  merge-icon: "#aa405e"
  ocr-icon: "#7460b0"
  original-icon: "#c45167"
typography:
  welcome-title:
    fontSize: "26px"
    fontWeight: 600
    letterSpacing: "-0.025em"
  dialog-title:
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
  result-title:
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  body:
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  secondary:
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  button-label:
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
  activity-title:
    fontSize: "15px"
    fontWeight: 500
    lineHeight: "24px"
  template-support:
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
  compact-action:
    fontSize: "11px"
    fontWeight: 400
    lineHeight: "16px"
  caption:
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
rounded:
  preview-control: "9px"
  preview: "14px"
  control: "12px"
  attachment: "16px"
  result: "20px"
  dialog: "24px"
  composer: "28px"
spacing:
  unit: "4px"
  small: "8px"
  medium: "12px"
  content: "16px"
  inset: "20px"
  section: "24px"
  wide: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.button-label}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-secondary:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.button-label}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  result-card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.result}"
    padding: "16px"
  composer-shell:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.composer}"
    padding: "8px"
---

# Design System: atepdf

## Overview

The incumbent direction is **friendly, simple and useful**, as established by the owner-approved [handoff design contract](../../atepdf_codex_build_pack/DESIGN.md). Record and refine this system; do not invent a replacement visual world. The primary audience is occasional PDF users, recorded in [PRODUCT.md](PRODUCT.md).

This records the source-derived baseline from `8d71ac0` and its 29 September 2026 refinement. The refinement report distinguishes each tested build and platform. Values come from [global.css](global.css), [App.tsx](App.tsx), the [assistant-ui thread](src/components/assistant-ui/elements/thread.aui.tsx) and platform previews. Browser evidence was inspected at desktop and compact widths. Values below describe the existing light appearance; native rendering, dark appearance and accessibility compliance require their own checks. If a scoped refinement changes a value, update this record alongside that change.

The white canvas, navy text, restrained blue actions and soft borders keep the document task central. The approved paper illustration provides warmth only while the workspace is empty. After import, the conversation and real files occupy the same space. The identity is the approved lowercase wordmark and rounded gradient numeral 8, not a new mascot or an alternate logo.

## Colors

Primary blue identifies the action that advances the current task: Choose files, Send or Save. Primary hover is the existing darker interaction state. Navy foreground carries content; muted foreground carries facts and supporting explanations. White backgrounds, pale neutral message/preview surfaces and cool borders create separation without dashboard panels.

The empty drop target uses the welcome surface and dashed welcome border. The privacy badge uses its mint surface and green ink. Small shortcut icons carry existing blush, green and violet accents; those icons do not establish additional primary action colours. The logo gradient stays in the approved artwork.

The frontmatter records actual source colours, which differ slightly from the handoff's approximate starting tokens. Do not silently replace them with the handoff estimates. Dark-variant classes exist, but the app does not yet define a complete alternate dark palette; do not call dark mode complete from those classes alone.

## Typography

Use platform system sans-serif text. The application does not load a custom text font; web inherits the installed Tailwind/React Native Web system stacks, while native Text uses the platform default. Do not distribute Apple font files or identify the cropped wordmark as a known font. The browser preview chrome explicitly uses `system-ui`.

The frontmatter captures the principal roles. Conversation text and composer use body size; artifact facts and explanatory copy use secondary size; file metadata and context use caption size. Some explanatory passages use a more generous 24 px line height. Activity headings use 15 px medium text with 24 px leading. Quick-action labels currently use 11 px at compact width and 12 px at the web small breakpoint; record any legibility refinement instead of introducing a new font family.

Keep sentence case. Titles provide concise document/task hierarchy, not marketing slogans. Larger accessibility text may reflow controls and simplify decoration; it must not truncate the action needed to complete the task.

## Layout

The app has a compact brand/privacy/settings header, one centered conversation and a bottom composer with secondary quick actions. The current conversation maximum width is 48 rem (768 CSS px at the web default root size); horizontal conversation/composer insets are 16 px. Message-list vertical spacing is 24 px. The empty drop surface has a 36 rem maximum width and remains centered within the available conversation area. These are incumbent values, not permission to expand into a sidebar or permanent preview rail.

The composer stays outside the scrolling message list. Its input is at least 48 px high and grows to a 160 px maximum before internal scrolling; Add and Send/Stop occupy the action row. Apple uses safe-area padding and keyboard avoidance. The existing native footer hides secondary controls when keyboard plus landscape/large-text constraints require that space; large-text narrow layouts can scroll shortcuts horizontally.

Web small/wide adjustments occur at the installed 640/768 px breakpoints. At browser heights up to 600 px, chrome padding and icon-only hit areas use fixed pixel minima while text keeps its chosen size. This preserves conversation space when larger text and a short window are combined; text buttons still grow with their labels. At widths below 430 px the privacy badge displays its accessible lock control without the long label. The empty illustration is reduced below 760 px viewport height and omitted below 620 px. The mobile heading is “Add your files”; desktop web uses “Drop files here”.

The [state contract](../../docs/UX_STATE_CONTRACT.md) specifies current-result identity, intentional scrolling and focus recovery. Those requirements are distinct from claims that every baseline transition already meets them.

## Elevation & Depth

Most surfaces use a single border and tonal separation. The web composer defines a restrained shadow (`0 2px 8px #18213b05, 0 8px 28px #18213b04`), a focus ring with a 3 px translucent blue spread, a small latest-message shadow (`0 3px 12px #18213b12`) and a rendered-page shadow (`0 2px 12px #18213b18`). The privacy dialog uses a 25% black scrim. These are source values; appearance must be checked on the target platform.

Buttons use 140 ms colour/opacity transitions and the composer uses 160 ms border/shadow transitions in web styles. The activity decoration uses the existing 700 ms opacity pulse per direction; progress text remains at full contrast. Reduce Motion disables the relevant transitions/pulse. Do not animate factual progress percentages or introduce timing that pretends work is happening.

## Shapes

Soft rounded rectangles contain text and files. Frontmatter radii distinguish controls, attachments, results, dialogs and composer. Quick actions, header icon controls and Send/Stop are circular or pill-shaped where their content warrants it. The welcome area shares the composer's broad rounding. The browser preview uses a 14 px outer radius; the native preview uses the existing 12 px control radius.

Use thin cool borders for grouping. Do not turn every message into a card. User text uses a quiet filled bubble; assistant explanations sit directly in the conversation, with bordered containers reserved for files, choices and outputs.

## Components

- **Brand header:** approved source-pixel mark and wordmark crops, with accessible product text. Privacy details and connection controls stay secondary. The source crops are not claimed as production vector masters.
- **Empty drop area:** approved paper artwork, one concise heading, Choose files and an optional two-sample action. Remove the empty composition after import. Touch users must never need dragging.
- **Attachment:** local filename and actual file facts, explicitly identified as an original. Visible order must match merge order. Local names stay outside planner transport.
- **Composer:** familiar multiline entry with Add and Send/Stop. The native uncontrolled input is deliberate and must be preserved. Web keyboard focus uses a solid 2 px primary-blue outline outside the composer shell. The unlayered rule deliberately outranks React Native Web resets; a base-layer border rule alone is insufficient. Disabled Send is visibly subdued; disabled state alone must not explain a missing prerequisite.
- **Buttons:** principal blue, bordered secondary and quiet text/icon variants. Minimum 44-point Apple / 44-CSS-pixel web hit areas. Visible icon sizes are smaller than hit areas. Pointer hover supplements, never replaces, touch and keyboard feedback.
- **Activity:** one factual title and concise detail from controller/planner state. Multiple-step detail is disclosure content. Keep planning, local execution and independent validation distinguishable.
- **Result:** factual page count and size, a meaningful identity, visible current/previous relationship, Save, Preview and contextual Undo. Current identity must be understandable without rereading every preceding turn. Operation-derived titles (for example Merged PDF) and Current result/Earlier result labels identify outputs. Only the current result has a primary Save action; Undo appears when a prior result exists. The redundant template Copy action is omitted for artifact messages. Result section gaps are 12 px below 640 px and 16 px above it.
- **Preview:** read-only and inline within its result; page navigation, zoom, Fit and Close stay reachable. Web page height is `clamp(160px, 40dvh, 400px)`. Native page height accounts for keyboard space and stays bounded between 104 and 320 points; larger text can split the toolbar. When a wide native preview has less than 260 points of conversation height with the software keyboard open, its controls share one row and the raster uses the remaining measured space. A bounded, measured reveal keeps that preview visible after the keyboard settles without changing input focus. Preview must not become the workspace's permanent second column.
- **Error and choices:** concise assistant text near the relevant action, with one useful next step. Choices are inline and revision-bound. The privacy explanation is a dismissible, scrollable dialog with one named semantic boundary on web. Preview controls wrap into page and zoom groups at compact widths. Explicit preview Close restores focus to its trigger; a new user submission follows measured content to the end, while deliberate upward reading suspends following.

## Do's and Don'ts

- Do preserve the approved 8, lowercase name, white/navy/blue foundation and friendly empty-state artwork.
- Do refine hierarchy, spacing, type, copy and adaptive behavior in the existing shared components.
- Do give the current document a visible identity and preserve access to earlier immutable outputs.
- Do keep working controls usable with a keyboard, larger text, reduced motion and narrow available space.
- Don't add a sidebar, permanent preview rail, tool catalogue, new editor or replacement visual theme.
- Don't show unsupported capabilities, invented progress or a saved receipt without the corresponding result.
- Don't equate source styles or browser screenshots with native, dark-mode or accessibility acceptance.

## Structured token review, 29 September 2026

The full Impeccable scan identified ten advisory differences from the first token record. The 11/13/15 px roles and 9/14 px preview radii above record actual existing styles previously described only in prose, including template support primitives that are not active in the primary PDF journey. The merge icon colour is the incumbent shortcut accent. Preview fallback colours now use the same primary/muted values as the semantic tokens; no ignore rules or detector suppressions were added. These documentation corrections do not establish native large-text or screen-reader acceptance.
