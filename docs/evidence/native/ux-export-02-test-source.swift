import XCTest
import UIKit

/// Public-UI-only export acceptance. Uses bundled synthetic PDFs, never a
/// container-injected document, network provider, private API or idle override.
/// System selectors were established through bounded screenshot/hierarchy probes.
@MainActor
final class AtepdfExportUITests: XCTestCase {
  private var app: XCUIApplication!

  override func setUpWithError() throws {
    continueAfterFailure = false
    executionTimeAllowance = 180
    XCUIDevice.shared.orientation = .portrait
    app = XCUIApplication(bundleIdentifier: "dev.atepdf.fresh")
    app.launch()
  }

  override func tearDownWithError() throws {
    if let app {
      capture("export-final-state", application: app)
      app.terminate()
    }
    XCUIDevice.shared.orientation = .portrait
  }

  private func wait(_ element: XCUIElement, _ predicate: String = "exists == true AND hittable == true AND enabled == true",
                    file: StaticString = #filePath, line: UInt = #line) {
    let expectation = XCTNSPredicateExpectation(predicate: NSPredicate(format: predicate), object: element)
    XCTAssertEqual(XCTWaiter.wait(for: [expectation], timeout: 20), .completed,
                   "Expected visible system/app control: \(element)", file: file, line: line)
  }

  private func tap(_ element: XCUIElement, file: StaticString = #filePath, line: UInt = #line) {
    wait(element, file: file, line: line)
    element.tap()
  }

  private func uniqueVisible(_ query: XCUIElementQuery, _ description: String,
                             file: StaticString = #filePath, line: UInt = #line) throws -> XCUIElement {
    let candidates = query.allElementsBoundByIndex.filter { $0.exists && $0.isHittable && $0.isEnabled }
    XCTAssertEqual(candidates.count, 1, "Expected one unambiguous \(description)", file: file, line: line)
    return try XCTUnwrap(candidates.first, file: file, line: line)
  }

  private func pickerHeading() throws -> (name: String, element: XCUIElement) {
    let bar = try uniqueVisible(app.navigationBars.matching(identifier: "FullDocumentManagerViewControllerNavigationBar"),
                                "visible system save navigation bar")
    // The directory title is either the root's text or a folder's Actions Menu
    // button. Both forms were observed in the actual iOS 27 picker. Hidden
    // browsing-root container identities and the generic Back label are not
    // evidence of the currently displayed directory.
    let headings = bar.staticTexts.matching(NSPredicate(format: "label == 'On My iPhone'")).allElementsBoundByIndex
      + bar.buttons.matching(NSPredicate(format: "label ENDSWITH ', Actions Menu'")).allElementsBoundByIndex
    let visible = headings.filter { $0.exists && $0.isHittable }
    XCTAssertEqual(visible.count, 1, "Expected one visible system directory heading")
    let element = try XCTUnwrap(visible.first)
    let suffix = ", Actions Menu"
    let label = element.label
    // Bind to the observed title, not its position: the parent may also have an
    // Actions Menu button at index zero after navigating upward.
    let exactHeading = bar.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
    return (label.hasSuffix(suffix) ? String(label.dropLast(suffix.count)) : label, exactHeading)
  }

  private func leaveVisibleQAFolder(_ heading: (name: String, element: XCUIElement)) throws {
    let prefix = "atepdf-beta-"
    XCTAssertTrue(heading.name.hasPrefix(prefix), "Only navigate upward from an identified local QA folder")
    XCTAssertNotNil(UUID(uuidString: String(heading.name.dropFirst(prefix.count))), "The visible QA folder must have its exact UUID name")
    let back = try uniqueVisible(app.buttons.matching(identifier: "BackButton"), "visible system picker parent control")
    tap(back)
    wait(heading.element, "exists == false OR hittable == false")
    XCTAssertNotEqual(try pickerHeading().name, heading.name, "The observed parent action must change the visible directory")
  }

  private func capture(_ name: String, application: XCUIApplication) {
    let hierarchy = XCTAttachment(string: application.debugDescription)
    hierarchy.name = name + "-hierarchy"
    hierarchy.lifetime = .keepAlways
    add(hierarchy)
    let screenshot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    screenshot.name = name
    screenshot.lifetime = .keepAlways
    add(screenshot)
  }

  private func reveal(_ element: XCUIElement, in scroll: XCUIElement,
                      file: StaticString = #filePath, line: UInt = #line) {
    wait(element, "exists == true", file: file, line: line)
    wait(scroll, "exists == true", file: file, line: line)
    for _ in 0..<6 {
      let viewport = scroll.frame, target = element.frame
      guard viewport.height > 0 else { XCTFail("No visible scroll viewport", file: file, line: line); return }
      if element.isHittable && viewport.insetBy(dx: 0, dy: 8).contains(CGPoint(x: target.midX, y: target.midY)) { return }
      let downward = target.minY < viewport.minY
      let distance = min(0.45, max(0.12, abs(viewport.midY - target.midY) / viewport.height))
      let startY: CGFloat = downward ? 0.25 : 0.75
      let start = scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: startY))
      let finish = scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: startY + (downward ? distance : -distance)))
      start.press(forDuration: 0.05, thenDragTo: finish, withVelocity: .slow, thenHoldForDuration: 0.1)
    }
    XCTAssertTrue(element.isHittable && scroll.frame.contains(CGPoint(x: element.frame.midX, y: element.frame.midY)),
                  "Control must be reachable by ordinary scrolling", file: file, line: line)
  }

  func testSaveToLocalFilesAndReopenAfterRestart() throws {
    guard UIDevice.current.userInterfaceIdiom == .phone else { throw XCTSkip("iPhone-only local Files acceptance") }
    let samples = app.buttons["Try the two sample PDFs"]
    reveal(samples, in: app.scrollViews.firstMatch)
    tap(samples)
    wait(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Your 2 PDFs are ready.'")).firstMatch,
         "exists == true")
    tap(app.buttons["Merge"])
    wait(app.staticTexts["result-facts"], "exists == true AND label BEGINSWITH '3 pages'")

    let save = app.buttons["Save PDF"]
    reveal(save, in: app.otherElements["conversation"].scrollViews.firstMatch)
    tap(save)
    wait(app.otherElements["ActivityListView"], "exists == true")
    // Observed in docs/evidence/native/ios-ui-final-hierarchy.txt. Preserve the
    // actual new source basename; never infer a previous export's random name.
    let caption = app.otherElements["LP.CaptionBar.TopCaption"]
    wait(caption, "exists == true")
    let base = caption.label.hasSuffix(".pdf") ? String(caption.label.dropLast(4)) : caption.label
    XCTAssertNotNil(UUID(uuidString: base), "The prepared synthetic export should have a fresh UUID basename")
    let folder = "atepdf-beta-" + base
    let simulator = ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "unavailable; use xcresult device identity"
    let identity = XCTAttachment(string: "simulatorUDID=\(simulator)\nsourceBasename=\(base)\nexpectedFileName=\(base).pdf\nexpectedPageMarkers=A1,A2,B1\nrequiredDestination=On My iPhone/\(folder)\nstatus=prepared; not saved")
    identity.name = "export-source-identity"
    identity.lifetime = .keepAlways
    add(identity)
    capture("export-share-before-save", application: app)

    let saveToFiles = app.cells.matching(NSPredicate(format: "identifier == 'actionGroupCell' AND label == 'Save to Files'")).firstMatch
    tap(saveToFiles)
    // A normal action idle wait can return before a remote activity presents.
    // Require the observed source action to leave the active surface, without
    // guessing the new picker's controls or treating a tap as successful save.
    wait(saveToFiles, "exists == false OR hittable == false")
    capture("export-system-save-picker", application: app)
    // These controls were observed in the preceding bounded picker probe.
    // Inspect the system's folder action before choosing an unobserved item.
    let localRootID = "DOC.browsingRoot Source: com.apple.FileProvider.LocalStorage, Title: On My iPhone"
    let localFolderID = "DOC.browsingRoot Source: com.apple.FileProvider.LocalStorage, Title: " + folder
    wait(app.navigationBars["FullDocumentManagerViewControllerNavigationBar"], "exists == true")
    // Generic Back labels are allowed only after the visible heading identifies
    // this test's local QA folder. Each observed parent action must change it.
    var atLocalRoot = false
    for _ in 0..<5 {
      let heading = try pickerHeading()
      if heading.name == "On My iPhone" { atLocalRoot = true; break }
      capture("export-picker-parent-" + heading.name, application: app)
      try leaveVisibleQAFolder(heading)
    }
    XCTAssertTrue(atLocalRoot, "Must reach the actual local root before creating a fresh folder")
    XCTAssertEqual(try pickerHeading().name, "On My iPhone")
    wait(app.otherElements[localRootID], "exists == true")
    tap(app.buttons["OverflowBarButtonItem"])
    capture("export-system-save-folder-actions", application: app)
    tap(app.buttons["New Folder"])
    // iOS 27 creates a new folder and selects its name inline. This actual
    // editor was observed in the preceding probe; the source filename is a
    // separate TextField and is never edited.
    let rename = app.textViews["DOC.inlineRenameField"]
    wait(rename)
    capture("export-system-new-folder-editor", application: app)
    let initialName = try XCTUnwrap(rename.value as? String)
    XCTAssertFalse(initialName.isEmpty)
    rename.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: initialName.count) + folder + "\n")
    wait(rename, "exists == false OR hittable == false")
    // Return enters the new folder. Prove its direct parent by actually returning
    // to the visible local root, finding the exact new cell, and entering again.
    wait(app.otherElements[localFolderID], "exists == true")
    let newHeading = try pickerHeading()
    XCTAssertEqual(newHeading.name, folder)
    try leaveVisibleQAFolder(newHeading)
    XCTAssertEqual(try pickerHeading().name, "On My iPhone", "The new export folder must be a direct local-root child")
    let newFolderCell = app.cells[folder + ", Folder"]
    reveal(newFolderCell, in: app.collectionViews["File View"])
    capture("export-new-folder-at-local-root", application: app)
    tap(newFolderCell)
    XCTAssertEqual(try pickerHeading().name, folder)
    capture("export-local-destination-before-save", application: app)
    tap(app.buttons["DOCPicker.actionButton"])
    wait(app.staticTexts["Share sheet closed · check the destination you chose"], "exists == true")
    capture("export-share-completed", application: app)

    // A fresh atepdf launch clears its owned disposable export source. Only
    // the independent copy in the chosen Files destination should be reopened.
    app.terminate()
    app.launch()
    wait(app.buttons["Try the two sample PDFs"], "exists == true")
    XCTAssertFalse(app.staticTexts["result-facts"].exists, "The new atepdf session must not supply the old result")
    capture("export-after-atepdf-restart", application: app)

    try openSavedExport(folders: [folder], base: base, simulator: simulator)
  }

  private func openSavedExport(folders: [String], base: String, simulator: String) throws {
    let files = XCUIApplication(bundleIdentifier: "com.apple.DocumentsApp")
    files.launch()
    capture("export-files-initial", application: files)
    // Browse can reveal the locations sidebar while retaining a hidden prior
    // browsing-root container. Select the observed local sidebar row explicitly.
    let browse = files.tabBars.buttons["Browse"]
    tap(browse)
    let localLocation = files.cells["DOC.sidebar.item.On My iPhone"]
    if !(localLocation.exists && localLocation.isHittable) { tap(browse) }
    capture("export-files-browse", application: files)
    tap(localLocation)
    wait(files.collectionViews["File View"])
    capture("export-files-local-root", application: files)
    for folder in folders {
      let savedFolder = files.cells[folder + ", Folder"]
      reveal(savedFolder, in: files.collectionViews["File View"])
      tap(savedFolder)
      let root = files.otherElements["DOC.browsingRoot Source: com.apple.FileProvider.LocalStorage, Title: " + folder]
      wait(root, "exists == true")
      capture("export-files-folder-" + folder, application: files)
    }
    // Actual Files cell labels append metadata, while their identifiers retain
    // the full basename and PDF type. No recent/nearest-name fallback is used.
    let fileQuery = files.cells.matching(NSPredicate(format: "identifier == %@ OR identifier == %@ OR label == %@ OR label == %@", base + ", pdf", base + ".pdf, pdf", base, base + ".pdf"))
    tap(try uniqueVisible(fileQuery, "exact UUID-named saved PDF"))
    let preview = XCUIApplication(bundleIdentifier: "com.apple.Preview")
    let systemPreview = preview.wait(for: .runningForeground, timeout: 10)
    let viewer = systemPreview ? preview : files
    // Foreground state precedes Preview's document UI during app launch. Wait
    // for the exact document title before capturing the rendered-view evidence.
    let documentTitle = viewer.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", base)).firstMatch
    wait(documentTitle, "exists == true")
    capture("export-independent-reopen", application: viewer)
    XCTAssertTrue(systemPreview || files.navigationBars.matching(NSPredicate(format: "identifier CONTAINS %@ OR label CONTAINS %@", base, base)).firstMatch.exists,
                  "The exact selected export must open in the independent system PDF viewer")
    let saved = XCTAttachment(string: "simulatorUDID=\(simulator)\nfileName=\(base).pdf\nlocalDestination=On My iPhone/\(folders.joined(separator: "/"))\natepdfRestartedBeforeReopen=true\nviewer=\(systemPreview ? "com.apple.Preview" : "Files Quick Look")\nstatus=copy selected from exact local folder; screenshot must prove actual document rendering\npreserveOutput=true")
    saved.name = "export-saved-identity"
    saved.lifetime = .keepAlways
    add(saved)
  }
}
