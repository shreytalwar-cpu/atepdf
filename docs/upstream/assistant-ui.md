# assistant-ui native source and dependency review

Owner approved 2026-09-28. Official documentation: https://www.assistant-ui.com/docs/react-native and https://www.assistant-ui.com/docs/runtimes/custom/external-store . No paid assistant-cloud service is configured.

- Runtime: @assistant-ui/react-native **0.1.44**, MIT. Use only the native runtime in the shared interface, avoiding a second @assistant-ui/react store.
- Registry: https://r.assistant-ui.com/native/thread.json . Reviewed official source at **5b23b2df762737246990e6a7bccebdbac0ca0959**: https://github.com/assistant-ui/assistant-ui/blob/5b23b2df762737246990e6a7bccebdbac0ca0959/packages/ui/src/components/react-native/assistant-ui/elements/thread.aui.tsx . Thread and four supporting source files match that commit before adaptation; SHA-256 evidence is in ../evidence/planner/upstream/source-checks.json and assistant-ui-registry-snapshot.json.
- Uniwind **1.12.0**, MIT; React Native/Metro/Tailwind peers match the installed stack.
- expo-clipboard **57.0.2**, MIT, aligned to Expo 57 bundled-native metadata. Copies only when explicitly selected.
- @ai-sdk/openai **4.0.78**, Apache-2.0; Vercel AI SDK **7.0.118**, Apache-2.0; server-side provider adapter only.

Copied thread/composer/message, icon, surfaces, typing indicator and icon-button source. The original MIT licence is retained in assistant-ui-LICENSE. Kept upstream FlatList scrolling, keyboard offset, composer send/cancel and copy controls. Adaptations: atepdf tokens/labels; local PDF/confirmation/key-entry host slots; single screen without thread-list navigation; hidden unsupported edit/reload controls; scrollable welcome on compact screens. Removed generalized remote attachment/image/file/markdown/tool rendering paths from this recipe because atepdf accepts structured local plans, not document-aware model messages. Existing clsx/tailwind-merge implement the small cn utility instead of adding another cn package.

The registry snapshot lists dependencies reviewed, including components not copied into atepdf. No default image attachment picker, base64-to-model path, tool fallback or cloud thread persistence was installed/configured. Transitive assistant-cloud is present through the upstream runtime package but unused; browser network tests verify no cloud/analytics requests in tested flows.

This review is provenance/licence/version/compatibility evidence. It is not production distribution approval or a complete vulnerability audit.
