import XCTest

/// Drives the release application's real interface with bundled synthetic PDFs.
/// No test engine, planner transport, private documents or purchase adapter.
@MainActor
final class AtepdfWorkflowUITests: XCTestCase {
  private var app: XCUIApplication!

  override func setUpWithError() throws {
    continueAfterFailure = false
    app = XCUIApplication(bundleIdentifier: "dev.atepdf.fresh")
    app.launch()
  }

  override func tearDownWithError() throws {
    if let app {
      let hierarchy = XCTAttachment(string: app.debugDescription)
      hierarchy.name = "final-accessibility-hierarchy"
      hierarchy.lifetime = .keepAlways
      add(hierarchy)
      capture("final-screen")
      app.terminate()
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
    XCTAssertTrue(app.staticTexts["Current result · \(count) pages"].exists, file: file, line: line)
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
    tap(app.buttons["Try the two sample PDFs"])
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
    capture("native-paired-planner-complete-workflow")
    tap(app.buttons["AI connection"]);tapInConversation(app.buttons["Disconnect this app"])
    wait(app.staticTexts["Disconnected. Local quick actions still work."],"exists == true")
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

  func testBundledMergePreviewRemovalUndoAndShareDismissal() throws {
    tap(app.buttons["Try the two sample PDFs"])
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
