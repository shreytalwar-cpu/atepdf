# atepdf moderated usability study

Prepared 29 September 2026. **Study protocol only; no participants contacted and no results collected.** This is the small moderated study already required by [UI_UX_EXECUTION_PLAN.md](UI_UX_EXECUTION_PLAN.md), for everyday users who do occasional PDF tasks. Allow 10–15 minutes per participant. Use five consenting participants who have not built atepdf or rehearsed this workflow.

## Decision and acceptance gates

Determine whether occasional users can complete and understand the core conversation without moderator guidance. Use one fixed candidate build and one declared test configuration for the five-person round.

- At least **4 of 5** complete tasks 1–3 without rescue: import in the requested order, merge, save an actual copy, remove page 2, restore the earlier result, identify the current result and inspect it.
- **5 of 5** explain, without being told the answer first, that saving creates a copy and the two starting PDFs remain unchanged.
- **Any document-loss or privacy failure blocks acceptance**, regardless of completion scores. Preserve the evidence and stop the affected session. A suspected failure leaves the gate open until investigated; participant confidence alone cannot clear it.
- Tasks 4–5 diagnose recovery and basic help. Record failures and rank them; an unresolved task-blocking failure in the agreed workflow prevents calling the UX finished even if the numerical gate passes.

Report counts, observations and limitations. Five participants do not establish statistical representativeness, full accessibility compliance, broad PDF compatibility or release readiness. A rescued completion is not an unassisted success.

## Prepare once, before participants arrive

1. Record source commit, build identifier, date, browser/app version, device, input method, text size and Reduce Motion setting. Confirm that this is the candidate the owner intends to evaluate; do not silently rebuild between participants.
2. Choose the evidence lane below. Default to a local-only, no-key/no-provider configuration with working local operations. Do not open the owner's paid planner or enter credentials. If a synthetic planner is necessary for the selected lane, record its fixture/version and configured responses; use it consistently for the round. Do not mix synthetic-planner and live-model claims.
3. Make a fresh local study session and a dedicated local output folder for each participant, labelled `P01` through `P05`. Provide only the neutral study [brief.pdf](../tests/fixtures/usability/brief.pdf) and [appendix.pdf](../tests/fixtures/usability/appendix.pdf) in an easy-to-find local input folder. On a physical Apple device, place copies in a dedicated local Files folder beforehand. Task 1 uses **Choose files and the real file picker** to import these files; do not preload them or use “Try the two sample PDFs”. The app's bundled engineering samples contain workflow hints and are not the study materials. No personal PDFs, personal accounts or cloud-save destination are needed.
4. Keep the [study fixture README and answer key](../tests/fixtures/usability/README.md) with the moderator, not the participant. Its independently verified page headings and hashes define the expected 3 → 2 → 3 journey. The PDFs themselves contain only a fictional event brief/schedule and a synthetic-content disclosure; they do not teach atepdf controls or the task answers. Record input integrity locally before/after; never send hashes, names or document data to a model.
5. Have a local independent reader ready to inspect the exact exported file after the timed tasks. A share sheet closing or a browser reporting download started is not successful-save proof. Do not regenerate a replacement export if the participant's file is missing.
6. Verify the environment works with separate synthetic preflight files/session, then reset it. If file picking, the local host or the device is unavailable, repair setup before starting the participant timer. Keep application defects distinct from broken study equipment.
7. Keep the session-lifetime limitation on the moderator setup sheet: **chat, draft and result history are not persistent across termination**. Do not restart or refresh during these tasks, and do not imply that autosave/history exists. Do not read participants an explanation of copies/originals before testing their understanding. If they ask about closing the app, record the question and ask them to use the app's information; give accurate information after scoring.

| Evidence lane | What it can establish | What it cannot establish |
| --- | --- | --- |
| Web in an actual desktop browser | Browser task completion, pointer/keyboard use and actual browser export. | Native keyboard, native share sheet or physical-phone behavior. |
| Web on a physical phone/tablet | Mobile-browser interaction on that device, with actual software keyboard. | Native-app behavior. Record mobile browser explicitly. |
| Native app on physical iPhone/iPad | Participant behavior in the native app on the recorded device, keyboard and local Files/share flow. | Other device classes or production signing/distribution. |
| Native app in Simulator | Simulator interaction and observed controls with the chosen input method. | One-handed physical use, real device performance or physical keyboard/touch acceptance. Do not call this a physical-user phone test. |
| Synthetic planner, any lane | The configured conversation/clarification behavior plus real local processing. | Live-model understanding, provider latency, paid quota or service reliability. |

Use one primary lane for the acceptance round when practical. If the owner deliberately divides the five participants across platforms, retain per-lane results and state that the aggregate is not five passes on each platform. Mac interactive work remains deferred unless the owner explicitly resumes it. This protocol schedules no outreach or paid services.

## Consent and opening — about 1 minute

Read aloud:

> We're checking whether this version of atepdf makes sense for ordinary PDF tasks. We are testing the app, not you. We will use only the two made-up documents supplied here. I will take brief notes about the steps, timing and difficulties, using a participant code rather than your name. We are not recording audio or video. You may skip a task or stop at any time. Is that okay?

Record yes/no and time. A no ends the session. Do not collect identifying details or record the screen by default. If a still screenshot would help document an issue, ask separately before taking it; a refusal does not prevent participation. Record consent and restrict the capture to synthetic app content. Store notes locally with the participant code; do not upload them or contact the participant without separate authority.

Then say:

> Please use the app as you normally would. You can say what you expect or what is confusing, but you do not have to narrate everything. I'll mostly watch and may ask what you are thinking. Tell me when you believe each task is finished.

The moderator may identify the prepared input/output folder and explain the chosen device's basic study setup. Do not demonstrate the app or name its controls. Do not preview later tasks or explain the correct outcome in advance.

## Five task cards — about 8–10 minutes

Read only the **participant prompt** for the next task. Keep the success checks and likely control names out of sight. Start each task timer after reading; stop when the participant says finished, meets the observable goal, abandons, or receives rescue. Record which happened.

### 1. Combine and save — up to 3 minutes

**Participant prompt**

> The two PDFs in the prepared input folder need to become one document, with the brief first and the appendix after it. Use atepdf to do that, and put the finished PDF in the prepared output folder so you can use it outside the app.

**Moderator checks:** participant discovers Choose files, imports the two neutral study PDFs through the file picker, obtains three pages in the order **Event Overview → Venue and Materials → Morning Schedule**, and completes the actual export route. Do not point to the file chooser. After import, they may use typing or a shortcut to combine the files. If they use the bundled sample action, repeat the task's supplied-folder requirement neutrally and record the wrong turn; any procedural direction is rescue. Record mistaken order, hesitation about attachment state, and confusion between ready and saved. Note the exact exported file for independent inspection later. A cancelled picker or a closed share sheet without a file is not success.

### 2. Change the document, then change your mind — up to 2 minutes

Give the second sentence only after the first operation finishes.

**Participant prompts**

> For another version of that combined document, leave out its second page.

Then:

> You've changed your mind. Go back to the version from before that change.

**Moderator checks:** the first result has **Event Overview → Morning Schedule**; the participant then restores **Event Overview → Venue and Materials → Morning Schedule** without re-importing or recreating the files. Observe whether they act on the current result, locate the latest output and discover restoration without hearing “Undo” from the moderator. If they recreate the merge instead, record the route and partial outcome; it does not demonstrate the required restoration behavior.

### 3. Identify and inspect the current document — up to 1 minute

**Participant prompt**

> Show me which document atepdf would work on if you asked for another change now. Open that document, check its pages, and return to the conversation.

**Moderator checks:** participant identifies the restored three-page result rather than a prior two-page card; opens its preview, can navigate its pages and closes it. Ask only “What tells you that?” if the participant's reasoning is unclear. Do not supply the expected count or point to the current-result label. Record whether older cards or equal Save buttons cause uncertainty.

### 4. Encounter an invalid request and recover — up to 90 seconds

**Participant prompt**

> A message you received asks for a version without page 99. Try that request. After you see the response, decide what to do next and show which PDF you could still use.

**Moderator checks:** a clear error is encountered; the participant can explain the issue and find/open the still-usable current result. The three-page result remains unchanged. Record the participant's actual next step; they need not make another change. Do not warn them that the page does not exist before they try, and do not tell them that their work is safe. This is a deliberately invalid request, not a natural-frequency estimate of user mistakes.

### 5. Discover basic help — up to 1 minute

**Participant prompt**

> You want to know what else atepdf can help with. Find an answer in the app, and tell me one other task you would try.

**Moderator checks:** participant finds a truthful supported capability through their own route and understands a useful next action. If optional AI is unavailable, record whether the app leaves them with a working local route or makes setup seem mandatory. Do not give them a phrase to type or explain the settings icon. A synthetic answer must be recorded as such.

## Understanding and close — about 2 minutes

Ask these in order, before explaining anything:

1. “What did saving do? Where is the file you can use outside atepdf?”
2. “What happened to the two starting PDFs while you made these versions?”
3. “What, if anything, was unclear or made you hesitate?”

Record short verbatim answers when possible. For questions 1–2, score **understood / misunderstood / uncertain**. Correct understanding requires both an external saved copy and unchanged starting PDFs; “I think it saved everything” is uncertain, not a pass. The participant may consult the app without prompting. Do not replace an initial incorrect answer with a post-explanation answer in the acceptance tally; keep both if debrief changes their understanding.

After scoring, thank the participant and correct any misunderstanding. Explain the current session-lifetime limit and ensure no one expects the conversation to reopen after termination. Verify or demonstrate the exported synthetic copy if needed, labelled as moderator follow-up rather than unassisted completion. End by 15 minutes; unfinished tasks remain unfinished.

## Moderator behavior, timing and rescue

- Watch without pointing, naming controls, suggesting exact commands, confirming guesses or clicking ahead. Let the person choose how to proceed. “Use the blue button”, “type merge” and “try Undo” are coaching.
- Neutral prompts such as “What are you looking for?”, “What did you expect?” or repeating the task verbatim are allowed. Record them; do not repeatedly prompt until the answer is revealed.
- After about 45 seconds with no meaningful progress, one neutral prompt is reasonable. At the task's time limit, or when the participant asks for help/gives up, record **needs rescue** before helping. Offer to move on. Do not let a stuck task consume the whole session.
- If later tasks require a missing starting state, the moderator may prepare it after recording rescue. Mark the subsequent task **seeded start**. Later task-level success can still be informative, but the participant cannot count as an unassisted core-flow completion.
- Any procedural hint, exact command, pointed control or moderator interaction needed to achieve the goal is rescue. Record the first intervention and time. Do not reclassify a rescued pass as unassisted because the person finishes afterward.
- Record elapsed wall time and explicit environment interruptions separately. Do not subtract ordinary app waiting, rendering or picker latency from the user-experience timing. A broken test host/device is **environment blocked**, not a participant failure or a successful run.
- Stop for suspected data loss/privacy failure. Do not ask the participant to reproduce it or continue with personal data. Keep local technical investigation outside their task timer.

## Blank participant evidence sheet

Copy this section once per participant; leave it unfilled until observed. Use a local notes file under an owner-selected study folder. Do not put names or contact details in the report.

| Setup | Record |
| --- | --- |
| Participant code / date / moderator | |
| Occasional PDF-use context, in their words | |
| Consent to notes / time | |
| Separate optional still-image consent | |
| Source commit / build ID | |
| Evidence lane / app or browser version | |
| Physical device or Simulator model / OS | |
| Input method / viewport / text size / Reduce Motion | |
| Planner mode: local-only or synthetic; fixture/version | |
| Clean session / neutral usability-fixture hashes / output folder | |

| Task | Elapsed | Outcome: unassisted / rescued / incomplete / environment blocked | First hesitation or wrong turn | Neutral prompts; first rescue and time | Evidence reference / exact quote |
| --- | --- | --- | --- | --- | --- |
| 1. Combine and save | | | | | |
| 2. Remove second page, restore | | | | | |
| 3. Identify and inspect current | | | | | |
| 4. Invalid request and recovery | | | | | |
| 5. Basic help | | | | | |

| Understanding and integrity | Record |
| --- | --- |
| “What did saving do?” — verbatim answer and score | |
| “What happened to the starting PDFs?” — verbatim answer and score | |
| Correct neutral study files used; any accidental bundled-sample exposure | |
| Core tasks 1–3 all unassisted, no seeded starts or workflow cues: yes/no | |
| Exact exported artifact / independently reopened: yes/no/unverified | |
| Reader/tool and observed page order of that exact export | |
| Local input integrity before/after: unchanged/changed/unverified | |
| Current result after invalid request: facts and evidence | |
| Privacy/data-loss concern: none observed/suspected/confirmed; evidence | |
| Platform or environment limitation / interrupted time | |
| Debrief given; participant's main difficulty | |

## Blank five-person decision sheet

| Participant | Lane | Core flow unassisted | Understands saved copy + unchanged originals before explanation | Actual export independently verified | Blocker / evidence |
| --- | --- | --- | --- | --- | --- |
| P01 | | | | | |
| P02 | | | | | |
| P03 | | | | | |
| P04 | | | | | |
| P05 | | | | | |

- Core flow unassisted: **___ / 5**; gate at least 4.
- Required understanding: **___ / 5**; gate 5.
- Privacy/document-loss blocker: **not assessed / none observed / suspected / confirmed**; supporting evidence: ___ . “None observed” is not a complete privacy audit.
- Most consequential observed friction, affected participants and evidence: ___ .
- Decision: **not run / incomplete evidence / gates not met / study gates met**, with platform/planner limitations: ___ .
- Concrete fixes or unresolved release-UX items from this round: ___ . Reuse the existing execution plan; do not create another roadmap.

If a candidate changes after the study, label the earlier evidence with its original build. A targeted confirmation with participants who have already learned the flow is follow-up evidence, not five fresh first-use observations. Do not reuse earlier successes as proof that a changed state passes.
