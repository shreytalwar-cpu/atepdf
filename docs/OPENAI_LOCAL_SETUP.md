# Optional OpenAI planning — local development setup

Mac/iOS Simulator: after configuring this browser gateway, open **OpenAI connection → Create pairing code → Copy pairing code**. In the native app open **AI connection**, paste the code and choose **Connect this app**. The code is single-use and expires in five minutes. The native bearer remains only in Swift memory and expires within eight hours; quit/server restart requires re-pairing. Both clients share the same saved model and request allowance. Pairing makes no OpenAI call and adds no paid requests. Physical iOS requires a separately authenticated HTTPS service and is not enabled by this local setup.

Open http://localhost:3211 and select **OpenAI connection** in the header. The assistant presents a separate masked key field inside the conversation. Save an approved development project key there. Do not paste it into the normal chat composer or send it to an agent.

Key entry sends only to the loopback server on this computer. The credential is written exclusively to `.local/openai-key` (0600 inside a 0700 directory), ignored by Git. It is not returned by status, put in chat messages, stored in browser storage or bundled into web/native code. Existing credentials cannot be overwritten. This is restricted local file storage, not a claim of encrypted-at-rest keychain storage. The key is not validated with OpenAI during save. Paid planning initially stays disabled with zero approved requests.

Alternative owner-operated masked terminal entry:

```sh
python3 scripts/connect-openai.py
```

After explicit bounded spending authority, the owner can approve 1–20 requests in an interactive terminal:

```sh
python3 scripts/approve-planner.py 2
```

The script requires typing APPROVE. It sets a request allowance, not an OpenAI account dollar cap. Each attempt reserves/decrements the allowance before the provider call, including failed/cancelled calls. One request at a time across local hosts; no retries, a 30-second provider deadline and a 24 KB instruction request-body limit. atepdf does not set `max_output_tokens`; the model’s own output limit applies. A process crash leaves a lock and fails closed; inspect a stale lock only after verifying no request/server uses it. This development gateway must not be deployed as a public multi-user backend.

Current model is `gpt-6-luna`, the official Responses API ID selected by the owner. The earlier two live tests used GPT-5.6 Luna and succeeded: merge and follow-up physical page removal. Each returned a complete validated plan; processing and independent PDF validation happened locally. That two-request allowance was exhausted. The owner subsequently requested AI enabled after reporting account credit; a new allowance of 20 requests was enabled. Changing the model preserves the current remaining allowance; it does not create another 20 requests or make a model call. Production availability and actual invoiced cost remain unverified. Historical evidence: `evidence/planner/live-test.json` and `evidence/native/planner-budget-current.json`.

Sending an AI instruction now submits its privacy-checked text directly; the owner removed the repeated transmission confirmation (ADR 0006). Known filenames become generated opaque references. The outbound DTO has only instruction, opaque IDs, page counts/sizes, selection/focus, language and capability context. No PDF bytes, previews, OCR text, paths, passwords, checksums or full transcript. Detectors reject known document snippets and suspicious secret/path/encoded-data forms. They are conservative checks, not a universal arbitrary-PII detector: write operations, not pasted document text or secrets. The privacy explanation remains available in the header.

AI SDK Responses requests use `store:false`, strict tool schemas, no file endpoints and no telemetry. `store:false` is not a claim of OpenAI zero data retention. When AI is enabled, typed PDF requests and quick-action buttons send only the instruction and anonymous metadata to the model. Its mutually exclusive tools propose a local PDF workflow, reply to a basic product question, or request undo. The provider never executes a PDF tool: complete schema- and semantics-validated plans run in the current client's local engines. When AI is disabled, known quick actions still work locally. Missing choices and actual image-quality changes still require a relevant choice. Progress/result facts come from the local engines. Stale file revisions, cancellation, partial/invalid output and duplicate requests cannot commit results.

Routine automated tests use explicit mocked HTTP responses and dummy keys in temporary configuration directories. The separate `tests/live/planner.live.ts` runner is excluded from normal tests and was invoked only with the owner-approved two-call allowance. There is no simulated production planner or automatically enabled paid request path. Physical native credential transport/authentication and production abuse controls remain unimplemented.
