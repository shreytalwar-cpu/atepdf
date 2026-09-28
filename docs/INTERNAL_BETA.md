# Local internal beta

This is an owner-private beta from the independent atepdf repository. PDF work stays in the browser or native app. The saved OpenAI connection receives only the approved instruction and anonymous planning fields. Local processing still works when AI is unavailable. The launcher never replenishes the existing paid-request allowance.

## Open atepdf on this Mac

1. In `scripts/beta`, double-click **Start atepdf.command**. It opens the built browser app and stays running after Terminal closes.
2. Use the bundled sample PDFs first. Ask to merge them, open the result inside the chat, remove page 2, and undo. Save a copy to a new local folder and reopen it.
3. Save any results you want to keep before closing the chat. Current chats and working documents are session-scoped; a restart is not a saved-history feature.
4. When finished, double-click **Stop atepdf.command**. It only stops a server authenticated as this launcher's own process. It does not close existing chats or delete documents, keys, or settings.

If the address is already in use by an older development server, the launcher leaves it running and explains the conflict. It claims both IPv4 and IPv6 loopback addresses, so an older IPv6-only server cannot silently receive the new beta's browser traffic. The maintainer must choose when to transition that server. Do not kill a process just because it occupies port 3211.

The Mac app is separate from the browser. Double-click **Open atepdf Mac.command** in the same folder to verify, register and open the latest existing Mac build. It never builds or re-signs the app. After a build is registered, the command-line equivalent is:

```sh
node scripts/beta/beta.mjs mac open
```

This opens a new local app instance without closing an existing chat. The native app's **OpenAI connection** pairs with the browser's one-use code; it never receives the project key. Keep the companion browser server running while using native AI. A server restart requires a new pairing code.

## Maintainer commands

Run from the repository with Node.js available. These commands do not install dependencies, rebuild, publish, sign, or make paid planning calls on their own.

```sh
node scripts/beta/beta.mjs web start
node scripts/beta/beta.mjs web status
node scripts/beta/beta.mjs web stop

# Local operations with the planner explicitly disabled:
node scripts/beta/beta.mjs web start --local-only --port 3213

# After scripts/native/mac-build.sh has completed:
node scripts/beta/beta.mjs mac register
node scripts/beta/beta.mjs mac status
node scripts/beta/beta.mjs mac open
```

Normal start uses `.local` without exposing or resetting its key/settings. Repeating start with the same options reuses a healthy owned process. Switching options requires stopping that owned server first. Native pairing uses browser ports 3210, 3211, or 3212; other ports are suitable for browser-only QA.

The browser must already be exported by `pnpm expo:web`. That is the actual Expo web export; the launcher is only a local host. Save results and stop the owned server before rebuilding. If the export changes during a session, new requests fail clearly until a restart rather than combining a new browser build with an old planner process.

Launcher state and a per-launch authentication token live under private, ignored `.local/beta/`. The token is never printed or transmitted: fresh HMAC challenges authenticate both management requests and replies before stopping anything. Logs contain startup diagnostics, not requests, document data, or credentials. A stale `start.lock` is deliberately not removed automatically: inspect it after confirming no start is active. An existing planner reservation lock is never removed by this launcher.

`mac register` independently rechecks the latest staged app's development identity, binary checksum, strict code signature, and sandbox permissions. It writes the stable repository-local pointer `.build/beta/mac.json`. `mac status` and `mac open` reverify that pointer and the bundled JavaScript checksum. The app remains at its fresh temporary staging path; if macOS removes it, rebuild and register again. Registration alone does not prove launch, document processing, physical-device installation, notarization, or release readiness.

## AI request allowance

The saved key is connected and GPT-6 Luna is visible to the account. The owner explicitly approved 20 additional requests after the previous allowance was exhausted. Two synthetic live checks passed (merge and page removal), leaving **18 requests** at the recorded check. The remaining amount changes as you use AI. Local PDF quick actions also work with AI disconnected. To grant another allowance later, use the existing owner-operated setup only after approval:

```sh
python3 scripts/approve-planner.py 20
```

Its terminal confirmation authorizes paid requests; this is not an OpenAI account dollar cap. The app has no repeated per-message confirmation and no 2,000-output-token cap. Sending a request or using an AI-enabled PDF quick action consumes the same shared allowance, including failed or cancelled calls. A read-only model lookup does not consume it.

## Current virtual checks

The original-source iPhone simulator completed an actual local Files save, atepdf restart and exact-copy reopen in system Preview. An independent reader verified all three merged pages. Real Reduce Motion-on merge, preview, removal and undo also passed. The [current beta record](SESSION_2026-09-28_BETA.md) keeps each build and run separate.

Known simulator gaps remain: default-motion automation can wait after a delayed AI response; large-text iPad landscape scrolls an earlier preview out when the composer gains focus; the current iPhone simulator configuration has not shown an onscreen software keyboard. These are recorded limitations, not physical-device acceptance. The latest Mac app is built and signature-verified; its interactive check remains deferred at the owner's request.

## Physical iPhone/iPad check

Physical installation and network acceptance remain pending. Use the tracked Apple workspace and the owner-approved development team/device signing setup; no production identity, TestFlight upload, or signing change is performed by this launcher. See [the Apple build instructions](NATIVE_APPLE.md), [device acceptance steps](BETA_DEVICE_ACCEPTANCE.md), and the current [implementation status](IMPLEMENTATION_STATUS.md) before installing. Confirm the independent `dev.atepdf.fresh` identifier.

After the owner approves this specific private-network test and the native device build is installed, keep the Mac and device on the same trusted Wi-Fi. Stop only the owned beta, then explicitly start its companion on this Mac's private IPv4 address:

```sh
node scripts/beta/beta.mjs web start --share-with-devices 192.168.1.20
```

Replace the example with the Mac's actual private address. The browser remains loopback-only. The separate TLS listener binds only that address on port 3443 and accepts only authenticated native planner routes; it serves no web app, document files, key setup, or browser pairing issuance. Each new opt-in launch creates a private seven-day certificate in its unique `.local/beta/<launch-id>/native-tls` folder without changing system trust or overwriting earlier credentials. Repeating start on the same healthy process reuses that launch. Copy the pairing code from the local browser directly into the native app. The code carries the endpoint and certificate fingerprint for pinned native trust; do not install a system-wide certificate or bypass a trust error. Stop the beta when testing finishes.

An address change, expired certificate, failed pin, interrupted request, or server restart should fail clearly and require deliberate reconnection. A deliberate stop/start creates a new certificate and pairing; do not overwrite certificates or reuse an old code to work around an error. First use bundled samples and verify import → merge → preview → remove → undo → save → independent reopen. Verify local operations with the companion stopped. Record device/OS, exact source/build, output inspection and any failures. No physical-device success is claimed from simulator evidence.

## Launcher verification

```sh
node --test scripts/beta/beta.test.mjs
```

Tests create fresh synthetic directories and temporary loopback servers. They exercise the actual built gateway with synthetic disabled settings, make no paid calls, and never read the owner's key or stop current development servers. The suite covers detached lifetime, repeat start, authenticated stop, occupied/stale port ownership, origin and Host rejection, static symlink escapes, local-only behavior, allowance preservation, build changes, unsafe state paths, and invalid device addresses.

The successful device-companion integration additionally needs **3210 and 3443 free**. It uses the real TLS helper and gateway with a synthetic disabled key, trusts only its generated CA for the HTTPS client, exchanges a wrapped pairing code, checks restricted routes, then verifies all listeners close and certificates remain distinct across restart. A port conflict fails safely; the suite never stops an existing port owner. Keep the normal owner beta on 3211, and run this integration before enabling its optional device listener on 3443.

Recorded on 2026-09-28, from baseline `63e5127` plus this launcher slice: **15/15 launcher tests passed** in 3.2 seconds. JavaScript syntax checks, shortcut shell syntax checks and whitespace checks passed. The initial sandbox prevented loopback binding; the same isolated suite passed with permission to bind temporary loopback sockets. A shutdown check exposed reuse of a closing management socket; management now uses a fresh connection and flushes its signed reply before closing. Independent review found a non-ASCII HMAC byte-length error; exact hexadecimal validation and a server-survival regression now cover it. The real TLS integration initially rejected an ambiguous issuer/leaf chain; distinct certificate subjects and key identifiers corrected the helper, and the same CA-only verification passed without a trust bypass. No existing server was started or stopped.

The successful integration proves wrapped-code issuance, CA-trusted HTTPS pairing, anonymous disabled planner status, blocked file/setup routes, full listener shutdown, and fresh private certificates across restart. It makes zero model calls and preserves the synthetic allowance. The separate TLS failure test proves cleanup. Neither establishes physical-device installation or Wi-Fi acceptance.

The latest Mac candidate is registered by exact artifact identity, signature and bundled JavaScript checks. See [current Mac build evidence](evidence/native/beta-mac-build.json) for its path and hashes. It is a local ad-hoc development app; the owner deferred interactive Mac checks while the screen is locked. Earlier launcher registration against the prior artifact remains in the launcher evidence. No old Attenlo source was accessed.

Current application build, simulator, browser, native-engine and privacy evidence is retained in [implementation status](IMPLEMENTATION_STATUS.md) and [Mac notes](NATIVE_MAC.md). Android is deferred. Commercial purchase flows, distribution and physical-device acceptance are separate gates; this launcher does not imply those are complete.
