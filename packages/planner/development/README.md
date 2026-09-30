# Named development recipient (owner G1)

`recipient.ts` is an explicit development-only entry outside the normal gateway,
web and native dependency graphs. It has no environment switch and is not imported
by production authority. Release graph tests verify exclusion. The name is
`openai-development`; model selection remains Luna.

The record honestly marks unverified development-account disclosures incomplete.
An acknowledgement is still required and cannot override those missing facts.
This closeout is not authority to inspect saved credentials, make a paid request,
invent account settings or ship the SHR-37 disclosure UI. Production authority
remains an empty registry with no acknowledgement or C purposes.

Offline evals and transport canaries use a separately identified synthetic record,
an explicit matching acknowledgement and the same `OutboundGate`, with a mocked
SDK writer or owned loopback server. Those passes are development orchestration
evidence, not proof of a live hosted route. Completing the real record and the
acknowledgement interface remains a gate before live development use.
