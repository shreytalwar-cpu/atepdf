import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {NodeVaultBackend} from '../../../helpers/workspace-backend';

// Synthetic host harness for the native workspace vault (SHR-39): compiles the
// shipped Swift source with a test driver and checks format interop both ways.
// Run from the repository root.
const root=resolve('.');
const run=(command:string,args:string[])=>{const result=spawnSync(command,args,{cwd:root,stdio:'inherit',timeout:180_000});if(result.status!==0)throw new Error(`${command} exited ${result.status}`);};
async function main(){
const scratch=await mkdtemp(join(tmpdir(),'atepdf-shr39-native-'));
try{
  const fixture=join(root,'tests/fixtures/brief.pdf'),pdf=new Uint8Array(await readFile(fixture));
  const key=crypto.getRandomValues(new Uint8Array(32)),hex=Buffer.from(key).toString('hex');
  const interop=new NodeVaultBackend(join(scratch,'interop'),{raw:key,state:'ok'});
  await interop.writeSealed('blobs/file_node.atw',pdf,'atepdf.workspace/v1|pdf|interop|file_node|1');
  const binary=join(scratch,'workspace-check');
  run('xcrun',['swiftc','-module-cache-path',join(scratch,'module-cache'),'apps/universal/modules/atepdf-pdf/ios/AtepdfWorkspaceVault.swift','tests/native/apple/workspace/main.swift','-o',binary]);
  run(binary,[scratch,fixture,hex]);
  const fromSwift=await interop.readOpened('blobs/file_swift.atw','atepdf.workspace/v1|pdf|interop|file_swift|1');
  assert.equal(fromSwift.status,'ok');assert.deepEqual((fromSwift as {bytes:Uint8Array}).bytes,pdf);
  assert.equal((await interop.readOpened('blobs/file_swift.atw','atepdf.workspace/v1|pdf|interop|file_swift|2')).status,'auth');
  console.log('ok  TypeScript backend opens a file sealed by Swift; different associated data is refused');
}finally{await rm(scratch,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
