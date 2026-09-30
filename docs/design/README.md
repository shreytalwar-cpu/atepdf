# atePDF v1 design (SHR-105)

**Status:** approved by the owner on 30 September 2026 (all decisions OD-1 to OD-7 in [DESIGN_SYSTEM.md section 18](DESIGN_SYSTEM.md#18-owner-decisions)). It becomes the visual and interaction authority once PR #91 merges; SHR-106 implements it. The behavioural rules in `docs/UX_STATE_CONTRACT.md` stay in force; the visual rules in `docs/DESIGN_SYSTEM.md` (incumbent section) and `apps/universal/DESIGN.md` are superseded as listed in [MIGRATION_MAP.md](MIGRATION_MAP.md).

This folder is the canonical visual identity and interaction system for the atePDF v1 Mac app. It changes presentation only. The product model, privacy rules, AI routing and PDF behaviour are defined in [PRODUCT_V1.md](../PRODUCT_V1.md) and are unchanged.

| File | What it is |
|---|---|
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Principles, brand (three explored directions; A approved), colour, type, spacing, radii, elevation, motion, icons, light/dark, platform notes, validation, and the **owner decisions** (section 18) |
| [UX_SPEC.md](UX_SPEC.md) | Every major v1 flow, screen by screen and state by state, plus the keyboard map, accessibility and a state coverage matrix |
| [COMPONENT_INVENTORY.md](COMPONENT_INVENTORY.md) | Every reusable component with its anatomy, tokens, variants, states, keyboard behaviour and accessibility |
| [MIGRATION_MAP.md](MIGRATION_MAP.md) | Current UI → keep / modify / replace / remove, superseded constraints, test-selector changes, SHR-106 order of work |
| [tokens/atepdf-tokens.json](tokens/atepdf-tokens.json) | Token source of truth (light, dark, brand, type, space, radius, size, elevation, motion, layer) |
| [tokens/atepdf-tokens.css](tokens/atepdf-tokens.css) | CSS custom-property mirror of the JSON |
| [brand/](brand/) | SVG masters: marks and app icons for direction A (approved) and the explored alternatives B and C |
| [mockups/index.html](mockups/index.html) | Implementation-oriented mockups of every required state, built only from the tokens (Light/Dark switch; `?only=<id>`, `?theme=dark`) |
| [mockups/png/](mockups/png/) | Static captures of the mockups for review without a browser |

The mockups are design references, not evidence of an implemented app. No application code, test or runtime asset is changed by SHR-105.
