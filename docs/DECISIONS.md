# Decisions and precedence

Canonical index at the 29 September 2026 freeze. No new product choices are made here.

1. The latest explicit owner instruction controls. The 29 September scoped exception permits only making existing explicit local PDF quick actions independent of AI, its regressions, required local verification and concise documentation. All unrelated development and the earlier build/polish goal remain frozen. See [the scoped checkpoint](IMPLEMENTATION_STATUS.md#29-september-scoped-quick-action-correction).
2. This is a fresh independent atepdf repository. Old Attenlo remains read-only reference, never a dependency or write target. No production identity/entitlement/customer migration is inherited.
3. The original v7 handoff remains unchanged. Its precedence/design/privacy/commercial rules apply except where later owner-approved decisions supersede them.
4. Existing [ADRs](adr/) record the stack and workflow decisions below. Historical status reports retain their own date/source scope; a later pass does not validate an earlier or different binary automatically.
5. [PROTOTYPE_V0_AUDIT.md](PROTOTYPE_V0_AUDIT.md) is the current factual audit index. [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) remains the retained M/F/G task mapping, with its execution instructions paused.

| ADR | Recorded decision | Consequence |
|---|---|---|
| 0001 | React Native/Expo shared interface | Supersedes initial Next web UI and separate native UI plan; Next remains optional host |
| 0002 | Conversational workflow | Instructions, choices, progress, results, preview/save/undo stay in chat |
| 0003 | Official assistant-ui across active platforms | Supersedes “no assistant-ui initially”; no assistant-ui cloud/file uploader |
| 0004 | Remove arbitrary PDF byte caps | No 20 MB upload limit; resource/feature bounds remain |
| 0005 | Prioritize Apple and web | Android deferred, source preserved |
| 0006 | Seamless AI submission | Ordinary Send needs no repeated planning-warning card; explicit quick actions now compile locally under the scoped owner exception; meaningful quality choices remain |
| 0007 | GPT-6 Luna and complete tool selection | Remove app's 2,000-output-token cap; local PDF/undo/chat-reply tools; bounded request allowance still applies |
| 0008 | Development native pairing | One-use expiring pairing and memory-only bearer; not production account auth |
| 0009 | Explicit private TLS beta companion | Pinned local-network native transport; not a hosted production backend |

The owner selected everyday users doing occasional PDF tasks. Approved brand is lowercase atepdf and the rounded gradient 8, name/logo only from the brand board. Local PDF processing, immutable originals, independent validation, no partial plan execution and no cloud processing fallback remain binding.

## Open decision register

No owner decision currently settles production auth/key custody, session persistence/recovery, broad PDF feature support, browser/OS support floors, offline install behavior, final native distribution/signing, accessibility acceptance, analytics, seller/purchases/pricing or public deployment. Recommendations in the audit are proposals requiring prioritization, not implicit approval.
