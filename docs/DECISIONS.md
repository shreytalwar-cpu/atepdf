# Decisions and precedence

Updated 29 September 2026 for adoption of the owner-supplied [PRODUCT_V1.md](PRODUCT_V1.md). This is an authority/reconciliation index, not another specification or implementation authorization.

1. Latest explicit owner instructions control. The current task is documentation/context adoption only; the earlier quick-action bypass direction is superseded as product direction. No runtime reversion, new implementation or general audit is authorized.
2. For product intent, `PRODUCT_V1.md` is authoritative, followed by compatible architecture decisions, implementation guidance and historical handoffs. Its requirements describe the approved destination, not completed work. Applicable security/tool-use restrictions remain binding.
3. [AUDIT_PROTOTYPE_V0.md](AUDIT_PROTOTYPE_V0.md) and [PROTOTYPE_V0_AUDIT.md](PROTOTYPE_V0_AUDIT.md) remain unchanged evidence of their audited snapshot. [PRODUCT.md](PRODUCT.md) records implementation truth; [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) records subsequent evidence and retains M/F/G mappings. Neither overrides the approved target.
4. Existing [ADRs](adr/) and the original v7 handoff retain provenance. Incompatible product decisions are superseded as mapped below; their original wording is not fresh authority. Do not delete historical audits, evidence or handoffs.
5. Runtime-facing `AI_PRODUCT_KNOWLEDGE.md`, generated knowledge and tool descriptions must describe tested current capabilities, not the target. Specification IDs are requirement references, not invented Linear tickets.

Fresh independent atepdf repository; Attenlo remains read-only reference. No production identity/customer migration is inherited. Preserve the existing foundation, brand and layout; Mac-first is not permission for a rewrite. All implementation, external issues, spending and release require a separately bounded task.

## ADR status by subject

| ADR | Recorded decision | Consequence |
|---|---|---|
| 0001 | React Native/Expo shared interface | Supersedes initial Next web UI and separate native UI plan; Next remains optional host |
| 0002 | Conversational workflow | Instructions, choices, progress, results, preview/save/undo stay in chat |
| 0003 | Official assistant-ui across active platforms | Supersedes “no assistant-ui initially”; no assistant-ui cloud/file uploader |
| 0004 | Remove arbitrary PDF byte caps | No 20 MB upload limit; resource/feature bounds remain |
| 0005 | Prioritize Apple and web | Launch priority superseded by D-01/D-02: Mac first, both channels; preserve web/iPhone/iPad, Android deferred |
| 0006 | Seamless AI submission | Historical routine command consent; v1 PRIV-02–07 require disclosure and separate operation-specific content-transfer permission; quality choices remain |
| 0007 | GPT-6 Luna and complete tool selection | Intentional enabled-AI orchestration reaffirmed by D-04; specific production model/provider remains OPEN-09; development allowance is not v1 commercial quota |
| 0008 | Development native pairing | One-use expiring pairing and memory-only bearer; not production account auth |
| 0009 | Explicit private TLS beta companion | Pinned local-network native transport; not a hosted production backend |
| 0011 | Mac launch envelope (SHR-34) — **approved 30 September 2026** | macOS 14.0 minimum; Universal arm64 + x86_64 with Intel support conditional on real Intel runtime acceptance (Apple Silicon only is the fallback); 8 GB/16 GB internal hypotheses only, no public disk number until SHR-78; Mac idiom viable (UX acceptance in SHR-106/75); provisional wording "macOS 14 or later. Mac with Apple silicon or Intel processor."; Setapp an intended v1 channel (PRODUCT_V1 §4.2 updated; acceptance pending SHR-91). Settles OPEN-01's envelope; no project setting changed yet |
| 0012 | Pre-send privacy and operation-consent contract (SHR-35) — **approved 30 September 2026** (PRIV-1–7; PRIV-5 without an email-address warning) | Outbound fields classed H (instruction after local guards, bounded clarification, opaque refs, active-projection page counts, coarse size buckets; relay-only identity; versioned hosted disclosure), C (document/derived content, file names, exact sizes/metadata: single-use exact-payload grant, 5-minute TTL, plus an approved purpose; v1 purpose list empty) or N (never: passwords, keys, tokens, paths, device IDs). Incomplete provider/relay disclosure blocks transfer. Narrows 0006's no-per-send-confirmation to class H. Settles OPEN-08's policy; contract for SHR-36/37/79; nothing implemented |
| 0013 | Seller, direct payments and cross-channel account ownership (SHR-85) — **proposed, pending owner approval of SELL-1 to SELL-10** | One seller for App Store, direct and Setapp (entity vs individual awaits owner facts; no entity presumed); Paddle Billing (MoR) proposed for direct; guest-first, atePDF account (email one-time code) required only for direct purchase and cross-channel use, none in the Setapp build; server ledger mirrors Apple/Paddle/Setapp as sources of truth, no client self-assertion; App Store ↔ direct via linked account, Setapp isolated; no device cap, Family Sharing off; seller-neutral IDs with `seller_account_ref` on every purchase. Addresses OPEN-04 once approved; contract for SHR-86/87/88/89/91; nothing implemented, no account or Terms touched |

## Superseded direction and current-source gaps

| Earlier direction or unresolved statement | Approved target / disposition |
|---|---|
| Web/iPhone/iPad/Mac co-priority or browser-first acceptance | D-01/D-02 and MAC-01: Mac launches through both Mac App Store and direct distribution; other app launches cannot delay it. Preserve existing implementations; Android deferred. |
| Handoff deterministic quick-action bypass; latest local-bypass task | D-04 and CONV-01: enabled-AI quick-action orchestration is intentional. Do not independently bypass it. The previous task was implemented as uncommitted work and remains in the working tree; its objective is now superseded, not its historical evidence erased. Restoring routing requires a separate code task. |
| Treat enabled-provider failure as proof AI routing itself is defective | Routing and outage/recovery are separate. CONV-07/08 and OPEN-09 govern later decisions; no automatic fallback or quota policy is chosen here. |
| Optional developer-owned key/pairing as consumer product model | D-03/ARCH-03 require atePDF-supplied AI; existing key/gateway/pairing are prototype mechanisms, not production services. |
| Permanent blanket no-content-transfer product policy / routine Send consent as sufficient | PRIV-01–11 retain local-first defaults, no silent fallback and a strict operation-specific informed permission boundary for future content/derived-content transfers. Passwords never enter model context. Current exclusions remain; consent language alone authorizes no cloud-processing service or transmission. |
| Recovery, local understanding, 13 tools and conversational continuity undecided | D-10–12, Sections 6–11: approved requirements; current memory-only state, limited tools and context gaps remain implementation deficits. Protect/Unlock require secure local secret controls. |
| Old pricing/free-tier hypotheses, registration allowance, AI-only paid boundary or unlimited manual tools | D-07–09/BILL-01–10: limited guest experience, no registration top-up, paid monthly/annual Pro; exhaustion blocks new work but preserves access/export/recovery/deletion/privacy/subscription controls. Exact prices/allowances remain unapproved. Old numeric hypotheses are not defaults. |
| Subscription vs one-time model and AI cost ownership unresolved | Monthly/annual Pro and company-supplied AI are settled; lifetime/credit packs are excluded. Payment/account/channel implementations remain open. |
| Editing as an optional v1 expansion | D-17/Section 4.2: existing-text edits, added text, drawing, signatures, form filling, redaction and annotation creation are v2. Preserving existing structures is a distinct compatibility requirement. |
| Existing touch/mobile acceptance as launch evidence | Sections 13/16 require actual Mac acceptance. Historical browser/simulator/helper results retain their limits; no newly passed gate is claimed. |

## Approved v1 visual identity (SHR-105)

Owner-approved 30 September 2026, effective when PR #91 merges; the canonical record is [docs/design/](design/README.md). The redesign changes presentation only. Conversation-first, intentional AI routing (including quick actions), local execution, consent, secure input and every PRODUCT_V1 behaviour are unchanged.

| Decision | Outcome | Supersedes |
|---|---|---|
| OD-1 Logo/app icon | Folio Eight mark, Ink app icon | Raster gradient 8 in `APPROVED_BRAND.md` (build pack kept as history) |
| OD-2 Name casing | `atePDF` in prose and wordmark; `atePDF Pro` | Lowercase `atepdf` in `APPROVED_BRAND.md` / `brand.json` |
| OD-3 Dark mode | Ships at launch with light | MAC-04 "dark mode is not a launch gate unless separately approved" (this is that approval) |
| OD-4 Accent | Iris `#5646F0` / `#6354FF` | White/navy/blue incumbent palette |
| OD-5 Files panel | Right-hand panel, auto-shown ≥ 1120 pt | "No sidebar or permanent preview rail" |
| OD-6 Catalyst idiom | Mac idiom, pending engineering confirmation in SHR-106/75 | iPad idiom (77% scaling) |
| OD-7 Settings | In-window sheet | — (no separate Settings window in v1) |

MAC-04's "preserve the 8-based identity and conversational layout" is honoured: the new mark is an 8 and the single conversation layout remains. Its "fix observed usability problems, not the entire visual direction" is superseded by the SHR-26 → SHR-105/106 redesign track. Detailed superseded UI rules are X-1–X-18 in [MIGRATION_MAP.md](design/MIGRATION_MAP.md).

## Remaining decisions and reconciliation limits

[Section 19](PRODUCT_V1.md#19-open-decisions-and-bounded-investigations), OPEN-01–10, is the single open-decision register: minimum Mac/hardware, allowance/accounting, prices/Pro limits, payment/seller/account/channel design, persistence/retention, local-understanding method, OCR/formats/encryption/compatibility, consent UX, production provider/infrastructure/outage policy, updater/territory/privacy/analytics/support details. Do not choose defaults to close a document.

Known source/target mismatch: explicit buttons currently bypass AI because of the preserved prior uncommitted change; the supplied specification describes that task as withdrawn. Adoption records its supersession but does not pretend the code was reverted. Other implementation gaps remain as documented. Historical handoffs, ADRs and audit findings intentionally retain old wording; this register and `PRODUCT_V1.md` settle their product authority. Existing runtime knowledge remains unchanged, not promoted to v1 claims. No application behavior, test, audit finding or acceptance status changes in this adoption task.
