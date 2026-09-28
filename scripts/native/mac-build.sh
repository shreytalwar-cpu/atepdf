#!/usr/bin/env bash
set -euo pipefail

# Developer-only Catalyst build. No dependency install, provisioning, or publication.
repo_root="$(cd -P "$(dirname "$0")/../.." && pwd)"
launch=false
case "${1:-}" in
  '') ;;
  --launch) launch=true ;;
  *) echo 'Usage: scripts/native/mac-build.sh [--launch]' >&2; exit 2 ;;
esac
[[ $# -le 1 ]] || { echo 'Too many arguments.' >&2; exit 2; }
[[ "$(uname -s)" == Darwin ]] || { echo 'A Mac with Xcode is required.' >&2; exit 1; }
command -v node >/dev/null || { echo 'Node.js must be on PATH; no tools are installed by this script.' >&2; exit 1; }
command -v python3 >/dev/null || { echo 'Python 3 is required for verified staging.' >&2; exit 1; }
if [[ -z "${DEVELOPER_DIR:-}" && -d /Applications/Xcode-beta.app/Contents/Developer ]]; then
  export DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer
fi
[[ -d "$repo_root/apps/universal/ios/atepdf.xcworkspace" ]] || { echo 'The tracked Apple workspace is missing; restore the atepdf source, then install locked Pods. See docs/NATIVE_MAC.md.' >&2; exit 1; }
[[ -f "$repo_root/apps/universal/ios/Pods/Manifest.lock" ]] || { echo 'Locked CocoaPods dependencies are missing; no installation was attempted.' >&2; exit 1; }
export EXPO_NO_TELEMETRY=1
cd "$repo_root"
mkdir -p .build
build_log="$(mktemp "$repo_root/.build/mac-build-XXXXXX")"
if ! xcodebuild -workspace apps/universal/ios/atepdf.xcworkspace -scheme atepdf \
  -configuration Release -destination "platform=macOS,variant=Mac Catalyst,arch=$(uname -m)" \
  -derivedDataPath .build/mac CODE_SIGNING_ALLOWED=NO ONLY_ACTIVE_ARCH=YES \
  -jobs 4 build > "$build_log" 2>&1; then
  echo "Mac application build failed. See $build_log" >&2
  tail -30 "$build_log" >&2
  exit 1
fi
# A temporary stage avoids Finder metadata added by Documents file providers.
# Only fresh generated artifacts are normalized; dependencies and source stay intact.
python3 - "$repo_root" "$build_log" "$launch" <<'PY'
from pathlib import Path
import datetime, hashlib, json, plistlib, shutil, subprocess, sys, tempfile

repo, log, launch = Path(sys.argv[1]), sys.argv[2], sys.argv[3] == 'true'
source = repo / '.build/mac/Build/Products/Release-maccatalyst/atepdf.app'
info = plistlib.loads((source / 'Contents/Info.plist').read_bytes())
if info.get('CFBundleIdentifier') != 'dev.atepdf.fresh.mac':
    raise RuntimeError('Unexpected Mac identifier; refusing to sign or launch.')

stage = Path(tempfile.mkdtemp(prefix='atepdf-mac-', dir='/private/tmp'))
app = stage / 'atepdf.app'
subprocess.run(['/usr/bin/ditto', '--noextattr', '--norsrc', str(source), str(app)], check=True)

def manifest(folder):
    result = {}
    for path in sorted(folder.rglob('*')):
        relative = str(path.relative_to(folder))
        if path.is_symlink():
            result[relative] = ('link', str(path.readlink()))
        elif path.is_file():
            result[relative] = ('file', hashlib.sha256(path.read_bytes()).hexdigest())
        elif path.is_dir():
            result[relative] = ('directory',)
    return result

def remove_staged(path):
    # All destructive operations are restricted to this newly created artifact.
    if not path.is_relative_to(app) or not path.resolve().is_relative_to(app.resolve()) or path.is_symlink():
        raise RuntimeError('Refusing an unexpected staging mutation.')
    if path.is_dir():
        shutil.rmtree(path)
    else:
        path.unlink()

normalizations = []
for name in ('React', 'ReactNativeDependencies'):
    framework = app / 'Contents/Frameworks' / f'{name}.framework'
    versions = framework / 'Versions'
    current, canonical = versions / 'Current', versions / 'A'
    if current.is_symlink():
        # Upstream may fix its packaging; do not rewrite a canonical framework.
        if current.readlink() != Path('A'):
            raise RuntimeError(f'Unexpected {name} framework version link.')
        continue
    if framework.is_symlink() or versions.is_symlink() or canonical.is_symlink() or not current.is_dir() or not canonical.is_dir() or manifest(current) != manifest(canonical):
        raise RuntimeError(f'{name}: version copies differ; refusing framework normalization.')
    built_binary_hash = hashlib.sha256((framework / name).read_bytes()).hexdigest()
    remove_staged(current)
    current.symlink_to('A', target_is_directory=True)
    for item in list(framework.iterdir()):
        if item.name == 'Versions' or item.is_symlink():
            continue
        target = canonical / item.name
        if not target.exists() and not (name == 'ReactNativeDependencies' and item.name in {
            'ReactNativeDependencies_boost.bundle', 'ReactNativeDependencies_folly.bundle',
            'ReactNativeDependencies_glog.bundle',
        }):
            raise RuntimeError(f'Unexpected staged framework content: {name}/{item.name}')
        if target.exists():
            remove_staged(target)
        shutil.move(str(item), str(target))
        item.symlink_to(f'Versions/Current/{item.name}', target_is_directory=target.is_dir())
    if hashlib.sha256((framework / name).read_bytes()).hexdigest() != built_binary_hash:
        raise RuntimeError('Framework normalization changed the built binary.')
    normalizations.append({'framework': name, 'identicalVersionCopies': True,
                           'builtBinarySha256BeforeSigning': built_binary_hash})

# Ad-hoc development signatures intentionally omit Hardened Runtime, because it
# requires real Team IDs for these dynamic frameworks. Production Xcode target
# settings remain unchanged. No library-validation exception is granted.
entitlements = {'com.apple.security.app-sandbox': True, 'com.apple.security.network.client': True,
                'com.apple.security.files.user-selected.read-write': True}
entitlement_file = stage / 'atepdf-local.entitlements'
entitlement_file.write_bytes(plistlib.dumps(entitlements))
nested = sorted((p for p in app.rglob('*') if not p.is_symlink()
                 and p.suffix in {'.framework', '.bundle', '.dylib'}),
                key=lambda p: len(p.parts), reverse=True)
for path in nested:
    subprocess.run(['/usr/bin/codesign', '--force', '--sign', '-', '--timestamp=none',
                    '--options', '0', str(path)], check=True, capture_output=True)
subprocess.run(['/usr/bin/codesign', '--force', '--sign', '-', '--timestamp=none',
                '--options', '0', '--entitlements', str(entitlement_file), str(app)],
               check=True, capture_output=True)
subprocess.run(['/usr/bin/codesign', '--verify', '--deep', '--strict', str(app)],
               check=True, capture_output=True)
actual = subprocess.run(['/usr/bin/codesign', '--display', '--entitlements', ':-', str(app)],
                        check=True, capture_output=True).stdout
if plistlib.loads(actual) != entitlements:
    raise RuntimeError('Unexpected entitlements; refusing to launch.')
signature = subprocess.run(['/usr/bin/codesign', '-dvv', str(app)],
                           check=True, capture_output=True, text=True).stderr
if 'Signature=adhoc' not in signature or 'TeamIdentifier=not set' not in signature:
    raise RuntimeError('A non-development signing identity was used; refusing to launch.')

record = {'builtAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'app': str(app), 'identifier': info['CFBundleIdentifier'], 'buildLog': log,
          'signature': 'local ad-hoc, development only', 'hardenedRuntime': False,
          'strictSignatureVerification': 'passed', 'entitlements': entitlements,
          'networkEntitlements': 'outgoing only; native planner permits loopback endpoints', 'nestedCodeObjects': len(nested),
          'stagedFrameworkNormalizations': normalizations,
          'binarySha256': hashlib.sha256((app / 'Contents/MacOS/atepdf').read_bytes()).hexdigest(),
          'launchRequested': launch, 'launchVerified': False,
          'scope': 'Local developer artifact; not notarized or distribution-ready.'}
(repo / '.build/mac-last-build.json').write_text(json.dumps(record, indent=2) + '\n')
print(f'Mac application built; strict signature and sandbox entitlement checks passed.\nApp: {app}')
print('Evidence: .build/mac-last-build.json\nDevelopment-only ad-hoc signature; outgoing network entitlement for the paired loopback planner.')
if launch:
    subprocess.run(['/usr/bin/open', '-n', '-a', str(app)], check=True)
    print('Launch requested by exact path. Verify the process path and sandbox container before UI testing.')
PY
