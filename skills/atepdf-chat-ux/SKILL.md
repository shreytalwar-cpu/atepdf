---
name: atepdf-chat-ux
description: Plan, audit and refine atepdf's conversational PDF workspace across Expo web, iOS/iPadOS and Mac, with actual workflow, accessibility and local-output evidence. Use for atepdf composer, document context, activity, results, preview and recovery UX; not unrelated apps or backend-only work.
---

# atepdf conversational UX

Work in the existing independent atepdf repository. Locate it from the current workspace; on the owner's machine the known path is `/Users/shrey/Documents/ChatGPT/atepdf`. Verify the root and preserve existing work. Do not scaffold another app or access/build the old Attenlo reference for routine UI work.

## Ground the task

Read `docs/UI_UX_EXECUTION_PLAN.md` and the relevant rows of `docs/IMPLEMENTATION_STATUS.md`. Read only the matching QA/report and source for the requested slice. User instructions and current ADRs override older handoff stack decisions: assistant-ui and React Native/Expo are approved; Android is deferred; ordinary AI-enabled Send/shortcuts do not add per-request consent cards.

For visible UI work, read `atepdf_codex_build_pack/DESIGN.md` and `atepdf_codex_build_pack/brand/APPROVED_BRAND.md`, then view the appropriate approved UI reference and actual current app capture. The numeral-8 brand board governs identity only. Keep the conversational drop-and-instruct workspace; do not add a sidebar or permanent preview rail. Missing design-context files are not permission to redesign.

Planning-only requests produce a scoped plan/state contract without changing application UI or calling paid services. Clearly label proposed acceptance criteria and assumptions. For implementation, preserve working upstream components and inspect installed versions before considering a dependency change.

## Refine a complete journey

Start with bundled synthetic PDFs: import → merge → preview → remove page 2 → undo → save → independently reopen. Add the requested error/clarification/processing state; do not audit every screen for a small edit.

Use official assistant-ui slots and existing shared components. Preserve the native uncontrolled-composer fix. Keep local store, controller, planner serialization and presentation separate. A UI restyle must not introduce attachment uploads, default model narration of document content, partial-plan execution or repeated jobs after remount.

Make active-document context legible. Keep drafts and valid outputs on error/cancel. Progress comes from actual engine/controller events; a finished operation is not ready until validated. Distinguish planner activity, local work and independent validation. Preserve upward reading; only follow the bottom when appropriate. Restore useful focus after dialogs and preview dismissal.

“Ready”, “share sheet closed”, “cancelled” and “saved” are different facts. On iOS, closing the share sheet does not prove a destination save. Verify the exact saved copy after app restart; never replace it with a newly generated export for the evidence.

## Tools and verification

Read [tool-routing.md](references/tool-routing.md) for available skills, MCP routes and command entry points. Discover current tools/schema before invocation; listed tools are not proof of authentication or a successful run. Use synthetic planner responses for UI QA; live paid checks require remaining explicit authority. Do not consume a beta user's allowance merely to capture a spinner.

Batch a scoped visual inspection across target sizes, fix observed issues together, and do one confirmation pass. Report unresolved defects separately. Do not keep repeating builds and micro-edits to chase a subjective score. Functional regressions that reveal new correctness problems remain separate engineering tasks.

For each result record source/build, platform/device, fixture, steps, actual output, screenshot, pass/failure and unavailable checks. Distinguish app builds, test runs, screenshot review, independent PDF inspection and physical-device proof. Run the existing relevant tests rather than tests that only assert decorative wording. Keep previous failures as historical evidence.

Use fresh simultaneous keyboard/viewport frames for geometry checks. An offscreen keyboard is not acceptance. Public system Settings changes must capture and restore their original values. Assign simulators/build slots explicitly when agents run in parallel; do not overwrite shared defaults. Do not use private idle-check bypasses to hide failures.

The owner deferred Mac UI checks; respect that until superseded. Continue independent web/simulator work. No public deployment, tester outreach, new paid generation, production identities or billing changes follow merely from invoking this skill.

Finish with implemented change or planning artifact, source paths/checkpoint, actual tests, limitations and one next executable task. Do not claim an award, full accessibility compliance or launch readiness from visual polish alone.
