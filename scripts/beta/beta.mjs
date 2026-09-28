#!/usr/bin/env node
import {realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {startWeb, stopWeb, webStatus} from './web.mjs';
import {registerMac, macStatus} from './mac.mjs';
import {execFileSync} from 'node:child_process';

const usage = `Usage:
  node scripts/beta/beta.mjs web start [--open] [--port 3211] [--local-only] [--share-with-devices PRIVATE_IPV4]
  node scripts/beta/beta.mjs web status
  node scripts/beta/beta.mjs web stop
  node scripts/beta/beta.mjs mac register
  node scripts/beta/beta.mjs mac status
  node scripts/beta/beta.mjs mac open

Web start uses the existing local OpenAI setup and its remaining approved allowance.
--local-only disables the planner for offline QA. Nothing installs or builds here.
Device sharing is an explicit TLS opt-in, never a public deployment.
Stop authenticates its own launcher; it never kills an unknown process.
Mac open requests a new local instance and does not close existing chats.`;

try {
  const [target, action, ...args] = process.argv.slice(2);
  if (target === '--help' || !target) { console.log(usage); }
  else {
    const repo = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
    let result;
    if (target === 'web' && action === 'start') {
      const options = {}, seen = new Set(); let openBrowser = false;
      while (args.length) {
        const flag = args.shift();
        if (seen.has(flag)) throw new Error('An option was repeated.');
        seen.add(flag);
        if (flag === '--local-only') options.localOnly = true;
        else if (flag === '--open') openBrowser = true;
        else if (flag === '--port') {
          const value = args.shift();
          if (!/^\d+$/.test(value ?? '') || Number(value) < 1024 || Number(value) > 65535) throw new Error('Choose a port from 1024 through 65535.');
          options.port = Number(value);
        } else if (flag === '--share-with-devices') {
          options.shareWithDevices = args.shift();
          if (!options.shareWithDevices) throw new Error('Provide this computer’s private IPv4 address.');
        } else throw new Error(`Unknown option: ${flag}`);
      }
      result = await startWeb(repo, options);
      if (openBrowser) {
        if (process.platform !== 'darwin') console.error(`Open ${result.url} in your browser.`);
        else execFileSync('/usr/bin/open', [result.url], {stdio: 'ignore'});
      }
    } else {
      if (args.length) throw new Error('Unexpected arguments.');
      if (target === 'web' && action === 'status') result = await webStatus(repo);
      else if (target === 'web' && action === 'stop') result = await stopWeb(repo);
      else if (target === 'mac' && action === 'register') result = await registerMac(repo);
      else if (target === 'mac' && ['status', 'open'].includes(action)) result = await macStatus(repo, action === 'open');
      else throw new Error(usage);
    }
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) { console.error(`atepdf beta: ${error.message}`); process.exitCode = 1; }
