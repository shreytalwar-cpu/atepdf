# ADR 0003 — assistant-ui across platforms

Accepted by the owner on 2026-09-28 in this conversation: “Use assistant-ui across platforms”. This supersedes the v7 pack's earlier “no assistant-ui initially” and the temporary shadcn web-only discussion. ADR 0001's single React Native/Expo interface and ADR 0002's conversation-based PDF workflows remain in force.

Use the official `@assistant-ui/react-native` kit, its native registry thread/composer/message recipes and Uniwind, with the external-store runtime. Web, iOS and Android compile the same screen. The optional Next host serves the Expo-generated web interface; it does not maintain a second React DOM chat shell.

The external-store runtime owns composer and thread interaction. The independent atepdf controller remains the sole local job executor. Runtime messages contain text and an opaque entry ID; file bytes, inspection text, names, checksums, local result objects and secrets are never automatically serialized into a model conversation. Local artifact/file cards are host slots. No attachment upload adapter, assistant-cloud configuration, generic tools, auto narration, model-triggered retry, document bucket or analytics service is enabled.

The official kit currently ships native version 0.1.44. Source and licence evidence are in ../upstream/assistant-ui.md. The kit is young; native compilation is evidence of bundle compatibility, not proof of device behavior. F09 native PDF adapters remain separate work. Existing retained M/F/G tasks are updated, not duplicated.
