# Local Apple build tools

CocoaPods 1.16.2 (MIT) is pinned here for compatibility with this host's Ruby 2.6.10. It is a development tool, not an application dependency. Bundler 2.4.22 resolved compatible gems; exact dependency versions are in Gemfile.lock. The initial plain gem install chose dependencies requiring newer Ruby; Bundler resolved this without modifying system Ruby.

Install into the new repository's ignored `.build/native-tools` directory. Do not use the old Attenlo checkout or its dependencies. The successful local install/build evidence is in `docs/evidence/native/`.

With the pinned gems installed, run CocoaPods from `apps/universal/ios`, not the repository root: Expo autolinking uses the current directory to resolve the app project. Use deployment mode so a source/prebuilt fallback cannot rewrite `Podfile.lock`. Load `bundler/setup` before `logger`, then load `Gem.bin_path('cocoapods', 'pod')`; the locked ActiveSupport expects Logger to be loaded, and preloading the system default Logger before Bundler selects 1.7.0 causes a version conflict. Set `RCT_USE_RN_DEP=1` and `RCT_USE_PREBUILT_RNCORE=1` for the checked-in prebuilt configuration. A transient archive probe failure must be retried after verifying the exact version, never repaired by a broad Pod update. Ruby 2.6's Expo `filter_map` warnings fall back to compiling the already locked Expo module sources; they are not proof of a failed build or permission to change dependencies.

Current host commands use the Codex bundled Node runtime and `DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer`. CocoaPods statistics and Expo telemetry are disabled. The native configuration uses the independent development ID `dev.atepdf.fresh`; no seller, purchase, team or production credential is configured.

Primary tool source/licence: https://rubygems.org/gems/cocoapods/versions/1.16.2
Expo local module registration: https://docs.expo.dev/modules/get-started/
