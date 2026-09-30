# SHR-35 evidence — pre-send privacy and consent contract (30 September 2026)

**Source:** `origin/main` `29f56ea919e73c12cdbd1c36f5f74cf37622347c`.  **Decision record:** [ADR 0012](../../adr/0012-pre-send-privacy-consent.md) (approved by Shrey on 30 September 2026; PRIV-5 without an email-address warning).

| File | Content |
|---|---|
| [consent-policy-cases.json](consent-policy-cases.json) | The 40 allow/deny cases from ADR 0012 section 12, with a synthetic baseline state, evaluation order and the approved policy constants (grant TTL, size buckets, warning kinds including the no-warning rule for ordinary email addresses), for SHR-36/37 tests to consume. Synthetic identifiers and hosts only (`*.example.test`). The `test_purpose` approved purpose exists only in this fixture; the real v1 approved-purpose list is empty. |

## Validation performed

- Source inspection of the planner DTO, projection, gateway/provider transport, native transport, SHR-71 guards, logging and evidence writers (ADR 0012 section 2).
- Existing regression suites, no provider calls, no network beyond loopback test sockets. Node `v24.19.0`, using the locked, already installed (git-ignored) `node_modules`; nothing was installed or upgraded:

  ```
  node --import tsx --test tests/regressions/planner.test.ts tests/regressions/protocol-conformance.test.ts \
    tests/regressions/local-workflow.test.ts tests/regressions/native-planner.test.ts tests/regressions/workspace-persistence.test.ts
  ```

  Result: **73 passed, 0 failed**, both on `29f56ea` and again after the merge.
- Consistency check (scratch script, not committed), rerun after merging `origin/main` `37e9700`: **PASS**. It checks that:
  - the fixture case IDs are unique and identical, in order, to the ADR section 12 table;
  - every outcome and reason code is defined in the ADR;
  - every blocked case asserts zero outbound bytes;
  - the ADR and fixture both record approved status, the 5-minute TTL, an empty v1 purpose list and no email-address warning (P05);
  - PRIV-1 to PRIV-7 are marked approved;
  - the ADR's relative links and cited source paths resolve;
  - `DECISIONS.md` carries both the 0011 and 0012 rows and no conflict markers.

No live traffic, provider configuration, Terms acceptance, real document or credential was used. No runtime behaviour or test changed.
