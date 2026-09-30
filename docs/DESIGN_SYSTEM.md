# Design system

> **Superseded visual direction (SHR-105, owner-approved 30 September 2026):** the approved v1 visual identity and interaction system is in [docs/design/](design/README.md). Its visual rules replace this page's "no redesign", palette, name-casing, logo, sidebar and dark-mode statements as listed in [MIGRATION_MAP.md](design/MIGRATION_MAP.md). The behavioural references below (UX_STATE_CONTRACT) remain in force. This incumbent text is kept as history until SHR-106 implements the new system and updates this entrypoint.

Canonical entrypoint for the incumbent design, 29 September 2026. **No redesign is authorized.** The approved v1 Mac experience, brief onboarding and concise assistant voice are defined in [PRODUCT_V1.md Section 13](PRODUCT_V1.md#13-mac-experience-and-assistant-voice), MAC-01–04/UX-01–04. Existing mobile/browser layouts and historical state contracts are implementation references, not competing launch priorities or proof of Mac acceptance. Preserve the name/8 identity and conversational layout; no asset or runtime wording is changed by this adoption.

The detailed source-derived tokens, typography, layout, components and motion live in [apps/universal/DESIGN.md](../apps/universal/DESIGN.md). The behavioral contract is [UX_STATE_CONTRACT.md](UX_STATE_CONTRACT.md). Preserve these as detailed references rather than creating a conflicting second token set.

## Established system

- Lowercase atepdf; approved rounded gradient 8 and wordmark. Brand-board mockups do not control layout.
- Light white canvas, navy foreground `#18213b`, blue primary `#1769df`, muted supporting text and soft borders. Platform system sans-serif; no custom text font.
- One centered conversation, header with secondary privacy/connection controls, bottom composer, inline attachments/activity/choices/results/preview. No sidebar or permanent preview rail.
- Official assistant-ui React Native primitives with local presentation/runtime adapters. App-specific PDF cards remain local components. Existing shadcn DOM code is not the active interface.
- Current/Earlier result identity, actual page/byte facts, primary Save on the current result, read-only Preview and contextual Undo. Progress must reflect actual planner/controller/engine events.
- Native uncontrolled composer protects typing/caret behavior. Larger text, keyboard clearance, deliberate upward reading and Reduce Motion are part of the existing contract.

## Requirements versus proof

The existing requirements include 44-point/44-CSS-pixel touch targets, visible keyboard focus, accessible names, readable contrast and meaningful state announcements. Historical browser and selected Apple simulator checks cover a subset of these. They are not WCAG, VoiceOver, physical-device, browser-wide or current Mac acceptance. Native preview is a raster; browser preview is canvas-only without a selectable/searchable text layer.

Known review items include clarification continuity, pre-import sample cancellation, connection-control concurrency/error handling, misleading OCR-review wording, long-session capacity, mobile-web keyboard behavior and stale template branches. Full dark mode is not implemented despite some dark classes. Detailed findings and classifications are in [the frontend audit](audit/FRONTEND_CAPABILITIES_AUDIT.md).

The prepared [usability study](UX_USABILITY_STUDY.md) has no observed participants/results. It is a proposal, not evidence of successful everyday-user comprehension. Execution requires a separately authorized next phase; no tester contact occurs in this audit.
