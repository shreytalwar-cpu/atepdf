# 11 | Edge-case decisions and risk register

## Behavioural decisions
| Situation | Required behaviour |
|---|---|
| User types before adding files | Keep draft; request files without losing instruction. |
| Merge with one file | Ask for another file, no paid AI replan loop. |
| Two identical filenames | Local cards distinguish them; model sees opaque refs. |
| Duplicate input attachment | Do not silently deduplicate; clarify only where intent is ambiguous. |
| File selection changes during planning | Mark response stale; never execute on mismatched refs/order. |
| Page labels differ from physical indexes | Default to physical pages; clarify ambiguous printed labels. |
| Remove all pages | Reject safely. |
| Page selection references future/invalid count | Validate against immediate upstream output; stop if impossible. |
| Several result files, “make this smaller” | Use explicit focus; otherwise ask which result. |
| “Use originals” after multiple operations | Bind original lineage, not most recent output. |
| Target compression unattainable | Return best verified candidate/actual size and clear next choice. |
| Already compressed file | No fake gain or bigger result passed off as improvement. |
| OCR no improvement/low confidence | Report limitations locally, keep original and avoid duplicate layers. |
| OCR language unavailable | Offer only tested language options or unsupported outcome. |
| Password typed in composer | Intercept where detected; move to local secure entry; do not knowingly transmit credentials. |
| Protected file without password | Ask through secure local field; no password cracking. |
| Signed/form-heavy/complex file | Read-only preflight; reject unsafe transformation rather than silently break it. |
| Request asks to email/upload result | Out of scope for autonomous execution; offer user-controlled system Share. |
| Request asks for edit/sign/annotate/redact | One concise unsupported response; no editor launch. |
| Request asks to summarise/translate content | Not supported by the privacy-preserving core planner; no document text upload. |
| Close tab or kill app | Preserve originals; restore only data actually retained; explain missing handles/reimport needs. |
| Save picker cancelled | Result remains Ready; never claim Saved. |
| Output filename is a path/URL | Sanitize local basename, ignore model paths, never fetch the URL. |
| Independent batch partly fails | Report failed members and export successful ones, not a misleading all-done state. |
| Coupled merge input fails | No silent omission; ask user before proceeding with fewer inputs. |
| Cloud unavailable | Local actions/compiled recipes remain; draft stays available. |
| Memory cap reached | Cancel safely, free resources, offer smaller supported batch. |

## Risk register
| Risk | Why it matters | Mitigation / release gate |
|---|---|---|
| UI becomes tool-heavy | Defeats the product thesis. | Approved design/state/fidelity gate; one-screen baseline. |
| Browser compression weak | Central shortcut disappoints. | Early real corpus spike; honest target-not-met; tested image optimisation. |
| Searchable OCR incomplete | Text recognition alone is insufficient. | Correct layer geometry/encoding + independent search verification. |
| Four-platform drift | Same words produce different results. | Shared schema/semantics/corpus and live capability matrix. |
| Unreliable Android writer | Rendering does not imply transformation. | Prove writer/NDK adapter early, licence and ABI tests. |
| User-data leakage | Breaks local-processing trust. | DTO separation, strict egress tests, no document endpoints. |
| Anonymous AI abuse | Cheap per-call cost can still accumulate. | Guest limits, validation, spend caps and circuit breaker. |
| Third-party engine licence | Could block commercial distribution. | SBOM/transitive audit and approved licences before shipping. |
| Fragile large-file experience | Phones/browser tabs crash. | Page-at-a-time work, memory estimates, hard limits, real-device tests. |
| Preserving complex PDFs | Loss of forms/tags/links/signatures. | Preflight, preservation tests and safe refusal. |
| Feature promises outpace code | Causes support/refund burden. | Marketing from tested capability registry only. |
| Billing/auth consumes V1 effort | Delays the differentiating experience. | Build real local slice first; staged sandbox commerce later. |

## Owner-controlled decisions still needed before public release
Final product name/domain, actual prices/quotas, paid SDK licence purchase if proposed, publisher/merchant identity, production credentials and release authority. These do not block local prototypes or contract/UI/engine work.

## Non-negotiable scope discipline
No model-download programme, mandatory local LLM, generic document chat, editing/signing suite, cloud document store, six-product framework build or enterprise workflow dashboard. Additions must improve the approved file-to-result journey, not merely increase the feature count.
