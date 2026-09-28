import XCTest
import UIKit

/// Drives the release application's real interface with bundled synthetic PDFs.
/// No engine/store/transport mocks, private documents or purchase adapter.
/// Paired tests use a separate synthetic-only provider with no owner key.
@MainActor
final class AtepdfWorkflowUITests: XCTestCase {
  private var app: XCUIApplication!
  private var originalReduceMotion: Bool?
  private let motionSettings = AtepdfPublicReduceMotion()

  override func setUpWithError() throws {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    app = XCUIApplication(bundleIdentifier: "dev.atepdf.fresh")
    app.launch()
    let accessibility = XCTAttachment(string: "preferredContentSizeCategory=\(UIApplication.shared.preferredContentSizeCategory.rawValue)\nreduceMotion=\(UIAccessibility.isReduceMotionEnabled)")
    accessibility.name = "simulator-accessibility-configuration"
    accessibility.lifetime = .keepAlways
    add(accessibility)
  }

  override func tearDownWithError() throws {
    if let app {
      let hierarchy = XCTAttachment(string: app.debugDescription)
      hierarchy.name = "final-accessibility-hierarchy"
      hierarchy.lifetime = .keepAlways
      add(hierarchy)
      capture("final-screen")
      app.terminate()
      XCUIDevice.shared.orientation = .portrait
    }
    if let originalReduceMotion {
      try motionSettings.setEnabled(originalReduceMotion)
      interruptionTiming("reduce-motion-restored", "verifiedSettingsSwitch=\(originalReduceMotion)\nrunnerUIKitDiagnostic=\(UIAccessibility.isReduceMotionEnabled)", since: Date())
    }
  }

  private func wait(_ element: XCUIElement, _ predicate: String = "exists == true AND hittable == true", timeout: TimeInterval = 30,
                    file: StaticString = #filePath, line: UInt = #line) {
    let expectation = XCTNSPredicateExpectation(predicate: NSPredicate(format: predicate), object: element)
    XCTAssertEqual(XCTWaiter.wait(for: [expectation], timeout: timeout), .completed,
                   "Expected UI state for \(element)", file: file, line: line)
  }

  private func tap(_ element: XCUIElement, file: StaticString = #filePath, line: UInt = #line) {
    wait(element, "exists == true AND hittable == true AND enabled == true", file: file, line: line)
    element.tap()
  }

  private func addBundledSamples(file: StaticString = #filePath, line: UInt = #line) {
    let button = app.buttons["Try the two sample PDFs"]
    wait(button, "exists == true", file: file, line: line)
    let welcome = app.scrollViews.firstMatch
    for _ in 0..<6 {
      let viewport = welcome.frame, target = button.frame
      if button.isHittable && target.midY > viewport.minY + 8 && target.midY < viewport.maxY - 8 { break }
      // At accessibility text sizes the welcome content scrolls. Reveal it by
      // an ordinary measured drag; keep the same strict reachable-button tap.
      let distance = min(0.45, max(0.12, (target.midY - viewport.midY) / viewport.height))
      let start = welcome.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.75))
      let finish = welcome.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.75 - distance))
      start.press(forDuration: 0.05, thenDragTo: finish, withVelocity: .slow, thenHoldForDuration: 0.1)
    }
    XCTAssertTrue(button.isHittable && welcome.frame.contains(CGPoint(x: button.frame.midX, y: button.frame.midY)), "The sample action must be visibly reachable", file: file, line: line)
    tap(button, file: file, line: line)
  }

  private func waitForState(_ condition: @escaping () -> Bool, timeout: TimeInterval = 10,
                            file: StaticString = #filePath, line: UInt = #line) {
    let expectation = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in condition() }, object: nil)
    XCTAssertEqual(XCTWaiter.wait(for: [expectation], timeout: timeout), .completed, file: file, line: line)
  }

  private func tapInConversation(_ element: XCUIElement, file: StaticString = #filePath, line: UInt = #line) {
    reveal(element, file: file, line: line)
    tap(element, file: file, line: line)
  }

  private var conversation: XCUIElement { app.otherElements["conversation"].scrollViews.firstMatch }

  private func visibleInConversation(_ element: XCUIElement) -> Bool {
    let viewport = conversation.frame, target = element.frame
    // RN can report hittable for offscreen children. Require their actual center
    // inside the conversation as well, so a successful assertion is visible.
    return element.isHittable && target.midY > viewport.minY + 8 && target.midY < viewport.maxY - 8
  }

  private func reveal(_ element: XCUIElement, file: StaticString = #filePath, line: UInt = #line) {
    wait(element, "exists == true", file: file, line: line)
    // Inline results can be taller than the conversation. Use ordinary user
    // scrolling; never tap offscreen coordinates or invoke app internals.
    wait(conversation, "exists == true")
    for _ in 0..<6 {
      if visibleInConversation(element) { return }
      let viewport = conversation.frame, target = element.frame
      let downward = target.minY < viewport.minY
      let distance = min(0.45, max(0.12, abs(viewport.midY - target.midY) / viewport.height))
      let startY: CGFloat = downward ? 0.25 : 0.75
      let finishY = startY + (downward ? distance : -distance)
      // A full-speed fling overshoots this short viewport and can oscillate on
      // opposite sides of the same button. Drag within the measured viewport,
      // then hold briefly to stop inertia, as a user making a precise scroll.
      XCTContext.runActivity(named: "Reveal \(element.label): target y=\(target.minY), viewport y=\(viewport.minY), drag=\(finishY-startY)") { _ in
        let start = conversation.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: startY))
        let finish = conversation.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: finishY))
        start.press(forDuration: 0.05, thenDragTo: finish, withVelocity: .slow, thenHoldForDuration: 0.1)
      }
    }
    XCTAssertTrue(visibleInConversation(element), "Expected the control to be visible and reachable by scrolling", file: file, line: line)
  }

  private func capture(_ name: String) {
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  private func latestResultButton(_ label: String) -> XCUIElement {
    // React Native exposes card controls as accessibility siblings, not children
    // of its layout View. Messages are chronological; the last matching control
    // belongs to the current result whose facts were asserted immediately above.
    let controls = app.buttons.matching(identifier: label)
    XCTAssertGreaterThan(controls.count, 0)
    return controls.element(boundBy: controls.count - 1)
  }
  private func assertPages(_ count: Int, file: StaticString = #filePath, line: UInt = #line) {
    let facts = app.staticTexts["result-facts"]
    wait(facts, "exists == true AND label BEGINSWITH '\(count) pages'", file: file, line: line)
    let largeText = UIApplication.shared.preferredContentSizeCategory.isAccessibilityCategory
    let compactKeyboard = (app.frame.width > app.frame.height || largeText) && app.keyboards.firstMatch.exists
    if compactKeyboard {
      XCTAssertFalse(app.staticTexts["Current result · \(count) pages"].exists, file: file, line: line)
    } else {
      XCTAssertTrue(app.staticTexts["Current result · \(count) pages"].exists, file: file, line: line)
    }
  }

  private func syntheticEvidence() async throws -> (calls: Int, cancelled: Int) {
    let (data, _) = try await URLSession.shared.data(from: URL(string: "http://localhost:3212/test/evidence")!)
    let evidence = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    XCTAssertEqual(evidence["provider"] as? String, "synthetic-only")
    return (try XCTUnwrap(evidence["calls"] as? Int), try XCTUnwrap(evidence["cancelled"] as? Int))
  }

  private func waitForSyntheticEvidence(calls: Int? = nil, cancelled: Int? = nil) async throws {
    for _ in 0..<30 {
      let evidence = try await syntheticEvidence()
      if (calls == nil || evidence.calls >= calls!) && (cancelled == nil || evidence.cancelled >= cancelled!) { return }
      try await Task.sleep(for: .milliseconds(100))
    }
    XCTFail("Synthetic gateway did not observe the expected request/cancellation")
  }

  private func pairSyntheticPlanner() async throws {
    var statusRequest = URLRequest(url: URL(string: "http://localhost:3212/api/planner/status")!)
    statusRequest.timeoutInterval = 2
    let (statusData, _) = try await URLSession.shared.data(for: statusRequest)
    let status = try XCTUnwrap(JSONSerialization.jsonObject(with: statusData) as? [String: Any])
    let token = try XCTUnwrap(status["token"] as? String)
    var request = URLRequest(url: URL(string: "http://localhost:3212/api/planner/pairing")!)
    request.timeoutInterval = 2;request.httpMethod = "POST";request.httpBody = Data("{}".utf8)
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("http://localhost:3212", forHTTPHeaderField: "Origin")
    request.setValue(token, forHTTPHeaderField: "X-Atepdf-Token")
    let (data, _) = try await URLSession.shared.data(for: request)
    let pairing = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    let code = try XCTUnwrap(pairing["code"] as? String)
    tap(app.buttons["AI connection"])
    if app.buttons["Latest message"].exists { tap(app.buttons["Latest message"]) }
    let field = app.secureTextFields["Pairing code"]
    tapInConversation(field);field.typeText(code)
    tapInConversation(app.buttons["Connect this app"])
    wait(app.staticTexts["Connected to the local planner. Tell me what you’d like to do."], "exists == true")
  }

  private func interruptionTiming(_ name: String, _ detail: String, since start: Date) {
    let attachment = XCTAttachment(string: "elapsedSeconds=\(Date().timeIntervalSince(start))\n\(detail)")
    attachment.name = name;attachment.lifetime = .keepAlways;add(attachment)
  }

  private func interruptionCheckpoint(_ name: String, since start: Date) {
    interruptionTiming("\(name)-timing", "applicationState=\(app.state.rawValue)", since: start)
    capture(name)
    let hierarchy = XCTAttachment(string: app.debugDescription)
    hierarchy.name = "\(name)-hierarchy";hierarchy.lifetime = .keepAlways;add(hierarchy)
  }

  private func resumePairedDraft(_ caseName: String) -> XCUIElement {
    let started = Date()
    let composer = app.textViews.matching(NSPredicate(format: "label BEGINSWITH 'Tell atepdf what to do'")).firstMatch
    tap(composer);composer.typeText("remove")
    wait(composer, "value == 'remove'")
    interruptionCheckpoint("\(caseName)-before-home", since: started)
    interruptionTiming("\(caseName)-home-start", "", since: started)
    XCUIDevice.shared.press(.home)
    waitForState { self.app.state == .runningBackground || self.app.state == .runningBackgroundSuspended }
    interruptionTiming("\(caseName)-activate-start", "", since: started)
    let activating = Date()
    app.activate()
    let activationSeconds = Date().timeIntervalSince(activating)
    interruptionTiming("\(caseName)-activate-returned", "", since: started)
    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
    interruptionCheckpoint("\(caseName)-after-foreground", since: started)
    XCTAssertLessThan(activationSeconds, 5, "Foreground activation must not wait for the missing animation-completion notification")
    assertPages(3)
    let continuing = Date()
    tap(composer);composer.typeText(" page 2")
    wait(composer, "value == 'remove page 2'")
    interruptionCheckpoint("\(caseName)-exact-continuation", since: started)
    XCTAssertLessThan(Date().timeIntervalSince(continuing), 10, "Draft interaction must remain responsive after foregrounding")
    return composer
  }

  private func mergeForInterruptionMatrix() {
    addBundledSamples()
    wait(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Your 2 PDFs are ready.'")).firstMatch, "exists == true")
    tap(app.buttons["Merge"]);assertPages(3)
  }

  func testPairOnlyBackgroundResumeDraft() async throws {
    executionTimeAllowance = 180
    mergeForInterruptionMatrix()
    let before = try await syntheticEvidence()
    try await pairSyntheticPlanner()
    _ = resumePairedDraft("pair-only")
    let after = try await syntheticEvidence()
    XCTAssertEqual(after.calls, before.calls, "Pairing and draft entry must not create a planning request.")
  }

  func testCompletedReplyBackgroundResumeDraft() async throws {
    executionTimeAllowance = 180
    mergeForInterruptionMatrix()
    try await pairSyntheticPlanner()
    let before = try await syntheticEvidence()
    let composer = app.textViews.matching(NSPredicate(format: "label BEGINSWITH 'Tell atepdf what to do'")).firstMatch
    tap(composer);composer.typeText("What can atepdf do?")
    wait(composer, "value == 'What can atepdf do?'")
    tap(app.buttons["Send message"]);wait(composer, "value == ''")
    wait(app.staticTexts["I can merge PDFs and remove pages on your device. Your originals stay unchanged."], "exists == true")
    wait(app.buttons["Cancel"], "exists == false")
    try await waitForSyntheticEvidence(calls: before.calls + 1)
    _ = resumePairedDraft("completed-reply")
    let after = try await syntheticEvidence()
    XCTAssertEqual(after.calls, before.calls + 1)
  }

  func testDelayedCompletedPlanBackgroundResumeDraft() async throws {
    executionTimeAllowance = 180
    try await delayedCompletedPlanBackgroundResumeDraft()
  }

  func testDelayedCompletedPlanBackgroundResumeWithReduceMotion() async throws {
    executionTimeAllowance = 180
    guard UIDevice.current.userInterfaceIdiom == .pad else {
      throw XCTSkip("This public Settings discriminator is scoped to the dedicated iPad simulator.")
    }
    app.terminate()
    let motion = motionSettings
    // Save before the first Settings mutation so tearDown restores on failure.
    originalReduceMotion = try motion.currentValue()
    try motion.setEnabled(true)
    app.launch()
    interruptionTiming("reduce-motion-matrix-start", "verifiedSettingsSwitch=true\nrunnerUIKitDiagnostic=\(UIAccessibility.isReduceMotionEnabled)", since: Date())
    try await delayedCompletedPlanBackgroundResumeDraft()
    XCTAssertTrue(try motion.currentValue(), "The actual OS setting must stay enabled throughout the workflow")
  }

  private func delayedCompletedPlanBackgroundResumeDraft() async throws {
    mergeForInterruptionMatrix()
    try await pairSyntheticPlanner()
    let before = try await syntheticEvidence()
    let started = Date()
    let composer = app.textViews.matching(NSPredicate(format: "label BEGINSWITH 'Tell atepdf what to do'")).firstMatch
    tap(composer);composer.typeText("Wait for cancellation")
    wait(composer, "value == 'Wait for cancellation'")
    tap(app.buttons["Send message"]);wait(composer, "value == ''")
    try await waitForSyntheticEvidence(calls: before.calls + 1)
    // The existing synthetic route completes after ten seconds if not stopped.
    // This deliberately exercises multiple progress-animation cycles, without
    // disabling XCTest idle checks or changing the production application.
    wait(app.staticTexts["Your new PDF is ready."], "exists == true", timeout: 35)
    wait(app.buttons["Cancel"], "exists == false")
    interruptionTiming("delayed-reply-completed", "", since: started)
    assertPages(3)
    _ = resumePairedDraft("delayed-reply")
    let after = try await syntheticEvidence()
    XCTAssertEqual(after.calls, before.calls + 1)
    XCTAssertEqual(after.cancelled, before.cancelled)
  }

  func testPairedNativePlannerProductAnswerMergeRemoveUndoAndCancel() async throws {
    // This port belongs exclusively to tests/native/planner/server.ts. It has
    // an injected synthetic provider and cannot read the owner's API key.
    var statusRequest=URLRequest(url:URL(string:"http://localhost:3212/api/planner/status")!)
    statusRequest.timeoutInterval=2
    guard let (data,_)=try? await URLSession.shared.data(for:statusRequest),
          let status=try JSONSerialization.jsonObject(with:data) as? [String:Any],let token=status["token"] as? String else { throw XCTSkip("Start the synthetic native test gateway on localhost:3212.") }
    var request=URLRequest(url:URL(string:"http://localhost:3212/api/planner/pairing")!)
    request.httpMethod="POST";request.httpBody=Data("{}".utf8);request.setValue("application/json",forHTTPHeaderField:"Content-Type");request.setValue("http://localhost:3212",forHTTPHeaderField:"Origin");request.setValue(token,forHTTPHeaderField:"X-Atepdf-Token")
    let (pairData,_)=try await URLSession.shared.data(for:request)
    let code=(try JSONSerialization.jsonObject(with:pairData) as! [String:Any])["code"] as! String
    addBundledSamples()
    wait(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH 'Your 2 PDFs are ready.'")).firstMatch,"exists == true")
    tap(app.buttons["AI connection"])
    let field=app.secureTextFields["Pairing code"]
    tapInConversation(field);field.typeText(code)
    tapInConversation(app.buttons["Connect this app"])
    wait(app.staticTexts["Connected to the local planner. Tell me what you’d like to do."],"exists == true")
    let composer=app.textViews.matching(NSPredicate(format:"label BEGINSWITH 'Tell atepdf what to do'")).firstMatch
    func send(_ text:String) {
      tap(composer);composer.typeText(text);wait(composer,"value == '\(text)'");tap(app.buttons["Send message"]);wait(composer,"value == ''")
    }
    send("What can atepdf do?")
    wait(app.staticTexts["I can merge PDFs and remove pages on your device. Your originals stay unchanged."],"exists == true")
    tap(app.buttons["Merge"]);assertPages(3)
    send("remove page 2");assertPages(2)
    send("undo");assertPages(3)
    send("Wait for cancellation")
    wait(app.buttons["Cancel"],"exists == true AND enabled == true");tap(app.buttons["Cancel"])
    wait(app.staticTexts["Planning cancelled. No local files changed."],"exists == true");assertPages(3)
    let beforeInterruption = try await syntheticEvidence()
    send("Wait for interruption")
    try await waitForSyntheticEvidence(calls: beforeInterruption.calls + 1)
    // Explicit Stop is the contract. Backgrounding alone is not documented as
    // cancellation; XCTest also waits for quiescence when activating the app.
    // Prove the transport cancels before interrupting, then test retained state
    // and the next real local action after an ordinary background/foreground.
    tap(app.buttons["Cancel"])
    wait(app.buttons["Cancel"], "exists == false")
    try await waitForSyntheticEvidence(cancelled: beforeInterruption.cancelled + 1)
    XCUIDevice.shared.press(.home)
    waitForState({
      self.app.state == .runningBackground || self.app.state == .runningBackgroundSuspended
    }, timeout: 5)
    app.activate()
    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
    assertPages(3)
    wait(app.buttons["Send message"], "exists == true AND enabled == false")
    capture("native-stop-then-background-return-preserves-result")
    send("remove page 2");assertPages(2)
    send("undo");assertPages(3)
    capture("native-paired-planner-complete-workflow")
    tap(app.buttons["AI connection"])
    let latest = app.buttons["Latest message"]
    if latest.exists { tap(latest) }
    tapInConversation(app.buttons["Disconnect this app"])
    wait(app.staticTexts["Disconnected. Local quick actions still work."],"exists == true")
    // Session persistence is not implemented. A true relaunch must not show
    // phantom artifacts or restore a native pairing token from disk.
    app.terminate();app.launch()
    wait(app.buttons["Try the two sample PDFs"])
    XCTAssertFalse(app.staticTexts["result-facts"].exists)
    tap(app.buttons["AI connection"])
    wait(app.secureTextFields["Pairing code"], "exists == true")
    capture("native-relaunch-fresh-session")
  }

  func testIPadLandscapeKeyboardAndPreview() throws {
    guard UIDevice.current.userInterfaceIdiom == .pad else { throw XCTSkip("iPad layout regression") }
    addBundledSamples()
    wait(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Your 2 PDFs are ready.'")).firstMatch, "exists == true")
    tap(app.buttons["Merge"]);assertPages(3)
    XCUIDevice.shared.orientation = .landscapeLeft
    waitForState { self.app.frame.width > self.app.frame.height }
    let composer = app.textViews.matching(NSPredicate(format: "label BEGINSWITH 'Tell atepdf what to do'")).firstMatch
    tap(composer);wait(app.keyboards.firstMatch, "exists == true")
    composer.typeText("remove page 2")
    wait(composer, "value == 'remove page 2'")
    XCTAssertLessThanOrEqual(composer.frame.maxY, app.keyboards.firstMatch.frame.minY + 1)
    XCTAssertGreaterThan(app.keyboards.firstMatch.frame.intersection(app.frame).height, 100, "A software keyboard must actually be visible for this layout check")
    XCTAssertLessThanOrEqual(app.buttons["Send message"].frame.maxY, app.keyboards.firstMatch.frame.minY + 1)
    XCTAssertGreaterThan(conversation.frame.height, 100)
    XCTAssertFalse(app.buttons["Merge"].exists)
    XCTAssertFalse(app.staticTexts["Current result · 3 pages"].exists)
    XCTAssertTrue(app.buttons["Send message"].isHittable)
    capture("ipad-landscape-keyboard-command")
    tap(app.buttons["Send message"]);wait(composer, "value == nil OR value == ''");assertPages(2)
    wait(app.buttons["Send message"], "exists == true AND enabled == false")
    let latest = app.buttons["Latest message"]
    if latest.exists { tap(latest) }
    tapInConversation(latestResultButton("Preview"))
    wait(app.images["PDF page 1"], "exists == true")
    tapInConversation(app.buttons["Next page"])
    wait(app.images["PDF page 2"], "exists == true")
    reveal(app.images["PDF page 2"]);reveal(app.buttons["Next page"])
    // Both centers can be visible while a short landscape viewport clips the
    // raster's lower edge. Move only the measured overflow, preserving the
    // navigation center inside the viewport, before asserting actual visibility.
    let viewport = conversation.frame, raster = app.images["PDF page 2"].frame
    let navigationRoom = app.buttons["Next page"].frame.midY - viewport.minY - 12
    let correction = min(max(0, raster.maxY - viewport.maxY + 2), max(0, navigationRoom))
    if correction > 0 {
      let start = conversation.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.75))
      let finish = conversation.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.75 - correction / viewport.height))
      start.press(forDuration: 0.05, thenDragTo: finish, withVelocity: .slow, thenHoldForDuration: 0.1)
    }
    // Interactive scrolling may dismiss the software keyboard. Re-establish
    // one settled keyboard-visible state before measuring simultaneous layout;
    // do not combine a pre-drag keyboard frame with a post-drag preview frame.
    tap(composer)
    var previousViewport: CGRect?
    var stableSince = Date()
    waitForState({
      let viewport = self.conversation.frame
      guard self.app.keyboards.firstMatch.exists,
            self.app.keyboards.firstMatch.frame.intersection(self.app.frame).height > 100 else {
        previousViewport = nil
        return false
      }
      if previousViewport != viewport {
        previousViewport = viewport
        stableSince = Date()
        return false
      }
      return Date().timeIntervalSince(stableSince) >= 0.3
    })
    let settledViewport = conversation.frame
    let settledKeyboard = app.keyboards.firstMatch.frame
    let settledComposer = composer.frame
    let settledSend = app.buttons["Send message"].frame
    let settledNavigation = app.buttons["Next page"].frame
    let settledRaster = app.images["PDF page 2"].frame
    let frames = XCTAttachment(string: "app=\(app.frame)\nkeyboard=\(settledKeyboard)\nconversation=\(settledViewport)\ncomposer=\(settledComposer)\nsend=\(settledSend)\nnext=\(settledNavigation)\nraster=\(settledRaster)")
    frames.name = "ipad-landscape-simultaneous-preview-keyboard-frames"
    frames.lifetime = .keepAlways;add(frames)
    capture("ipad-landscape-simultaneous-preview-keyboard")
    XCTAssertGreaterThan(settledKeyboard.intersection(app.frame).height, 100)
    XCTAssertLessThanOrEqual(settledComposer.maxY, settledKeyboard.minY + 1)
    XCTAssertLessThanOrEqual(settledSend.maxY, settledKeyboard.minY + 1)
    XCTAssertTrue(composer.isHittable && app.buttons["Send message"].isHittable)
    XCTAssertGreaterThan(settledRaster.intersection(settledViewport).height, 80)
    XCTAssertTrue(app.buttons["Next page"].isHittable && settledNavigation.midY > settledViewport.minY + 8 && settledNavigation.midY < settledViewport.maxY - 8)
    XCTAssertTrue(app.staticTexts["Page 2 of 2"].exists)
    capture("ipad-landscape-preview-second-page")
    XCUIDevice.shared.orientation = .portrait
    waitForState { self.app.frame.height > self.app.frame.width }
    assertPages(2)
    tapInConversation(app.buttons["Close preview"])
    wait(app.buttons["Close preview"], "exists == false")
    capture("ipad-portrait-after-rotation")
  }

  func testPinnedTLSPlannerMergeThroughNativeInterface() async throws {
    // The companion harness binds only 127.0.0.1:3444/3445 and constructs its
    // own synthetic provider and temporary certificate chain, never LocalConfig.
    func evidence() async throws -> Int {
      let (data, _) = try await URLSession.shared.data(from: URL(string: "http://127.0.0.1:3445/test/evidence")!)
      let value = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
      XCTAssertEqual(value["syntheticOnly"] as? Bool, true)
      return try XCTUnwrap(value["calls"] as? Int)
    }
    let before = try await evidence()
    let (data, _) = try await URLSession.shared.data(from: URL(string: "http://127.0.0.1:3445/test/pairing")!)
    let pairing = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    let code = try XCTUnwrap(pairing["code"] as? String)
    XCTAssertTrue(code.hasPrefix("atepdf-beta:"))
    addBundledSamples()
    wait(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Your 2 PDFs are ready.'")).firstMatch, "exists == true")
    tap(app.buttons["AI connection"])
    let field = app.secureTextFields["Pairing code"]
    tapInConversation(field);field.typeText(code)
    tapInConversation(app.buttons["Connect this app"])
    wait(app.staticTexts["Connected to the local planner. Tell me what you’d like to do."], "exists == true")
    let composer = app.textViews.matching(NSPredicate(format: "label BEGINSWITH 'Tell atepdf what to do'")).firstMatch
    tap(composer);composer.typeText("Merge the two PDFs")
    wait(composer, "value == 'Merge the two PDFs'")
    tap(app.buttons["Send message"]);wait(composer, "value == ''")
    assertPages(3)
    let after = try await evidence()
    XCTAssertEqual(after, before + 1, "The synthetic TLS provider must receive the request; local fallback is not this test.")
    if app.buttons["Latest message"].exists { tap(app.buttons["Latest message"]) }
    reveal(latestResultButton("Save PDF"))
    capture("ipad-native-pinned-tls-local-merge")
    tap(app.buttons["AI connection"])
    let latest = app.buttons["Latest message"]
    if latest.exists { tap(latest) }
    tapInConversation(app.buttons["Disconnect this app"])
    wait(app.staticTexts["Disconnected. Local quick actions still work."], "exists == true")
  }

  func testNativeComposerPreservesFastTypingAndBackspace() throws {
    let composer = app.textViews.matching(NSPredicate(format: "label BEGINSWITH 'Tell atepdf what to do'")).firstMatch
    tap(composer)
    wait(app.keyboards.firstMatch, "exists == true")
    composer.typeText("remove page 2")
    wait(composer, "value == 'remove page 2'")
    composer.typeText("x")
    wait(composer, "value == 'remove page 2x'")
    composer.typeText(XCUIKeyboardKey.delete.rawValue)
    wait(composer, "value == 'remove page 2'")
    capture("native-exact-fast-input-and-backspace")
  }

  func testPreviewToolbarControlsRemainReachableAtCurrentTextSize() throws {
    addBundledSamples()
    wait(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Your 2 PDFs are ready.'")).firstMatch, "exists == true")
    tap(app.buttons["Merge"]);assertPages(3)
    tapInConversation(latestResultButton("Preview"))
    wait(app.images["PDF page 1"], "exists == true")
    tapInConversation(app.buttons["Next page"])
    wait(app.images["PDF page 2"], "exists == true")
    func visibleControl(_ label: String) -> XCUIElement {
      let button = app.buttons[label]
      reveal(button)
      XCTAssertGreaterThanOrEqual(button.frame.width, 44)
      XCTAssertGreaterThanOrEqual(button.frame.height, 44)
      XCTAssertGreaterThanOrEqual(button.frame.minX, conversation.frame.minX)
      XCTAssertLessThanOrEqual(button.frame.maxX, conversation.frame.maxX)
      return button
    }
    tap(visibleControl("Zoom in"))
    wait(app.buttons["Zoom out"], "exists == true AND enabled == true")
    tap(visibleControl("Zoom out"))
    wait(app.buttons["Zoom out"], "exists == true AND enabled == false")
    tap(visibleControl("Zoom in"))
    tap(visibleControl("Fit page"))
    wait(app.buttons["Zoom out"], "exists == true AND enabled == false")
    tap(visibleControl("Previous page"))
    wait(app.images["PDF page 1"], "exists == true")
    _ = visibleControl("Zoom in")
    let controls = XCTAttachment(string: app.debugDescription)
    controls.name = "preview-controls-at-current-text-size";controls.lifetime = .keepAlways;add(controls)
    capture("native-preview-controls-at-current-text-size")
    tap(visibleControl("Close preview"))
    wait(app.buttons["Close preview"], "exists == false")
  }

  func testBackgroundResumeTypingWithoutPlanner() throws {
    // Isolates the observed foreground quiescence warning from planner/jobs.
    executionTimeAllowance = 180
    let composer = app.textViews.matching(NSPredicate(format: "label BEGINSWITH 'Tell atepdf what to do'")).firstMatch
    tap(composer);composer.typeText("remove")
    wait(composer, "value == 'remove'")
    XCUIDevice.shared.press(.home)
    waitForState { self.app.state == .runningBackground || self.app.state == .runningBackgroundSuspended }
    app.activate()
    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
    tap(composer);composer.typeText(" page 2")
    wait(composer, "value == 'remove page 2'")
    capture("native-background-resume-typing-without-planner")
  }

  func testPopulatedLocalThreadBackgroundResumeTypingWithoutPlanner() throws {
    executionTimeAllowance = 180
    addBundledSamples()
    wait(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Your 2 PDFs are ready.'")).firstMatch, "exists == true")
    tap(app.buttons["Merge"]);assertPages(3)
    XCTAssertFalse(app.buttons["Cancel"].exists)
    let resultReady = Date()
    let composer = app.textViews.matching(NSPredicate(format: "label BEGINSWITH 'Tell atepdf what to do'")).firstMatch
    tap(composer);composer.typeText("remove")
    wait(composer, "value == 'remove'")
    let timing = XCTAttachment(string: "secondsBetweenValidatedResultAndHome=\(Date().timeIntervalSince(resultReady))")
    timing.name = "populated-thread-background-timing";timing.lifetime = .keepAlways;add(timing)
    XCUIDevice.shared.press(.home)
    waitForState { self.app.state == .runningBackground || self.app.state == .runningBackgroundSuspended }
    app.activate()
    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
    assertPages(3)
    tap(composer);composer.typeText(" page 2")
    wait(composer, "value == 'remove page 2'")
    capture("native-populated-local-thread-resume-without-planner")
  }

  func testAsyncPopulatedLocalThreadBackgroundResumeWithoutPlanner() async throws {
    // Only the XCTest entrypoint changes: no transport, await, or app behavior.
    // Distinguishes the async paired-test runner from the passing sync baseline.
    try testPopulatedLocalThreadBackgroundResumeTypingWithoutPlanner()
  }

  func testSyntheticFilesPickerOCRAndCompression() throws {
    guard UIDevice.current.userInterfaceIdiom == .pad else { throw XCTSkip("Bounded iPad Files-picker acceptance") }
    // Actual Safari download and system Files picker, not app-container writes
    // or a test-only input path. This server serves exactly two tracked fixtures.
    let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
    safari.open(URL(string: "http://127.0.0.1:3448/")!)
    for title in ["Continue", "Start Browsing"] {
      let button = safari.buttons[title]
      if button.waitForExistence(timeout: 2) && button.isHittable { button.tap() }
    }
    let safariHierarchy = XCTAttachment(string: safari.debugDescription)
    safariHierarchy.name = "synthetic-safari-download-page"
    safariHierarchy.lifetime = .keepAlways;add(safariHierarchy)
    for name in ["mixed-text-and-scan.pdf", "image-heavy.pdf"] {
      tap(safari.links["Download \(name)"])
      let download = safari.buttons["Download"]
      if download.waitForExistence(timeout: 5) { tap(download) }
    }
    capture("synthetic-fixtures-downloaded-in-safari")
    app.activate()
    for (index, name) in ["mixed-text-and-scan", "image-heavy"].enumerated() {
      tap(app.buttons[index == 0 ? "Choose files" : "Add files"])
      let browse = app.buttons["Browse"]
      if browse.waitForExistence(timeout: 3) && browse.isHittable { browse.tap() }
      // Match the observed sidebar cell, not ambiguous folder/sidebar text.
      // The picker remembers its prior folder across application launches.
      tap(app.cells["DOC.sidebar.item.Downloads"])
      let picker = XCTAttachment(string: app.debugDescription)
      picker.name = "files-picker-\(name)";picker.lifetime = .keepAlways;add(picker)
      let file = app.cells.matching(NSPredicate(format: "label CONTAINS %@", name)).firstMatch
      tap(file)
      // The multi-select system picker only marks a cell selected. Its visible
      // Open action commits the selection and resolves the app's import prompt.
      tap(app.buttons["Open"])
      wait(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Your \(index + 1) PDF")).firstMatch, "exists == true")
    }
    tap(app.buttons["Merge"]);assertPages(4)
    tap(app.buttons["Make searchable"])
    wait(app.staticTexts["Your searchable copy is ready."], "exists == true", timeout: 90)
    assertPages(4);capture("native-files-picker-ocr-four-pages")
    tap(app.buttons["Compress"])
    let latest = app.buttons["Latest message"]
    if latest.exists { tap(latest) }
    tapInConversation(app.buttons["Create optimised copy"])
    wait(app.staticTexts["I checked the optimised copy. Here’s the result."], "exists == true", timeout: 90)
    assertPages(4);capture("native-files-picker-compressed-four-pages")
  }

  func testCancelledPlannerBackgroundResumeKeepsResultAndDraft() async throws {
    executionTimeAllowance = 180
    // Isolate explicit Stop + interruption without the long chat's repeated
    // result/preview/connection scrolling. Real local merge, synthetic planner.
    mergeForInterruptionMatrix()
    try await pairSyntheticPlanner()
    let before = try await syntheticEvidence()
    let composer = app.textViews.matching(NSPredicate(format: "label BEGINSWITH 'Tell atepdf what to do'")).firstMatch
    tap(composer);composer.typeText("Wait for interruption")
    wait(composer, "value == 'Wait for interruption'")
    tap(app.buttons["Send message"])
    try await waitForSyntheticEvidence(calls: before.calls + 1)
    // Hold a pending request across multiple progress cycles, matching the
    // sustained-success discriminator. This is not an idle/quiescence bypass.
    try await Task.sleep(for: .seconds(2))
    tap(app.buttons["Cancel"])
    wait(app.buttons["Cancel"], "exists == false")
    try await waitForSyntheticEvidence(cancelled: before.cancelled + 1)
    assertPages(3)
    let cancelled = try await syntheticEvidence()
    interruptionTiming("cancel-observed", "calls=\(cancelled.calls)\ncancelled=\(cancelled.cancelled)", since: Date())
    let continuedComposer = resumePairedDraft("cancelled-plan")
    tap(app.buttons["Send message"])
    wait(continuedComposer, "value == ''");assertPages(2)
    capture("native-cancel-background-resume-and-next-action")
  }

  func testBundledMergePreviewRemovalUndoAndShareDismissal() throws {
    addBundledSamples()
    wait(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Your 2 PDFs are ready.'")).firstMatch, "exists == true")
    XCTAssertTrue(app.staticTexts["brief.pdf"].exists)
    XCTAssertTrue(app.staticTexts["appendix.pdf"].exists)
    capture("01-bundled-originals")

    tap(app.buttons["Merge"])
    assertPages(3)
    capture("02-merged-three-pages")

    tapInConversation(latestResultButton("Preview"))
    wait(app.images["PDF page 1"], "exists == true")
    reveal(app.images["PDF page 1"])
    XCTAssertTrue(app.staticTexts["Page 1 of 3"].exists)
    tapInConversation(app.buttons["Next page"])
    wait(app.images["PDF page 2"], "exists == true")
    reveal(app.images["PDF page 2"])
    reveal(app.buttons["Next page"])
    XCTAssertGreaterThan(app.images["PDF page 2"].frame.intersection(conversation.frame).height, 80)
    XCTAssertTrue(visibleInConversation(app.buttons["Next page"]))
    XCTAssertTrue(app.staticTexts["Page 2 of 3"].exists)
    capture("03-inline-preview-second-page")
    tapInConversation(app.buttons["Close preview"])
    wait(app.buttons["Close preview"], "exists == false")

    let composer = app.textViews.matching(NSPredicate(format: "label BEGINSWITH 'Tell atepdf what to do'")).firstMatch
    tap(composer)
    wait(app.keyboards.firstMatch, "exists == true")
    composer.typeText("remove page 2")
    wait(composer, "value == 'remove page 2'")
    composer.typeText("x")
    wait(composer, "value == 'remove page 2x'")
    composer.typeText(XCUIKeyboardKey.delete.rawValue)
    wait(composer, "value == 'remove page 2'")
    let geometry = XCTAttachment(string: "conversation=\(conversation.frame)\ncomposer=\(composer.frame)\nsend=\(app.buttons["Send message"].frame)\nkeyboard=\(app.keyboards.firstMatch.frame)")
    geometry.name = "keyboard-workspace-geometry"
    geometry.lifetime = .keepAlways
    add(geometry)
    XCTAssertGreaterThan(conversation.frame.height, 100, "Keyboard must leave usable conversation space")
    XCTAssertGreaterThan(app.keyboards.firstMatch.frame.intersection(app.frame).height, 100, "A software keyboard must actually be visible for this layout check")
    XCTAssertLessThanOrEqual(composer.frame.maxY, app.keyboards.firstMatch.frame.minY + 1)
    XCTAssertLessThanOrEqual(app.buttons["Send message"].frame.maxY, app.keyboards.firstMatch.frame.minY + 1)
    capture("04-command-ready")
    tap(app.buttons["Send message"])
    wait(composer, "value == nil OR value == ''")
    assertPages(2)
    wait(app.buttons["Send message"], "exists == true AND enabled == false")
    capture("04-follow-up-two-pages")

    // A second draft after Send proves the native field and model reset together.
    tap(composer)
    composer.typeText("undo")
    wait(composer, "value == 'undo'")
    tap(app.buttons["Send message"])
    wait(composer, "value == nil OR value == ''")
    assertPages(3)
    wait(app.buttons["Send message"], "exists == true AND enabled == false")
    capture("05-undo-restores-three-pages")

    // Opening then dismissing the system sheet proves presentation, not a saved
    // destination. Never select a share service, contact, cloud folder or Files.
    // The keyboard leaves a short conversation viewport. Use the visible
    // template affordance to return to the newest result before precise scroll.
    let latest = app.buttons["Latest message"]
    if latest.exists { tap(latest) }
    tapInConversation(latestResultButton("Save PDF"))
    let activity = app.otherElements["ActivityListView"]
    wait(activity, "exists == true")
    // iOS 27 presents this as a popover with a semantic outside-dismiss region;
    // earlier versions may show an explicit Close/Cancel button instead.
    let dismissRegion = app.otherElements["PopoverDismissRegion"]
    let dismiss = app.buttons.matching(NSPredicate(format: "label == 'Close' OR label == 'Cancel'")).firstMatch
    if dismissRegion.exists { tap(dismissRegion) } else { tap(dismiss) }
    wait(activity, "exists == false")
    wait(app.staticTexts["Share sheet closed · check the destination you chose"], "exists == true")
    assertPages(3)
    XCTAssertFalse(app.staticTexts["Saved to your device"].exists)
    capture("06-share-dismissed-with-honest-receipt")
  }
}
