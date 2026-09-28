# UI evidence and owner changes

The approved brand board and iPhone/iPad/desktop references were viewed before implementation. Name and rounded blue/violet/pink 8 come only from brand/APPROVED_BRAND.md and the supplied crops. Brand-board mock-ups, editing features, sidebar and splash screen were not adopted.

| Reference property | Implementation / evidence |
| --- | --- |
| Quiet white workspace, dark navy type | Preserved in shared RN screen; desktop-empty.png and phone.png |
| Rounded blue primary controls | Choose files, send and Save PDF; native Pressable controls with disabled/focus states |
| Pastel quick-action pills | Merge, Compress, Make searchable feed the conversation |
| Dashed pale-blue drop area with paper illustration | Kept on the empty state; new generated paper asset, no recreation of brand-board UI |
| Chat composer and results | Owner's latest direction: every workflow and its results live in chat; composer fixed below scrollable thread; inline read-only preview |

Owner approved one React Native / Expo interface, superseding the original separate web/native control stack. Owner subsequently requested chat for all workflows and results (ADR 0002). Original mock-up geometry was adjusted accordingly: attachment bubbles, local-engine progress, inline quality/discard clarification, persistent result cards and result-specific save receipts. No tool sidebar.

Visual checks: Chrome screenshots at 1440×1086, 390×844, 320×568, 820×1180, 1180×820 and a 390×530 reduced-height keyboard proxy. The 320px badge initially overflowed; shortened visible text to “On-device” while preserving its full accessible label. Rechecked horizontal overflow. Touch targets use at least 44px, keyboard send respects Shift+Enter/composition, preview controls expose labels and progress uses live regions. These are implementation checks, not a full screen-reader or physical keyboard certification.

PDF visual checks: all four final chain pages rendered independently and viewed. OCR rendered pixels match the pre-OCR PDF on every page. Compression changed only the deliberately image-heavy fourth page, with a mean absolute RGB channel difference below 1/255 at 1× rendering; scan and digital text remained visibly readable. This is bounded synthetic quality evidence, not a general perceptual guarantee. See pdf-visual-metrics.json and chain-final-page-*.png.

Remaining: physical iOS/Android safe areas, accessibility text scaling/screen readers, device keyboard behavior, native PDF rendering, broader scan/compression visual corpus. Pixel crops are approved source artwork, not final vector master assets.
