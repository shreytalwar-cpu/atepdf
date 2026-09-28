# 0001 — Owner-approved React Native / Expo interface
2026-09-28. Owner changed the native framework and selected one React Native / Expo interface for web, iOS and Android. This supersedes the handoff SwiftUI/Compose-only decision and its separate web UI implementation.

Share native React Native components, TypeScript protocol and controller. Keep file selection, local PDF execution, preview and export behind platform adapters. No WebView PDF-processing shortcut. The browser uses real local workers. Native PDF bridges require separate validation before capabilities are enabled. Mac remains tracked: React Native macOS is a separate target and is not proven by an Expo iOS build.

The initial Next.js shell/build was created before this instruction. Preserve its source as a transition record; replace its live screen with the shared React Native view and establish Expo web/native bundle entrypoints. One hosted planner implementation stays separate and disabled pending credentials/budget. All privacy, brand, independent-repository, immutable-original, commercial and release boundaries remain in force.
