# Fresh start, retained learning
**v7 decision: new atepdf repo; old Attenlo PDF read-only.**

This folder is the only new workstream. It updates the existing M0/F01–F03 setup tasks instead of adding a competing roadmap.

Read [NEW_REPOSITORY_BLUEPRINT.md](NEW_REPOSITORY_BLUEPRINT.md) for destination/source separation, and [LEGACY_LEARNING_PROTOCOL.md](LEGACY_LEARNING_PROTOCOL.md) for evidence-based reuse. [DECISION_CHECKLIST.md](DECISION_CHECKLIST.md) provides first-session acceptance.

Templates are deliberately unfilled about the old code: [source audit](templates/LEGACY_SOURCE_AUDIT.md), [learning register](templates/learning-register.json), [porting record](templates/PORTING_DECISION.md), [local source configuration](reference-project.example.json) and [new-project marker](templates/project-marker.example.json).

The reference [path guard](reference/guard.py) and its [tests](tests/test_guard.py) reject common destination mistakes. They do not inspect the old source, enforce OS sandbox permissions, initialise a repository or run builds. Its output path, if any, is controlled by the caller; it only prints a redacted status report.

Required actual new-app proof: one standalone checkout can produce the real merge/follow-up/undo result without access to the old checkout. Unavailable legacy evidence is labelled, not invented. Marketing and financial hypotheses remain in their original folders unchanged.
