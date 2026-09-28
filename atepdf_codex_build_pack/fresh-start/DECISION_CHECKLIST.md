# Fresh-start acceptance checklist

These are implementation gates, not results from this packaging session.

1. Codex is open at the new atepdf root, not old Attenlo PDF and not this handoff subfolder.
2. Old and new roots are different, neither contains the other, and no shared Git worktree/common history is adopted.
3. Old source is scoped read-only where supported; no write/install/build/migration command runs there.
4. New root is deliberately initialised or safely resumed. Unknown existing work is not erased.
5. Relevant source lessons have exact evidence IDs/statuses. Missing old access is recorded without blocking pack-supported work.
6. Any isolated port has owned/licensed provenance and a narrow dependency set; wholesale old source is absent.
7. New source matches atepdf brand and earlier approved chat/drop UI, ignoring the brand-board mock-ups.
8. Real merge, result preview/save, follow-up and undo run in the new app with synthetic files.
9. Protocol and network checks demonstrate local document processing and separate cloud interpretation.
10. New source builds with the old reference unavailable; no old-path imports or linked packages are required.
11. Old production identifiers, user files and secrets are absent from the new runtime and its logs; sandbox setup is explicit.
12. Status distinguishes package checks, old-source observations and new-app runtime evidence. Marketing and live billing remain approval-gated.
