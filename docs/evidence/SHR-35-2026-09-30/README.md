# SHR-35 evidence — pre-send privacy and consent contract (30 September 2026)

**Source:** `origin/main` `29f56ea919e73c12cdbd1c36f5f74cf37622347c`.  **Decision record:** [ADR 0012](../../adr/0012-pre-send-privacy-consent.md) (proposed, pending owner approval).

| File | Content |
|---|---|
| [consent-policy-cases.json](consent-policy-cases.json) | The 36 allow/deny cases from ADR 0012 section 12, with a synthetic baseline state and evaluation order, for SHR-36/37 tests to consume. Synthetic identifiers and hosts only (`*.example.test`). The `test_purpose` approved purpose exists only in this fixture; the real v1 approved-purpose list is empty. |

## Validation performed

- Source inspection of the planner DTO, projection, gateway/provider transport, native transport, SHR-71 guards, logging and evidence writers (ADR 0012 section 2).
- Existing regression suites, no provider calls, no network beyond loopback test sockets. Node `v24.19.0`, using the locked, already installed (git-ignored) `node_modules`; nothing was installed or upgraded:

  ```
  node --import tsx --test tests/regressions/planner.test.ts tests/regressions/protocol-conformance.test.ts \
    tests/regressions/local-workflow.test.ts tests/regressions/native-planner.test.ts tests/regressions/workspace-persistence.test.ts
  ```

  Result: **73 passed, 0 failed.**
- Consistency check: the case IDs in the JSON are identical, and in the same order, as the ADR section 12 table.

No live traffic, provider configuration, Terms acceptance, real document or credential was used. No runtime behaviour or test changed.
