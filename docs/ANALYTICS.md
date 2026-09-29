# Analytics and logging

Frozen source record, 29 September 2026. No analytics provider, customer event pipeline, advertising SDK or application analytics integration was found on the active source paths. Expo and Next launch/build commands generally disable their framework telemetry. This does not prove every external service or host collects no operational records.

## What exists

- In-memory UI activity and local output facts are functional state, not analytics events.
- Planner configuration stores a private local key and bounded request allowance; pairing tracks temporary credentials. These are development authentication/accounting mechanisms, not customer usage billing.
- Local beta launcher writes private process/configuration/status artifacts and a server log. Test scripts produce local screenshots, saved synthetic PDFs and diagnostics under evidence/build paths.
- Historical checked-in evidence contains local machine paths and test screenshots. Treat repository/evidence publication as a separate privacy review; “no customer analytics” does not make all development artifacts public-safe.
- Provider instructions and anonymous file metadata are network requests. The repository cannot prove provider-side logging/retention by itself.

## Approved learning direction and unresolved implementation

[PRODUCT_V1.md Section 17](PRODUCT_V1.md#17-learning-and-diagnostics), MEASURE-01–04, defines the approved learning direction and separation of necessary service metering from optional analytics. It does not activate telemetry, approve a vendor or authorize participant outreach. Historical absence of analytics below is implementation truth, not absence of v1 learning requirements.

No product analytics requirements, event schema, consent/retention policy, crash-reporting service, production log redaction gate or deletion policy is implemented. Do not add one under the assumption that analytics is mandatory. First decide what evidence is needed, whether local/manual measurements suffice and what collection, if any, the owner approves.

Prohibited telemetry includes PDF bytes/previews/OCR text, filenames, paths, passwords, secrets and local checksums. See [PRIVACY.md](PRIVACY.md) and [the security/privacy audit](audit/SECURITY_PRIVACY_AI_COMMERCE_AUDIT.md). No analytics activation is authorized.
