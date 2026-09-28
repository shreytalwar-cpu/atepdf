#if targetEnvironment(macCatalyst)
import Foundation
import UIKit

/// Native save panel for a validated, immutable app-private PDF copy. The caller
/// retains the source until the picker reports copy completion or cancellation.
@MainActor
final class AtepdfPDFExporter: NSObject, UIDocumentPickerDelegate, UIAdaptivePresentationControllerDelegate {
  static let shared = AtepdfPDFExporter()
  private var picker: UIDocumentPickerViewController?
  private var completion: CheckedContinuation<String, Error>?
  private var activeOwner: UUID?

  enum Failure: String, Error, LocalizedError {
    case busy = "Finish the current save dialog first."
    case unavailable = "The save dialog is unavailable. Your PDF is unchanged."
    var errorDescription: String? { rawValue }
  }

  func export(_ source: URL, owner: UUID) async throws -> String {
    guard completion == nil else { throw Failure.busy }
    let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
      .first { $0.activationState == .foregroundActive }
    guard let window = scene?.windows.first(where: { $0.isKeyWindow }),
          var presenter = window.rootViewController else { throw Failure.unavailable }
    while let presented = presenter.presentedViewController { presenter = presented }
    guard presenter.viewIfLoaded?.window != nil, !presenter.isBeingDismissed,
          !presenter.isBeingPresented else { throw Failure.unavailable }

    return try await withCheckedThrowingContinuation { continuation in
      completion = continuation
      activeOwner = owner
      NotificationCenter.default.addObserver(self, selector: #selector(sceneDisconnected(_:)),
                                             name: UIScene.didDisconnectNotification, object: scene)
      let dialog = UIDocumentPickerViewController(forExporting: [source], asCopy: true)
      dialog.delegate = self
      dialog.modalPresentationStyle = .formSheet
      dialog.shouldShowFileExtensions = true
      picker = dialog // UIKit's delegate is weak; this coordinator also stays alive.
      presenter.present(dialog, animated: true)
      dialog.presentationController?.delegate = self
    }
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard controller === picker else { return }
    finish(urls.isEmpty ? "cancelled" : "saved", for: controller)
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    guard controller === picker else { return }
    finish("cancelled", for: controller)
  }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    guard let dialog = presentationController.presentedViewController as? UIDocumentPickerViewController else { return }
    finish("cancelled", for: dialog)
  }

  // A stale bridge teardown must never cancel a newer bridge's export.
  func cancel(owner: UUID) {
    guard activeOwner == owner, let dialog = picker else { return }
    if dialog.presentingViewController != nil {
      dialog.dismiss(animated: false) { [weak self] in
        self?.finish("cancelled", for: dialog)
      }
    } else {
      finish("cancelled", for: dialog)
    }
  }

  @objc private func sceneDisconnected(_ notification: Notification) {
    if let owner = activeOwner { cancel(owner: owner) }
  }

  private func finish(_ outcome: String, for dialog: UIDocumentPickerViewController) {
    guard picker === dialog, let pending = completion else { return }
    NotificationCenter.default.removeObserver(self, name: UIScene.didDisconnectNotification, object: nil)
    completion = nil
    activeOwner = nil
    picker = nil
    pending.resume(returning: outcome)
  }
}
#endif
