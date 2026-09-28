---
name: attenlo-chat-integration
description: Integrate the selected shadcn chatbot primitives and AI SDK with atepdf's local PDF controller; use for composer, planner transport, tool/results and cancellation work.
---

# atepdf chat integration
Resolve the final handoff folder. Read `STACK_DECISION.md`, `implementation/SHADCN_INTEGRATION.md`, `DESIGN.md` and the applicable contracts. Inspect the current repo and installed component versions before changing dependencies.

Use shadcn/ui + AI SDK and selective minimal-template reuse. Do not install assistant-ui or switch away from the selected new native UI frameworks without the documented evidence/approval gate. Preserve the approved one-screen interface.

Files/bytes and local job truth stay outside the chat message transport. Explicitly allowlist outbound planner fields. No default attachment base64, document buckets, arbitrary tools or auto model narration after successful local operations. Validate the complete bound plan before worker execution. Ensure remounts, duplicate events and stale requests cannot apply a job twice. Model cancellation and local-worker cancellation are different states.

Run the stack acceptance cases in the actual app, compare UI screenshots and inspect outgoing traffic with synthetic canaries. Record real package versions, commands, evidence and skipped tests. Handoff validators do not establish app correctness.
