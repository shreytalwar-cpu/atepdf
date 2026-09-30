# SHR-47 — matrix source-identity follow-up

Latest tested source: **74b3accd98872add9d317744470094a2f4336fe8**. The initial [handoff evidence](../README.md), native evidence and all raw logs remain unchanged.

The existing SonarCloud check on PR #97 flagged the matrix's `execFileSync('git', ...)` source-identity lookup at line 228: Git was resolved through inherited PATH. That invocation already existed on baseline main; changing the schema version touched its line. The narrow follow-up binds this Mac/Linux verification runner to the existing **/usr/bin/git**, avoiding PATH selection. A checkout without that system Git reports the missing prerequisite; no alternate executable is guessed or installed. Application code, PDF engines, guards, structural expectations, test assertions, native code and outputs are unchanged. This is not a broader security audit or an auto-review.

| Verification at 74b3acc | Result |
| --- | --- |
| Focused gate/matrix/corpus/workflow/admission/controller suite | **62/62 passed**, zero skips |
| Full regressions | **142/142 passed**, zero skips |
| Compatibility/shared-universal/web TypeScript | All **0** exit codes |
| Actual browser matrix and schema v2 | **49/57 executed**, unchanged 27 supported / 16 safely rejected / 3 failed / 3 unverified / 1 unimplemented / 7 not run |
| Saved independent reopening / production receipts | **30** saved PDFs reopened; **13** complete receipts, **12** in supported cases |

JSON result records preserve exact commands and source identity; `source-identity.json` verifies every previously measured source file remains byte-identical except the one runner line. The **16/16 Apple gate tests**, native helper/chain, Catalyst/iOS-simulator engine compilation and web/iOS export results remain valid for their explicitly recorded, unchanged source files. They were not reclassified as newly executed here. The full Mac app Pods blocker, absent Android SDK, interactive-native limitations, existing compatibility findings and SHR-48 visual/OCR scope remain as recorded in the original handoff.

The initial check output is retained in `initial-sonar-check.json`. No SonarCloud suppression, quality-gate setting, unrelated finding or manual review was changed. Final remote check status is recorded in the PR/Linear handoff.
