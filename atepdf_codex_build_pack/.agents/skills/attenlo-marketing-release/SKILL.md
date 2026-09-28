---
name: attenlo-marketing-release
description: Prepare and verify an atepdf campaign launch packet with evidence, approved assets, consent, account scope and a bounded budget, without authorising execution.
---

Read `marketing/ops/AUTHORITY.md`, `LAUNCH_AND_DISCOVERY.md` and the relevant tests. Require real app/billing/measurement evidence plus authenticated owner approval binding the exact action and versions. Treat reference JSON and passing local checks as non-authoritative. Unknown account, expired rights/approval, privacy issue or unsupported operation blocks release. If a required external write is absent, report it rather than assuming connector capability.

Resolve document paths from the actual handoff location. This is an original project skill, not a third-party integration or an installed scheduler.
