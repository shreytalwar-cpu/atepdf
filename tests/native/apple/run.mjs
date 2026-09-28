import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

// Synthetic-only host fixture harness. Does not use or install the old app.
// macOS Vision needs access to the host's local ML services; a restricted shell
// sandbox may return Vision nilError even though English is available.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const scratch=await mkdtemp(join(tmpdir(),'atepdf-apple-check-'));
const binary=join(scratch,'apple-pdf-check'),inputs=join(scratch,'inputs');
function run(command,args) {
  const result=spawnSync(command,args,{cwd:root,stdio:'inherit',timeout:180_000,killSignal:'SIGTERM'});
  if(result.status!==0)throw new Error(`${command} exited ${result.status}`);
}
try {
  await mkdir(inputs);
  run('xcrun',['swiftc','-module-cache-path',join(scratch,'module-cache'),'apps/universal/modules/atepdf-pdf/ios/AtepdfPDFEngine.swift','tests/native/apple/main.swift','-o',binary]);
  run(binary,['tests/fixtures',inputs,'docs/evidence/native']);
  run(process.execPath,['--import','tsx','tests/native/apple/chain.ts',inputs,binary]);
} finally {await rm(scratch,{recursive:true,force:true});}
