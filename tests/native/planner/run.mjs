// Actual Swift transport canaries against owned synthetic loopback fixtures.
// No local credentials/configuration, production provider, or paid call is used.
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const owned=new Set();
async function stop(child){
  if(child.exitCode!==null||child.signalCode!==null)return;
  child.kill('SIGTERM');
  const timer=setTimeout(()=>child.kill('SIGKILL'),3000);
  try{await once(child,'exit');}finally{clearTimeout(timer);owned.delete(child);}
}
async function command(executable,args){
  const child=spawn(executable,args,{stdio:'inherit'});owned.add(child);
  const [code,signal]=await once(child,'exit');owned.delete(child);
  if(code!==0||signal)throw new Error(`Native verification command failed (${code}, ${signal??'no signal'})`);
}
async function server(script,ready){
  const child=spawn(process.execPath,['--import','tsx',script],{stdio:['ignore','pipe','pipe']});owned.add(child);
  await new Promise((done,reject)=>{
    let text='';
    const timer=setTimeout(()=>reject(new Error('Owned native fixture did not become ready')),30_000);
    const onExit=()=>{clearTimeout(timer);reject(new Error('Owned native fixture exited before readiness (possibly occupied test ports)'));};
    child.once('error',reject);child.once('exit',onExit);
    child.stderr.on('data',chunk=>process.stderr.write(chunk));
    child.stdout.on('data',chunk=>{
      process.stdout.write(chunk);text=(text+chunk).slice(-2000);
      if(text.includes(ready)){clearTimeout(timer);child.removeListener('exit',onExit);done();}
    });
  });
  return child;
}
const source='apps/universal/modules/atepdf-planner/ios/AtepdfPlannerTransport.swift';
async function compile(name,driver,debug){
  const binary=resolve('.build',name);
  await command('/usr/bin/xcrun',['swiftc',...(debug?['-D','DEBUG']:[]),'-module-cache-path',resolve('.build/swift-cache'),'-parse-as-library',source,driver,'-o',binary]);
  return binary;
}
const onSignal=()=>{for(const child of owned)child.kill('SIGTERM');};
process.once('SIGTERM',onSignal);process.once('SIGINT',onSignal);
try{
  await mkdir('.build/swift-cache',{recursive:true});
  const debug=await compile('transport-debug','tests/native/planner/main.swift',true);
  const release=await compile('transport-release','tests/native/planner/permission-main.swift',false);
  const tls=await compile('transport-tls','tests/native/planner/tls-main.swift',true);
  const loopback=await server('tests/native/planner/server.ts','Synthetic native test gateway only:');
  await command(debug,[]);await command(release,[]);await stop(loopback);
  const encrypted=await server('tests/native/planner/tls-server.ts','Synthetic Swift TLS harness:');
  await command(tls,[]);await stop(encrypted);
  console.log('Native DEBUG, release zero-write and pinned TLS executions passed. Synthetic loopback only.');
}finally{
  await Promise.all([...owned].map(stop));
  process.removeListener('SIGTERM',onSignal);process.removeListener('SIGINT',onSignal);
}
