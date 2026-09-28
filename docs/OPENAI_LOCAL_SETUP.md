# Optional OpenAI planning — local development setup

Open http://localhost:3211 and select **OpenAI connection** below the chat box. The assistant presents a separate masked key field inside the conversation. Save an approved development project key there. Do not paste it into the normal chat composer or send it to an agent.

Key entry sends only to the loopback server on this computer. The credential is written exclusively to `.local/openai-key` (0600 inside a 0700 directory), ignored by Git. It is not returned by status, put in chat messages, stored in browser storage or bundled into web/native code. Existing credentials cannot be overwritten. This is restricted local file storage, not a claim of encrypted-at-rest keychain storage. The key is not validated with OpenAI during save. Paid planning initially stays disabled with zero approved requests.

Alternative owner-operated masked terminal entry:

```sh
python3 scripts/connect-openai.py
```

After explicit bounded spending authority, the owner can approve 1–20 requests in an interactive terminal:

```sh
python3 scripts/approve-planner.py 2
```

The script requires typing APPROVE. It sets a request allowance, not an OpenAI account dollar cap. Each attempt reserves/decrements the allowance before the provider call, including failed/cancelled calls. One request at a time across local hosts; no retries, a 30-second provider deadline, 24 KB request-body limit and 2,000 output-token cap. A process crash leaves a lock and fails closed; inspect a stale lock only after verifying no request/server uses it. This development gateway must not be deployed as a public multi-user backend.

Current candidate model is `gpt-5.6-luna`, from the official model documentation reviewed for this slice. After the owner saved a key and explicitly approved two test calls, both live calls succeeded: merge and follow-up physical page removal. Each returned a complete validated plan; processing and independent PDF validation happened locally. The two-request allowance is now exhausted and planning is disabled. No retries or further paid calls were made. This establishes access for the tested development project; production availability and actual invoiced cost remain unverified. Evidence: `evidence/planner/live-test.json`.

For each AI instruction, atepdf first shows exactly the sanitized text and describes the allowed metadata before sending. Known filenames become generated opaque references. The outbound DTO has only instruction, opaque IDs, page counts/sizes, selection/focus, language and capability context. No PDF bytes, previews, OCR text, paths, passwords, checksums or full transcript. Detectors reject known document snippets and suspicious secret/path/encoded-data forms. They are conservative checks, not a universal arbitrary-PII detector: write operations, not pasted document text or secrets.

AI SDK Responses requests use `store:false`, strict structured output, no tools, no file endpoints and no telemetry. `store:false` is not a claim of OpenAI zero data retention. Local quick actions never contact the planner. Complete schema- and semantics-validated plans are confirmed before local execution; progress/result facts come from the local engines. Declines, stale file revisions, cancellation, partial/invalid output and duplicate requests cannot commit results.

Routine automated tests use explicit mocked HTTP responses and dummy keys in temporary configuration directories. The separate `tests/live/planner.live.ts` runner is excluded from normal tests and was invoked only with the owner-approved two-call allowance. There is no simulated production planner or automatically enabled paid request path. Physical native credential transport/authentication and production abuse controls remain unimplemented.
