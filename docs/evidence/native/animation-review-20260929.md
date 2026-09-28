# Native animation-completion wait: read-only source review

Reviewed 29 September 2026. **Root cause remains unproved.** The strongest source-backed lead is a timing-sensitive keyboard/layout-animation or UIKit/XCTest animation-tracking interaction. The first recorded wait starts before the Close tap is delivered, so the Close handler's removal of the preview cannot explain that first wait. Do not ship another speculative pulse rewrite, global Reduce Motion workaround, dependency change, or idle-check bypass from this review.

This review ran no simulator command, UI test, build, application launch, settings change, paid call or old-project access. Only this report was written. The Apple agent owns runtime investigation. The Apple agent reports two unchanged successful repeats, 51.365 and 49.603 seconds, without idle warnings; these are coordination results, not independently inspected runtime proof by this reviewer. No further native batch is recommended now.

## Provenance

The requested native source is `7935daa`. At read time repository HEAD was `5269e5471b65d5dd76ed8c295cde2e1df5bb61ae`; a scoped comparison against `7935daa` found no differences in App, JobActivity, surfaces, thread, NativeComposer or native Preview. Their current hashes also match `ux-discovery-final-source.json`.

| Installed package | Version | Package-declared upstream |
|---|---|---|
| react-native | 0.86.3 | `https://github.com/react/react-native.git`, `packages/react-native` |
| @assistant-ui/react-native | 0.1.44 | `https://github.com/assistant-ui/assistant-ui.git`, `packages/react-native` |
| expo | 57.0.25 | `https://github.com/expo/expo.git`, `packages/expo` |

The primary implementation evidence is the installed source under `node_modules`, not web commentary. Package hashes: react-native/package.json `416224a4e7caf2ee1f8f9bead8508d0b608feed745371ce0a8f0e2cafa16d144`; @assistant-ui/react-native/package.json `07112abc66c2a72e39bc2c48c8aace066264848a543c97d4245c93f5db96706e`.

The inspected `KeyboardAvoidingView.js` hash is `09560bc21b94e8c6bb3c2e5b055250e86edd117a406db140ebbc719c494b1693`; Fabric ActivityIndicator component hash is `e90458176b4f852b9ae488089e9f5f7b9166610c442e86d739996c1f62c0f491`. Fabric paths below describe installed source; this review did not inspect live feature-flag values or private XCTest internals.

## What the recorded failure actually establishes

Source: `docs/evidence/native/ux-discovery-final-ipad-ax-landscape-test.log:225–272`.

1. The second PDF page and simultaneous keyboard/navigation/raster assertions were reached.
2. Portrait rotation starts at 39.63 seconds. Ordinary app-frame, result-facts, keyboard and Close existence/hittability queries complete through 46.10 seconds.
3. `Tap "Close preview"` starts at 46.13. XCTest first waits for app idle; its animation-complete warning occurs at 106.17, **before** event synthesis at 106.39.
4. After event delivery it waits again from 106.70 to 166.73. The Close control is then absent and the test eventually passes at 169.564 seconds.

Consequences: the app could service the preceding accessibility queries; the record does not establish a main-thread deadlock. It also does not prove normal interaction latency: the two approximately 60-second waits are material. A post-Close unmount-only bug cannot cause the pre-event wait. Rotation/keyboard activity or an animation left by an earlier operation can.

The test itself is ordinary public XCTest: `tests/native/ios/AtepdfWorkflowUITests.swift:47–49` waits for a reachable enabled element then calls `element.tap()`. The landscape sequence at lines 362–444 focuses the native composer, sends a real local removal, opens/renders page two, re-establishes a visible keyboard, rotates back and closes. The final reveal helper does not perform a drag in the cited log between portrait rotation and the first Close wait.

## Ranked implementation paths

### 1. KeyboardAvoidingView / keyboard transition / global layout transaction — highest-priority discriminator

**Concrete source chain:**

- `apps/universal/src/components/assistant-ui/elements/thread.aui.tsx:450–465` wraps the native thread in RN KeyboardAvoidingView using `behavior="padding"` and measured keyboard offset.
- `node_modules/react-native/Libraries/Components/Keyboard/KeyboardAvoidingView.js:125–138` recalculates bottom displacement on layout-height changes, using the retained keyboard event. Thus rotation can reach this path even without a fresh keyboard frame event.
- Lines 154–178 set the new bottom and call **global** `LayoutAnimation.configureNext` when the displacement changed and the retained event has duration/easing.
- Lines 198–208 subscribe to `keyboardWillShow` and `keyboardWillHide` on iOS, explicitly not `keyboardWillChangeFrame`. Do not describe this as a direct willChangeFrame listener.
- `node_modules/react-native/Libraries/LayoutAnimation/LayoutAnimation.js:53–103` sends the next-commit configuration to Fabric when present. Its duration-plus-17ms JavaScript callback fallback is an RN completion safeguard; **it is not XCTest's animation-complete notification** and does not establish that XCTest is quiescent.
- `node_modules/react-native/ReactCommon/react/renderer/animations/LayoutAnimationKeyFrameManager.cpp:101–133,239–252` stores a pending global animation and consumes it during a mounting transaction. Lines 1031–1043 notify RN's own delegate when the inflight set starts/empties. The similarly named callback must not be equated with XCTest's notification without runtime evidence.

**Why it fits:** the native composer remains focused across rotation; keyboard avoidance, footer visibility, viewport measurements and preview toolbar size can change together. The warning occurs after those changes and before Close delivery. This is a concrete animation-producing path even though the app's explicit preview-reveal scroll is nonanimated.

**What is not proved:** no captured trace yet identifies a stuck RN layout transaction, an unmatched UIKit animation, or a duration/easing value. This chain establishes a useful experiment, not an upstream defect verdict.

### 2. Native preview ActivityIndicator removal/recycling — separate, testable lifecycle hypothesis

- `apps/universal/src/platform/Preview.native.tsx:65–74,111–115` renders a real PDF asynchronously. While there is no raster it shows ActivityIndicator when Reduce Motion is off; when the raster arrives the entire loading branch disappears. No `animating={false}` phase is committed before removal.
- `node_modules/react-native/Libraries/Components/ActivityIndicator/ActivityIndicator.js:63–70` defaults `animating` to true.
- `node_modules/react-native/React/Fabric/Mounting/ComponentViews/ActivityIndicator/RCTActivityIndicatorViewComponentView.mm:41–60,65–92` starts its UIKit child from default props and stops it only when `animating` transitions false. The class has no `prepareForRecycle` override.
- `node_modules/react-native/React/Fabric/Mounting/RCTComponentViewRegistry.mm:105–119` retains eligible detached component views in a recycle pool after `prepareForRecycle`.
- `node_modules/react-native/React/Fabric/Mounting/ComponentViews/View/RCTViewComponentView.mm:687–726` resets generic view state but does not stop a child UIActivityIndicator; the superclass category in `UIView+ComponentViewProtocol.mm:127–135` has empty recycle/invalidate implementations.

**Why it is worth testing:** a previously started indicator can be detached and retained without an explicit stop call in this source path. A spinner from page-one/page-two loading would predate the first Close wait, unlike Close itself.

**Important limits:** UIKit may suspend/cancel its animation when detached, and XCTest may ignore it; neither behavior was observed here. This cannot by itself explain the historical paired delayed-reply failure without a preview. Do not turn the source omission into a confirmed recycled-spinner leak or replace all native loading indicators speculatively.

### 3. Job pulse native-animation lifecycle — relevant historical correlation, weakened as sole cause

- `apps/universal/src/components/JobActivity.tsx:25–42` activates the pulse only while local work/planning/loading is active and returns null when inactive.
- `apps/universal/src/components/assistant-ui/elements/surfaces.tsx:104–132` runs two 700ms timings in an Animated sequence/loop, with the native driver and `isInteraction:false`; effect cleanup calls `animation.stop()`.
- RN `Libraries/Animated/AnimatedImplementation.js:305–359,463–515`: sequence reports that the aggregate is not a native loop, so this particular composition restarts through JS while individual timings use the native driver. `loop.stop()` marks it finished and stops the current sequence animation. This is a factual distinction from a single native-driven repeating animation.
- RN `Libraries/Animated/animations/Animation.js:85–98` sends native stop; `Libraries/NativeAnimation/RCTNativeAnimatedNodesManager.mm:314–335` removes stopped drivers, and lines 440–479 invalidate the display link when none remain at a subsequent animation step. These are lifecycle paths, not proof that a driver survived in this run.
- `isInteraction:false` belongs to RN animation semantics. It does not promise that XCTest ignores UIKit/Core Animation activity.

Current surfaces hash `c754ed5b1124d0dce1c4296895ea79143b8c89238392ef5f30e15aed128aa9ba` matches both the original `beta-matrix-source.json` and the final source snapshot. It differs from the rejected single-native-loop and JS-driver candidate hashes. `docs/BETA_APPLE_QA.md:45–51` records both failed experiments and their reversion. **Do not repeat those edits as an alleged fix.**

Historical timing records show pairing-only and immediate-reply foreground activation around 0.31–0.34 seconds, versus about 60.05 seconds for the delayed successful reply. That associates the wait with the longer activity/lifecycle scenario but does not identify which animation survives. The current unpaired landscape case shows that network pairing and cancellation are not necessary for every occurrence of this XCTest symptom. A single shared root cause is not established.

### 4. Assistant-ui auto-scroll, preview zoom and composer loops — not supported as current direct animation causes

- The installed assistant-ui ThreadMessages implementation has optional animated run-start scrolling (`node_modules/@assistant-ui/react-native/src/primitives/thread/ThreadMessages.tsx:423–430`), but the app passes all four auto-scroll switches false at `thread.aui.tsx:492–499`; the installed `scrollTracking` gate at ThreadMessages lines 505–559 then forwards the app handlers directly.
- App content/viewport follow and native preview reveal use `animated:false` (`thread.aui.tsx:264–269,388–428`). The separate animated jump-to-message path exists at line 308 but is not used by the cited test.
- Assistant-ui still sets `maintainVisibleContentPosition` at ThreadMessages line 546. RN's matching native adjustment at `RCTScrollViewComponentView.mm:1079–1132` animates to the start only with an explicit autoscroll threshold; assistant-ui supplies none. The remaining direct offset adjustment can interact with layout, but it is not evidence of a perpetual animation.
- RN scroll-view keyboard-inset animation at `RCTScrollViewComponentView.mm:187–265` is guarded by automaticallyAdjustKeyboardInsets. The installed default is false (`ReactCommon/react/renderer/components/scrollview/BaseScrollViewProps.h:40`), and the inspected app does not enable it. Do not count this as a second active keyboard-animation path without verifying effective props.
- `Preview.native.tsx:105–109` uses a native zoomable ScrollView and writes zoom only from changes; the failure scenario does not press zoom. Native prop mapping at `RCTScrollViewComponentView.mm:397` directly assigns zoomScale. No app animation loop was found there.
- `ComposerInput.native.tsx:10–18` keeps UIKit in charge of draft/caret, clears on send and updates the composer store on text changes. No app Animated/timer loop exists in it. A UIKit caret/keyboard tracking issue remains possible, but rewriting the deliberately uncontrolled input would risk a previously fixed typing defect.
- Generic assistant typing dots are not mounted for the app's normal running job because the Activity slot selects JobActivity (`App.tsx:244–245`, `thread.aui.tsx:868–875`). Completed messages do not run AssistantIndicator (`thread.aui.tsx:854–856`). History shimmer has no active history-loading path in the recorded workflow.

## Future discriminators if the symptom recurs

Do not start another low-yield batch after the two clean unchanged repeats. These are a retained diagnostic sequence for recurrence, not tests run by this review. Preserve the unmodified Release app, original accessibility settings, exact product hashes and ordinary XCTest synchronization. Keep functional acceptance tests intact; give diagnostic variants separate names/results.

1. **On a natural or already-authorized recurrence, observe the actual failure window.** Capture app and runner samples at the pre-event wait plus a compositor screenshot and monotonic timestamps. A normal app run loop and a runner animation-wait stack would distinguish test synchronization from an app busy loop. The two clean repeats do not identify a cause or erase the recorded failure.
2. **If the wait reproduces, remove keyboard/rotation overlap through normal user UI.** On the same real local result/page-two flow, dismiss the keyboard using an ordinary visible action, verify its actual frame is gone, then rotate and close. Compare with the original keyboard-open rotation. Only one diagnostic change; do not add Reduce Motion or change pulse code.
3. **Choose the next branch based on that result.** If keyboard-open is the discriminator, run a minimal empty-conversation composer-focus → rotate → neutral visible button action with no PDF job or preview; that retains UIKit keyboard/KAV while removing both pulse and preview spinner. If the wait persists after keyboard dismissal, use a page-two preview → close case without rotation/keyboard to isolate preview lifetime.
4. **Only with a reproducible branch, collect lifecycle evidence before patching.** A diagnostic build or auto-continuing symbolic trace can record the relevant public keyboard notifications, animation duration/easing, start/stop of UIActivityIndicator and app render/unmount boundaries; it must not disable synchronization. For the RN path, distinguish configureNext calls from actual native completion. For the spinner path, prove that the retained indicator is still animating and being tracked after detachment before proposing a lifecycle fix. This review does not authorize or perform that build.

Stop after a useful discriminator or a bounded non-reproduction result. Do not run an unbounded matrix or revive the two already-rejected pulse patches. If both keyboard and preview branches fail independently, treat them as potentially separate causes until a common trace identifies otherwise.

## Evidence limits and conclusion

The older three-second sample (`beta-resume-sampling.json`) found JS idle in all 2,089 samples and main-thread idle in 1,928, with other work largely serving accessibility queries. Its runner sample was not a continuous profile of the entire wait. This narrows a CPU-loop explanation but cannot prove responsiveness throughout or locate the missing notification.

Reduce Motion's prior successful paired case changes several system behaviors simultaneously; it supports a motion-sensitive failure mode, not a unique pulse cause or a production workaround. The duplicate simulator accessibility-class warning in the log is runtime context, not causation.

**Recommendation:** stop the current diagnostic batch after the two clean unchanged repeats. If the wait recurs, capture the actual stalled runner and use the public keyboard-dismissed rotation discriminator first if further testing is authorized. Keep production animation and dependency code unchanged until the evidence identifies an offending lifecycle. Source inspection supports those future discriminators and rules out several tempting explanations. The present evidence is an intermittent XCTest synchronization delay, not measured 60-second direct human input latency; direct human responsiveness was not measured by this review. Neither the old warning nor two clean retries closes native smoothness/latency acceptance, physical-device validation, VoiceOver or release gates.
