import XCTest
import UIKit

/// Public Settings UI only. Run on the dedicated iPad simulator, never a
/// personal device. No preference files, hidden routes, launch overrides,
/// planner, document injection or production credentials are used.
@MainActor
final class AtepdfAccessibilityUITests: XCTestCase {
  private let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
  private let motionSettings = AtepdfPublicReduceMotion()
  private let app = XCUIApplication(bundleIdentifier: "dev.atepdf.fresh")
  private var originalReduceMotion: Bool?
  private var appWasLaunched = false

  private enum ProbeFailure: Error {
    case unavailable(String)
  }

  override func setUpWithError() throws {
    continueAfterFailure = false
    executionTimeAllowance = 180
    guard UIDevice.current.userInterfaceIdiom == .pad else {
      throw XCTSkip("This public Settings acceptance test is scoped to the spare iPad simulator.")
    }
  }

  override func tearDownWithError() throws {
    // Register the original value before the first tap. Restore even when an
    // application assertion fails; never claim restoration from a write alone.
    defer { if appWasLaunched { app.terminate() } }
    if let originalReduceMotion {
      try motionSettings.setEnabled(originalReduceMotion)
      capture(settings, "reduce-motion-restored")
      attach("restore-confirmation", "settingsSwitch=\(originalReduceMotion)\ntestRunnerUIKitDiagnostic=\(UIAccessibility.isReduceMotionEnabled)")
    }
  }

  /// Run this first to obtain observed Settings selectors and the initial value.
  /// It navigates ordinary rows and reads the switch without changing it.
  func testProbePublicReduceMotionSettings() throws {
    let control = try openReduceMotion()
    let value = try switchValue(control)
    attach("reduce-motion-original", "settingsSwitch=\(value)\ntestRunnerUIKitDiagnostic=\(UIAccessibility.isReduceMotionEnabled)")
    capture(settings, "reduce-motion-public-settings-probe")
  }

  func testLocalPDFWorkflowWithReduceMotionEnabled() throws {
    originalReduceMotion = try motionSettings.currentValue()
    try motionSettings.setEnabled(true)
    capture(settings, "reduce-motion-enabled")
    attach("motion-evidence-boundary", "The public Settings switch is on. UIAccessibility getter below belongs to the background test runner, not atepdf, and is diagnostic only: \(UIAccessibility.isReduceMotionEnabled)")

    app.launch()
    appWasLaunched = true
    let samples = app.buttons["Try the two sample PDFs"]
    try wait(samples)
    try reveal(samples, in: app.scrollViews.firstMatch)
    samples.tap()
    try wait(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Your 2 PDFs are ready.")).firstMatch)
    try tap(app.buttons["Merge"])
    try assertPages(3)
    capture(app, "reduced-motion-real-local-merge")

    let previews = app.buttons.matching(identifier: "Preview")
    guard previews.count > 0 else { throw ProbeFailure.unavailable("No validated result Preview control") }
    let preview = previews.element(boundBy: previews.count - 1)
    try reveal(preview, in: conversation)
    try tap(preview)
    try wait(app.images["PDF page 1"])
    let next = app.buttons["Next page"]
    try reveal(next, in: conversation)
    try tap(next)
    try wait(app.images["PDF page 2"])
    try reveal(app.images["PDF page 2"], in: conversation)
    XCTAssertGreaterThan(app.images["PDF page 2"].frame.intersection(conversation.frame).height, 80,
                         "The actual rendered page must be visible, not just present in the hierarchy")
    capture(app, "reduced-motion-inline-page-two")
    let close = app.buttons["Close preview"]
    try reveal(close, in: conversation)
    try tap(close)
    try wait(app.buttons["Send message"], "exists == true AND enabled == false")

    try send("remove page 2")
    try assertPages(2)
    try send("undo")
    try assertPages(3)
    try wait(app.buttons["Send message"], "exists == true AND enabled == false")
    capture(app, "reduced-motion-local-workflow-complete")
    let finalControl = try openReduceMotion()
    try waitForValue(finalControl, true)
    capture(settings, "reduce-motion-still-on-after-workflow")
    attach("reduced-motion-workflow-scope", "The public Settings Reduce Motion switch was verified on before fresh app launch and after actual local import, merge, preview, removal and undo. No planner was used. This proves usable operations under that OS configuration, not the app-process getter or frame-by-frame animation state. Teardown separately restores the original switch value.")
  }

  private var conversation: XCUIElement { app.otherElements["conversation"].scrollViews.firstMatch }

  private func openReduceMotion() throws -> XCUIElement { try motionSettings.control() }
  private func switchValue(_ control: XCUIElement) throws -> Bool { try motionSettings.value(control) }
  private func waitForValue(_ control: XCUIElement, _ enabled: Bool) throws { try motionSettings.waitForValue(control, enabled) }

  private func wait(_ element: XCUIElement, _ predicate: String = "exists == true", timeout: TimeInterval = 30) throws {
    let expectation = XCTNSPredicateExpectation(predicate: NSPredicate(format: predicate), object: element)
    guard XCTWaiter.wait(for: [expectation], timeout: timeout) == .completed else {
      capture(appWasLaunched ? app : settings, "expected-control-unavailable")
      throw ProbeFailure.unavailable("Expected \(predicate) for \(element)")
    }
  }

  private func tap(_ element: XCUIElement) throws {
    try wait(element, "exists == true AND hittable == true AND enabled == true")
    element.tap()
  }

  private func reveal(_ element: XCUIElement, in scroll: XCUIElement) throws {
    try wait(element)
    try wait(scroll)
    for _ in 0..<6 {
      let viewport = scroll.frame, target = element.frame
      if element.isHittable && target.midY > viewport.minY + 8 && target.midY < viewport.maxY - 8 { return }
      let downward = target.minY < viewport.minY
      let distance = min(0.4, max(0.12, abs(viewport.midY - target.midY) / max(1, viewport.height)))
      let startY: CGFloat = downward ? 0.25 : 0.75
      let start = scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: startY))
      let finish = scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: startY + (downward ? distance : -distance)))
      start.press(forDuration: 0.05, thenDragTo: finish, withVelocity: .slow, thenHoldForDuration: 0.1)
    }
    throw ProbeFailure.unavailable("Control could not be revealed through ordinary bounded scrolling")
  }

  private func assertPages(_ count: Int) throws {
    try wait(app.staticTexts["result-facts"], "exists == true AND label BEGINSWITH '\(count) pages'")
  }

  private func send(_ text: String) throws {
    let composer = app.textViews.matching(NSPredicate(format: "label BEGINSWITH %@", "Tell atepdf what to do")).firstMatch
    try tap(composer)
    composer.typeText(text)
    try wait(composer, "value == '\(text)'")
    try tap(app.buttons["Send message"])
    try wait(composer, "value == ''")
  }

  private func attach(_ name: String, _ text: String) {
    let attachment = XCTAttachment(string: text)
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  private func capture(_ application: XCUIApplication, _ name: String) {
    attach("\(name)-hierarchy", application.debugDescription)
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }
}

/// Shared by the local accessibility and paired lifecycle XCTest cases. The
/// caller must capture currentValue() and register teardown BEFORE setEnabled.
/// All writes happen through the observed public Settings switch, with readback.
@MainActor
final class AtepdfPublicReduceMotion {
  struct Snapshot {
    let reduceMotion: Bool
    let autoPlayMessageEffects: Bool
  }
  private let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
  private enum SettingsFailure: Error { case unavailable(String) }
  private var original: Snapshot?

  func currentValue() throws -> Bool {
    let current = try snapshot()
    if original == nil { original = current }
    return current.reduceMotion
  }

  func snapshot() throws -> Snapshot {
    let reduceMotion = try value(control())
    let autoPlay = try value(autoPlayControl())
    return Snapshot(reduceMotion: reduceMotion, autoPlayMessageEffects: autoPlay)
  }

  func setEnabled(_ enabled: Bool) throws {
    if original == nil { _ = try currentValue() }
    let toggle = try control()
    if try value(toggle) != enabled { toggle.tap() }
    try waitForValue(toggle, enabled)
    // Public Settings changed this secondary value during the recorded OS
    // round trip. Restore the captured value when returning to original mode.
    if let original, enabled == original.reduceMotion { try restore(original) }
    capture("public-reduce-motion-\(enabled ? "on" : "off")")
  }

  func restore(_ snapshot: Snapshot) throws {
    let motion = try control()
    if try value(motion) != snapshot.reduceMotion { motion.tap() }
    try waitForValue(motion, snapshot.reduceMotion)
    let autoPlay = try autoPlayControl()
    if try value(autoPlay) != snapshot.autoPlayMessageEffects { autoPlay.tap() }
    try waitForValue(autoPlay, snapshot.autoPlayMessageEffects)
    // Re-query both after the final tap; restoring one must not silently alter
    // the other. These are live public switch values, never stored preferences.
    try waitForValue(control(), snapshot.reduceMotion)
    try waitForValue(autoPlayControl(), snapshot.autoPlayMessageEffects)
    capture("original-public-motion-switches-restored")
  }

  private func autoPlayControl() throws -> XCUIElement {
    let row = settings.switches["Auto-Play Message Effects"]
    try wait(row, "exists == true AND hittable == true")
    return try exposedToggle(in: row)
  }

  func control() throws -> XCUIElement {
    settings.activate()
    guard settings.wait(for: .runningForeground, timeout: 10) else {
      throw SettingsFailure.unavailable("Settings did not become foreground")
    }
    let existing = settings.switches["Reduce Motion"]
    if existing.exists && existing.isHittable { return try exposedToggle(in: existing) }
    try openRow("Accessibility")
    try openRow("Motion")
    let toggle = settings.switches["Reduce Motion"]
    try wait(toggle, "exists == true AND hittable == true")
    return try exposedToggle(in: toggle)
  }

  private func exposedToggle(in row: XCUIElement) throws -> XCUIElement {
    // Observed on both public iPad Settings hierarchies: the named Switch is a
    // wide row containing a label Button and one smaller, real Switch. Tapping
    // the row center hits blank space; target that exposed child without using
    // coordinates or a preference write. The same path restores the setting.
    let switches = row.switches
    guard switches.count == 1 else {
      capture("reduce-motion-toggle-ambiguous")
      throw SettingsFailure.unavailable("Reduce Motion has no unique exposed child switch")
    }
    let toggle = switches.firstMatch
    try wait(toggle, "exists == true AND hittable == true")
    guard toggle.frame.width < row.frame.width,
          row.frame.contains(CGPoint(x: toggle.frame.midX, y: toggle.frame.midY)) else {
      throw SettingsFailure.unavailable("The exposed Reduce Motion toggle is outside its public row")
    }
    return toggle
  }

  private func openRow(_ label: String) throws {
    // These exact labels succeeded in the spare iPad's public UI probe. The
    // observed Motion cell identifier was MOTION_TITLE; the switch REDUCE_MOTION.
    for attempt in 0..<5 {
      let candidates = [settings.cells.containing(.staticText, identifier: label).firstMatch,
                        settings.buttons[label], settings.staticTexts[label]]
      if let row = candidates.first(where: { $0.exists && $0.isHittable && settings.frame.contains(CGPoint(x: $0.frame.midX, y: $0.frame.midY)) }) {
        row.tap()
        return
      }
      if attempt < 4 {
        let containers = [settings.tables.firstMatch, settings.collectionViews.firstMatch, settings.scrollViews.firstMatch]
        guard let scroll = containers.first(where: { $0.exists && $0.isHittable && $0.frame.height > 100 }) else { break }
        scroll.swipeUp(velocity: .slow)
      }
    }
    capture("settings-row-unavailable-\(label)")
    throw SettingsFailure.unavailable("Public Settings row \(label) was not reachable. Setting was not bypassed.")
  }

  func value(_ control: XCUIElement) throws -> Bool {
    guard let value = control.value as? String, value == "0" || value == "1" else {
      throw SettingsFailure.unavailable("Reduce Motion switch has no unambiguous public 0/1 value")
    }
    return value == "1"
  }

  func waitForValue(_ control: XCUIElement, _ enabled: Bool) throws {
    try wait(control, "exists == true AND value == '\(enabled ? "1" : "0")'")
  }

  private func wait(_ element: XCUIElement, _ predicate: String) throws {
    let expectation = XCTNSPredicateExpectation(predicate: NSPredicate(format: predicate), object: element)
    guard XCTWaiter.wait(for: [expectation], timeout: 10) == .completed else {
      capture("public-motion-control-unavailable")
      throw SettingsFailure.unavailable("Expected \(predicate) for \(element)")
    }
  }

  private func capture(_ name: String) {
    XCTContext.runActivity(named: name) { activity in
      let hierarchy = XCTAttachment(string: settings.debugDescription + "\nbackgroundTestRunnerUIKitDiagnostic=\(UIAccessibility.isReduceMotionEnabled)")
      hierarchy.name = "\(name)-hierarchy";hierarchy.lifetime = .keepAlways
      activity.add(hierarchy)
      let screenshot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
      screenshot.name = name;screenshot.lifetime = .keepAlways
      activity.add(screenshot)
    }
  }
}
