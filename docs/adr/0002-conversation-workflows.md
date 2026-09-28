# 0002 — Workflows and results live in the conversation

2026-09-28. Owner: “every workflow should be like youre talking to a chatbot. the results shoudl be inside too”.

The shared React Native screen is one conversation. File selection/drop creates a user attachment turn. Quick actions create ordinary user turns. Progress, errors, confirmations and completed outputs appear as assistant turns. Preview is embedded inside its result message; save receipts belong to the specific immutable result. Follow-up commands target current focus; undo appends the restored result and retains earlier result cards. Compression and session clearing use inline clarification turns, with revision binding to reject stale confirmation.

The composer remains visible while the thread scrolls. Quick actions remain available. Hosted AI is not connected: the interface explicitly labels its bounded local command parser. A chat appearance is not evidence of a hosted planner. No conversation, filenames or PDF contents leave the device in this slice.
