# Screen and state inventory
These 32 states are not 32 onboarding pages. Most are variants of the same workspace or secondary sheet. P0 is required before commercial launch; P1 is required before advertising its benefit; P2 is a disabled later experiment.

| ID | State | Trigger | Required behaviour | Priority |
|---|---|---|---|---|
| UI-01 | Fresh workspace | Launch | Original approved empty state | P0 |
| UI-02 | Sample recipe | User taps Try a sample | Real local synthetic demo, not fake AI | P0 |
| UI-03 | File import cancelled/denied | Picker result | Retain draft; selected scope only | P0 |
| UI-04 | Files loaded | Files added | Compact cards and composer | P0 |
| UI-05 | Cloud AI consent | First remote instruction | Provider and boundary, accept/refuse | P0 |
| UI-06 | Clarification | Ambiguous supported command | One relevant choice, no debit | P0 |
| UI-07 | Processing / cancel | Validated plan | Real progress, originals retained | P0 |
| UI-08 | Result / follow-up | Local validation complete | Measured facts, preview/save/share | P0 |
| UI-09 | Preview / export cancelled | User requests output | Read-only preview; result remains ready | P0 |
| UI-10 | Free quota exhausted | Next new cloud job | Reset date + local alternatives + Pro | P0 |
| UI-11 | Contextual Pro offer | User Pro intent | Two live-priced plans, free exit, restore | P0 |
| UI-12 | Product metadata unavailable | Store config/network issue | Disable purchase, preserve free work | P0 |
| UI-13 | Checkout cancelled / declined | Provider result | No extra debit or duplicate request | P0 |
| UI-14 | Purchase pending / verifying | Provider result | Retain work; no second charge | P0 |
| UI-15 | Purchase verified / safe resume | Server entitlement | Revalidate local manifest then continue | P0 |
| UI-16 | Restore no match / conflict / success | User restore | Explicit account-safe resolution | P0 |
| UI-17 | Account link / sign-in | Cross-device user intent | No document sync claim | P0 |
| UI-18 | My plan / manage billing | Secondary menu | Allowance and renewal/expiry separately | P0 |
| UI-19 | Cancelled but entitled | Provider state | Access through verified expiry | P0 |
| UI-20 | Grace / hold / expired / revoked | Provider state | Correct access, no document deletion | P0 |
| UI-21 | Pro allowance exhausted | Paying user usage limit | No buy-Pro-again offer | P0 |
| UI-22 | Offline / unsupported / resource limit | Preflight/engine error | Local alternatives, no hidden cloud | P0 |
| UI-23 | Partial batch / quota repair | Execution failure | Explicit subset and idempotent recovery | P0 |
| UI-24 | Saved recipes / repeat job | Recurring use | Fresh local selection, no unnecessary AI | P1 |
| UI-25 | History / missing handle | Return session | Only real persisted outputs, reimport | P0 |
| UI-26 | Help / redacted diagnostics | Report problem | No attached documents or raw prompts | P0 |
| UI-27 | Privacy / withdraw / clear local data | Settings | Separate data/consent controls | P0 |
| UI-28 | Account deletion | Account action | Provider billing distinction; no barriers | P0 |
| UI-29 | System review / share app | Later eligible success | No sentiment gate or reward | P1 |
| UI-30 | Optional reminders / education | User-specific request | Consent and reliable delivery only | P2 |
| UI-31 | Provider-backed trial | Approved future experiment | Eligibility and exact charge timeline | P2 |
| UI-32 | Browser-to-app handoff | User requests app | Link entitlement; files reselected locally | P1 |

For every relevant state test iPhone compact/large text/keyboard, iPad split view, Android phone/tablet, web narrow/wide and Mac pointer/keyboard. Keep one primary focus. Test modal focus trapping, Escape/Back, screen-reader labels, contrast, selected-state labels, no reliance on colour alone and reduced motion. Do not rasterize UI text or copy third-party app screenshots as the interface.

Before native-to-web handoff, preserve only a permitted minimal purchase/session identifier, never a document in a URL. Re-select the file locally on another device; shared entitlement is not cross-device PDF storage.
