# UI evidence and owner changes

The approved brand board and iPhone/iPad/desktop references were viewed before implementation. Name and rounded blue/violet/pink 8 come only from brand/APPROVED_BRAND.md and the supplied crops. Brand-board mock-ups, editing features, sidebar and splash screen were not adopted.

| Reference property | Implementation / evidence |
| --- | --- |
| Quiet white workspace, dark navy type | Preserved in shared RN screen; desktop-empty.png and phone.png |
| Rounded blue primary controls | Choose files, send and Save PDF; native Pressable controls with disabled/focus states |
| Three quick-action pills | Merge, Compress, Make searchable feed the conversation; calmer neutral template styling under owner-approved assistant-ui refinement |
| Dashed pale-blue drop area with paper illustration | Kept on the empty state; new generated paper asset, no recreation of brand-board UI |
| Chat composer and results | Owner's latest direction: every workflow and its results live in chat; composer fixed below scrollable thread; inline read-only preview |

Owner approved one React Native / Expo interface, superseding the original separate web/native control stack. Owner subsequently requested chat for all workflows and results (ADR 0002). Original mock-up geometry was adjusted accordingly: attachment bubbles, local-engine progress, inline quality/discard clarification, persistent result cards and result-specific save receipts. No tool sidebar.

Visual checks: Chrome screenshots at 1440×1086, 390×844, 320×568, 820×1180, 1180×820 and a 390×530 reduced-height keyboard proxy. The 320px badge initially overflowed; shortened visible text to “On-device” while preserving its full accessible label. Rechecked horizontal overflow. Touch targets use at least 44px, keyboard send respects Shift+Enter/composition, preview controls expose labels and progress uses live regions. These are implementation checks, not a full screen-reader or physical keyboard certification.

PDF visual checks: all four final chain pages rendered independently and viewed. OCR rendered pixels match the pre-OCR PDF on every page. Compression changed only the deliberately image-heavy fourth page, with a mean absolute RGB channel difference below 1/255 at 1× rendering; scan and digital text remained visibly readable. This is bounded synthetic quality evidence, not a general perceptual guarantee. See pdf-visual-metrics.json and chain-final-page-*.png.

Remaining: physical Apple-device safe areas, accessibility text scaling/screen readers, device keyboard behavior and a broader scan/compression visual corpus. Android is deferred. Pixel crops are approved source artwork, not final vector master assets or submission icons.

2026-09-28 follow-up: ADR 0003 adopts official assistant-ui native thread/composer/message recipes with atepdf brand tokens. Native-template scrolling and message actions replace the custom shell. Results, quality confirmation and masked key entry remain in the conversation. No tool sidebar. The small-screen audit found horizontal overflow and an overlapping empty state; shorter badge text, flexible pills and a scrollable welcome fix both. Layout tests now check vertical separation as well as horizontal overflow. Original approved iPad and name/logo board were viewed again; only name/logo were taken from the brand board. Owner-requested file-size policy text is now “PDF · processed on your device”.

Latest owner refinement: remove the result card's “Keep going with this result” row and hard-coded “Remove page 2” shortcut. The current result now says **“Tell me what you’d like to do next.”** Follow-up page removal is entered through the conversation; Preview, Save PDF and Undo remain result controls. The browser workflow test now exercises that conversational follow-up on large files as well.


2026-09-28 chat refinement: current-source audit captured a crowded footer and partially hidden result at 1280×720. Connection/new-chat controls now sit in the compact header; the footer keeps only quick actions and focused-result context. Results use one primary Save, secondary Preview and quiet Undo. The preview has a bounded stable page surface with fit/zoom and 44-point controls. A Latest message control uses the existing assistant-ui list, and run-start animation is disabled to avoid short-job scrolling races. The approved artwork, brand, white/navy/blue palette and no-sidebar layout remain. Phone, compact, tablet and reduced-height keyboard screenshots were inspected again; full-page preview and result actions remain usable.

Processing now shows the actual operation, engine status and optional actual step list. Only the decorative icon pulses, using the upstream Reduced Motion hook; changing status text stays readable. Step completion requires independent validation, and a canceled/late callback cannot claim completion. Web tests hold a real local OCR asset and verify Stop, retained result bytes, disabled conflicting execution and static decoration under Reduced Motion. Native and browser final evidence are in the session report.

Owner explicitly removed repeated AI transmission/plan approval cards and asked for one seamless unit. Send now runs privacy-checked planning and fully validated safe local copy operations in the same conversation. Missing choices and actual balanced-compression quality choices remain inline. See ADR0006 and FRONTEND_REFINEMENT_2026-09-28.md. No award, broad accessibility certification or release claim is made.
