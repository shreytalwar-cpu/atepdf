internal import Expo
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    // Expo's scene delegate creates the window from its UIWindowScene and starts
    // this factory once the scene connects, including cold-start link options.

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

// SHR-106 window chrome (DESIGN_SYSTEM 14.4 and 14.6, UX_SPEC S2.1). Expo's scene delegate still
// creates the window and starts React Native; this only configures the Mac window around it.
class AtepdfSceneDelegate: ExpoAppSceneDelegate {
  // bg.window from docs/design/tokens/atepdf-tokens.json: no white flash on a dark launch.
  static let windowBackground = UIColor { traits in
    traits.userInterfaceStyle == .dark
      ? UIColor(red: 0x14 / 255, green: 0x14 / 255, blue: 0x17 / 255, alpha: 1)
      : UIColor(red: 0xF7 / 255, green: 0xF7 / 255, blue: 0xF8 / 255, alpha: 1)
  }

  override func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    super.scene(scene, willConnectTo: session, options: connectionOptions)
    guard let windowScene = scene as? UIWindowScene else { return }
    window?.backgroundColor = Self.windowBackground
    window?.rootViewController?.view.backgroundColor = Self.windowBackground
#if targetEnvironment(macCatalyst)
    // The toolbar is drawn in the window content; the title stays hidden (the window's
    // accessibility title is still atePDF) and the title bar blends into the window.
    if let titlebar = windowScene.titlebar {
      titlebar.titleVisibility = .hidden
      titlebar.toolbar = nil
      titlebar.separatorStyle = .none
    }
    windowScene.title = "atePDF"
    windowScene.sizeRestrictions?.minimumSize = CGSize(width: 640, height: 520)
#endif
  }
}
