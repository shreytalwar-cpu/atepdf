import {independentPDF} from '../helpers/independent-pdf';
import test from 'node:test';
import assert from 'node:assert/strict';
import {chmod,copyFile,mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {preflight,transform} from '../../packages/web-pdf/src/engine';
import {LocalFileStore} from '../../packages/core/src/local-file-store';
import {JobController} from '../../packages/core/src/job-controller';
import {WorkspaceVault,savedArtifacts,StaleSaveError,WorkspaceExpiredError,CLEAR_FAILED,CLEANUP_INCOMPLETE,DELETE_FAILED,DELETE_UNCONFIRMED,blockedMessages,type WorkspaceSnapshot} from '../../packages/core/src/workspace-vault';
import {aad,names,parseCheckpoint,DAY_MS,type PersistedEntry,type WorkspaceCheckpoint} from '../../packages/core/src/workspace-checkpoint';
import {CheckpointScheduler,WorkspaceSession} from '../../packages/core/src/workspace-checkpoints';
import {safeOrdinaryText,hasRejectedSecretDraft} from '../../packages/planner/src/privacy';
import type {EngineRequest,Inspection} from '../../packages/web-pdf/src/types';
import {NodeVaultBackend,newKeychain,corrupt,type TestKeychain,type Fault} from '../helpers/workspace-backend';

// SHR-40: retention settings, storage usage and Delete local data on top of the
// SHR-39 vault. Synthetic local data only: bundled fixture PDFs copied into a
// temporary "external" folder, a temporary private directory, an in-memory
// Keychain stand-in and a fake clock. No network, no providers, no paid calls.
const T0=Date.parse('2026-09-01T09:00:00.000Z');
type Clock={t:number};
const hash=async(bytes:Uint8Array)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)))].map(n=>n.toString(16).padStart(2,'0')).join('');
// Combined tree uses the real independent structural reader from SHR-47.
const independent=independentPDF;
// delay: a slow transform, so a delete can race active work.
const services=(delay=0)=>({worker:async(r:EngineRequest,signal:AbortSignal)=>{if(r.kind==='inspect')return {pages:(await preflight(r.bytes)).getPageCount()};
  if(delay)await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,delay);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});});
  return transform(r,()=>{});},inspect:independent,recognize:async()=>[]});
const CANARY='hunter2-canary-7Qz';

async function launch(root:string,keychain:TestKeychain,clock:Clock,options:{fault?:Fault|null;delay?:number}={}){
  const backend=new NodeVaultBackend(root,keychain),vault=new WorkspaceVault(backend,{redact:safeOrdinaryText,now:()=>new Date(clock.t)});backend.fault=options.fault??null;
  const store=new LocalFileStore(),controller=new JobController(store,services(options.delay));
  const chat:{conversation:PersistedEntry[];draft:string|null}={conversation:[],draft:null};
  const snapshot=():WorkspaceSnapshot=>({revision:store.revision,artifacts:store.list,bytes:ref=>store.get(ref).bytes,originals:store.originals,history:store.history,conversation:chat.conversation,draft:chat.draft});
  const outcome=await vault.open();
  if(outcome.kind==='restored'){
    await controller.restore(savedArtifacts(outcome.checkpoint,outcome.bytes),outcome.checkpoint.originals,outcome.checkpoint.history,outcome.checkpoint.revision);
    chat.conversation=outcome.checkpoint.conversation;chat.draft=outcome.checkpoint.draft?.text??null;
  }
  if(vault.mode==='writable')controller.setDurability({save:()=>vault.save(snapshot),clear:()=>vault.clear()});
  const say=async(entry:Omit<PersistedEntry,'id'>)=>{chat.conversation=[...chat.conversation,{...entry,id:chat.conversation.length+1}];await vault.save(snapshot);};
  return {backend,vault,store,controller,chat,outcome,say,snapshot};
}
type App=Awaited<ReturnType<typeof launch>>;
// The user's own files: originals they imported from and a PDF they saved. Neither
// is inside atePDF's private directory, and no SHR-40 path may touch them.
async function external(){
  const dir=await mkdtemp(join(tmpdir(),'atepdf-shr40-external-'));
  for(const name of ['brief.pdf','appendix.pdf'])await copyFile(`tests/fixtures/${name}`,join(dir,name));
  return dir;
}
async function tree(root:string){
  const out:Record<string,string>={};
  const walk=async(dir:string,prefix:string)=>{for(const entry of await readdir(dir,{withFileTypes:true}).catch(()=>[])){const path=join(dir,entry.name),name=prefix?`${prefix}/${entry.name}`:entry.name;if(entry.isDirectory())await walk(path,name);else out[name]=await hash(new Uint8Array(await readFile(path)));}};
  await walk(root,'');return out;
}
async function populated(app:App,outside:string){
  await app.say({role:'user',text:'I’ve added 2 PDFs.',files:[{name:'brief.pdf',size:1},{name:'appendix.pdf',size:1}]});
  await app.controller.import(await Promise.all(['brief.pdf','appendix.pdf'].map(async n=>new File([new Uint8Array(await readFile(join(outside,n)))],n))));assert.equal(app.controller.state.error,null);
  await app.controller.quick('merge');assert.equal(app.controller.state.error,null);
  await app.say({role:'assistant',text:'I merged your PDFs in the order added.',artifactRef:app.store.focus!,resultTitle:'Merged PDF'});
  // The user saves the result somewhere of their choosing: it is theirs, not atePDF's.
  await writeFile(join(outside,'Merged (saved by user).pdf'),app.store.get(app.store.focus!).bytes);
  app.chat.draft='remove page 3';await app.vault.save(app.snapshot);
}
async function decrypted(root:string,keychain:TestKeychain):Promise<{checkpoint:WorkspaceCheckpoint;head:{generation:number;previousGeneration:number|null;deletionEpoch:number};raw:string}>{
  const backend=new NodeVaultBackend(root,keychain),headFile=await backend.readOpened(names.head,aad.head());assert.equal(headFile.status,'ok');
  const head=JSON.parse(new TextDecoder().decode((headFile as {bytes:Uint8Array}).bytes));
  const manifest=await backend.readOpened(names.manifest(head.generation),aad.manifest(head.workspaceID,head.generation));assert.equal(manifest.status,'ok');
  const raw=new TextDecoder().decode((manifest as {bytes:Uint8Array}).bytes);return {checkpoint:parseCheckpoint(JSON.parse(raw)),head,raw};
}
async function allRaw(root:string,keychain:TestKeychain){
  // Every manifest that decrypts, joined: what a reader with the key could see on disk.
  const backend=new NodeVaultBackend(root,keychain),{head}=await decrypted(root,keychain);let text='';
  const workspaceID=JSON.parse(new TextDecoder().decode(((await backend.readOpened(names.head,aad.head())) as {bytes:Uint8Array}).bytes)).workspaceID;
  for(const name of await backend.list('manifests')){const generation=Number(/(\d+)/.exec(name)![1]);const r=await backend.readOpened(name,aad.manifest(workspaceID,generation));if(r.status==='ok')text+=new TextDecoder().decode(r.bytes);}
  void head;return text;
}
const blobs=async(root:string)=>(await readdir(join(root,'blobs')).catch(()=>[] as string[])).sort();
async function scratch(){return {root:await mkdtemp(join(tmpdir(),'atepdf-shr40-')),outside:await external(),keychain:newKeychain(),clock:{t:T0}};}
async function done(...dirs:string[]){for(const dir of dirs){await chmod(join(dir,'blobs'),0o700).catch(()=>undefined);await rm(dir,{recursive:true,force:true});}}

test('SHR-40 the default is Keep until I delete it: no age expiry, however long atePDF is closed',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const first=await launch(root,keychain,clock);
    assert.deepEqual(first.outcome,{kind:'empty',retention:'keep',cleanupPending:false});assert.equal(first.vault.retention,'keep');
    await populated(first,outside);
    assert.equal((await decrypted(root,keychain)).checkpoint.retention.mode,'keep');
    clock.t=T0+400*DAY_MS;
    const later=await launch(root,keychain,clock);
    assert.equal(later.outcome.kind,'restored');assert.equal(later.store.originals.length,2);assert.equal(later.vault.expiryState(),'current');
    assert.deepEqual(await later.vault.expireIfDue(),{kind:'current'});
  }finally{await done(root,outside);}
});

test('SHR-40 7 days: expiry is measured from the last change, not from launches, and removes the whole workspace',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);
    assert.deepEqual(await app.vault.setRetention('7d',app.snapshot),{kind:'changed'});
    const external=await tree(outside),before=await decrypted(root,keychain);
    // A passive launch six days later restores and does not renew the age.
    clock.t=T0+6*DAY_MS;
    const passive=await launch(root,keychain,clock);assert.equal(passive.outcome.kind,'restored');assert.equal(passive.vault.expiryState(),'current');
    assert.equal((await decrypted(root,keychain)).checkpoint.lastActivityAt,before.checkpoint.lastActivityAt);
    clock.t=T0+7*DAY_MS-60_000;
    assert.equal((await launch(root,keychain,clock)).outcome.kind,'restored');
    clock.t=T0+7*DAY_MS;
    const expired=await launch(root,keychain,clock);
    assert.deepEqual(expired.outcome,{kind:'expired',retention:'7d',cleanupPending:false});
    assert.equal(expired.store.list.length,0);assert.equal(expired.vault.retention,'7d');
    // Only the new, empty epoch remains, with no predecessor to fall back to.
    const after=await decrypted(root,keychain);
    assert.equal(after.head.previousGeneration,null);assert.equal(after.head.deletionEpoch,before.head.deletionEpoch+1);
    assert.deepEqual(after.checkpoint.conversation,[]);assert.equal(after.checkpoint.draft,null);assert.deepEqual(await blobs(root),[]);
    assert.deepEqual(await readdir(join(root,'manifests')),[`${after.head.generation}.atw`]);
    // The user's own files are byte-identical and nothing was added or removed there.
    assert.deepEqual(await tree(outside),external);
    // No resurrection on any later launch.
    clock.t=T0+8*DAY_MS;
    const again=await launch(root,keychain,clock);assert.equal(again.outcome.kind,'restored');assert.equal(again.store.list.length,0);assert.deepEqual(again.chat.conversation,[]);
  }finally{await done(root,outside);}
});

test('SHR-40 30 days: a change renews the age; expiry at 30 days after the last change',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);await app.vault.setRetention('30d',app.snapshot);
    clock.t=T0+20*DAY_MS;
    const renewed=await launch(root,keychain,clock);assert.equal(renewed.outcome.kind,'restored');
    await renewed.say({role:'user',text:'Thanks.'});
    assert.equal((await decrypted(root,keychain)).checkpoint.lastActivityAt,new Date(T0+20*DAY_MS).toISOString());
    clock.t=T0+49*DAY_MS;
    assert.equal((await launch(root,keychain,clock)).outcome.kind,'restored');
    clock.t=T0+50*DAY_MS;
    assert.deepEqual((await launch(root,keychain,clock)).outcome,{kind:'expired',retention:'30d',cleanupPending:false});
  }finally{await done(root,outside);}
});

test('SHR-40 while atePDF runs: expiry on return or before an action, and a late save cannot renew an expired workspace',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);await app.vault.setRetention('7d',app.snapshot);
    const epoch=app.vault.deletionEpoch;
    clock.t=T0+7*DAY_MS+1;
    assert.equal(app.vault.expiryState(),'due');
    // A draft typed after the period (the scheduler's save) expires the workspace instead of renewing it.
    let failure:unknown=null;
    const scheduler=new CheckpointScheduler(()=>app.vault.save(app.snapshot),error=>{failure=error;},1);
    app.chat.draft='a new draft';scheduler.draft();
    for(let i=0;failure===null&&i<500;i++)await new Promise(resolve=>setTimeout(resolve,10));scheduler.dispose();
    assert.ok(failure instanceof WorkspaceExpiredError);assert.equal((failure as WorkspaceExpiredError).cleanupComplete,true);assert.match((failure as Error).message,/7 days/);
    assert.equal(app.vault.deletionEpoch,epoch+1);assert.deepEqual(await blobs(root),[]);
    assert.deepEqual(await app.vault.expireIfDue(),{kind:'current'});
    const reopened=await launch(root,keychain,{t:T0+7*DAY_MS+2});
    assert.equal(reopened.outcome.kind,'restored');assert.equal(reopened.store.list.length,0);assert.deepEqual(reopened.chat.conversation,[]);assert.equal(reopened.chat.draft,null);
  }finally{await done(root,outside);}
});

test('SHR-40 expireIfDue expires at once; saves queued behind it are refused rather than written into the new epoch',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);await app.vault.setRetention('7d',app.snapshot);
    clock.t=T0+8*DAY_MS;
    const expiry=app.vault.expireIfDue(),queued=app.vault.save(app.snapshot);
    assert.deepEqual(await expiry,{kind:'expired',mode:'7d',cleanupComplete:true});
    await assert.rejects(queued,StaleSaveError);
    const reopened=await launch(root,keychain,clock);assert.equal(reopened.store.list.length,0);assert.deepEqual(reopened.chat.conversation,[]);
  }finally{await done(root,outside);}
});

test('SHR-40 a shorter setting applies to the existing age at once; changing the setting is not activity',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);
    clock.t=T0+3*DAY_MS;
    assert.deepEqual(await app.vault.setRetention('7d',app.snapshot),{kind:'changed'});
    assert.equal((await decrypted(root,keychain)).checkpoint.lastActivityAt,new Date(T0).toISOString());
    // Seven days from the last change, not from the setting change.
    clock.t=T0+7*DAY_MS;
    assert.equal((await launch(root,keychain,clock)).outcome.kind,'expired');
    // And switching an old workspace to a shorter period expires it immediately.
    const {root:r2,outside:o2,keychain:k2,clock:c2}=await scratch();
    try{
      const old=await launch(r2,k2,c2);await populated(old,o2);
      c2.t=T0+10*DAY_MS;
      assert.deepEqual(await old.vault.setRetention('7d',old.snapshot),{kind:'expired',cleanupComplete:true});
      assert.equal(old.vault.retention,'7d');assert.deepEqual(await blobs(r2),[]);
      const next=await launch(r2,k2,c2);assert.equal(next.store.list.length,0);assert.equal(next.vault.retention,'7d');
    }finally{await done(r2,o2);}
  }finally{await done(root,outside);}
});

test('SHR-40 P1-3 a clock earlier than any saved time, by any amount, fails closed without deleting or extending; Keep is unaffected',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);await app.vault.setRetention('7d',app.snapshot);
    const before=await tree(root);
    clock.t=T0-DAY_MS;
    const skewed=await launch(root,keychain,clock);
    assert.deepEqual(skewed.outcome,{kind:'blocked',reason:'clock',retryable:true});assert.equal(skewed.vault.blockedReason,'clock');
    assert.match(blockedMessages.clock,/date/);assert.deepEqual(await tree(root),before);
    await assert.rejects(skewed.vault.save(skewed.snapshot));assert.deepEqual(await tree(root),before);
    // No tolerance: a one-minute, even a one-millisecond, rollback fails closed too.
    for(const back of [60_000,1]){
      clock.t=T0-back;
      assert.deepEqual((await launch(root,keychain,clock)).outcome,{kind:'blocked',reason:'clock',retryable:true});
      assert.deepEqual(await tree(root),before);
    }
    clock.t=T0;assert.equal((await launch(root,keychain,clock)).outcome.kind,'restored');
    // Earlier than the save time alone is enough: a setting change saved at T0+1 day
    // keeps the activity time T0, and a clock at T0+12 h (after the activity) still blocks.
    clock.t=T0+DAY_MS;const later=await launch(root,keychain,clock);await later.vault.setRetention('30d',later.snapshot);
    const {checkpoint:rewritten}=await decrypted(root,keychain);
    assert.equal(rewritten.lastActivityAt,new Date(T0).toISOString());assert.equal(rewritten.savedAt,new Date(T0+DAY_MS).toISOString());
    clock.t=T0+DAY_MS/2;assert.deepEqual((await launch(root,keychain,clock)).outcome,{kind:'blocked',reason:'clock',retryable:true});
    // A running workspace refuses to save, and does not expire, once the clock goes back.
    clock.t=T0+DAY_MS;const running=await launch(root,keychain,clock);assert.equal(running.outcome.kind,'restored');
    clock.t=T0+DAY_MS-1;
    assert.equal(running.vault.expiryState(),'clock');assert.deepEqual(await running.vault.expireIfDue(),{kind:'clock'});
    await assert.rejects(running.vault.save(running.snapshot));
    assert.ok((await blobs(root)).length>0);
    // An invalid clock is unknown age too.
    clock.t=Number.NaN;assert.equal((await launch(root,keychain,clock)).outcome.kind,'blocked');
    // Corrected clock: restored as before.
    clock.t=T0+DAY_MS;assert.equal((await launch(root,keychain,clock)).outcome.kind,'restored');
    // Keep until I delete it never depends on the clock.
    const kept=await launch(root,keychain,clock);await kept.vault.setRetention('keep',kept.snapshot);
    clock.t=T0-30*DAY_MS;assert.equal((await launch(root,keychain,clock)).outcome.kind,'restored');
  }finally{await done(root,outside);}
});

test('SHR-40 Delete when atePDF quits clears durable state first, then keeps the session in memory only',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);
    const external=await tree(outside),epoch=app.vault.deletionEpoch;
    const change=await app.vault.setRetention('quit',app.snapshot);
    assert.deepEqual(change,{kind:'cleared',cleanupComplete:true});
    assert.equal(app.vault.retention,'quit');assert.equal(app.vault.deletionEpoch,epoch+1);
    assert.deepEqual(await blobs(root),[]);
    const {checkpoint,head}=await decrypted(root,keychain);
    assert.equal(checkpoint.retention.mode,'quit');assert.equal(head.previousGeneration,null);assert.deepEqual(checkpoint.conversation,[]);assert.equal(checkpoint.draft,null);
    // The running session is untouched and keeps working; nothing new reaches disk.
    assert.equal(app.store.originals.length,2);
    const quiet=await tree(root);
    await app.say({role:'user',text:'Remove page 2.'});
    await app.controller.quick('remove',2);assert.equal(app.controller.state.error,null);
    app.chat.draft='another draft';await app.vault.save(app.snapshot);
    assert.deepEqual(await tree(root),quiet);
    // Quit, crash or force termination all look the same to the next launch: memory is gone.
    const relaunched=await launch(root,keychain,clock);
    assert.equal(relaunched.outcome.kind,'restored');assert.equal(relaunched.vault.retention,'quit');
    assert.equal(relaunched.store.list.length,0);assert.deepEqual(relaunched.chat.conversation,[]);
    assert.deepEqual(await tree(outside),external);
  }finally{await done(root,outside);}
});

test('SHR-40 a crash while switching to Delete when atePDF quits never brings back the earlier workspace',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);
    const refs=await blobs(root);
    // The new epoch is published, then removal of old PDF copies fails (as if atePDF died mid-cleanup).
    app.backend.fault=(step,name)=>{if(step==='remove'&&name.startsWith('blobs/'))throw Object.assign(new Error('EIO'),{code:'EIO'});};
    const change=await app.vault.setRetention('quit',app.snapshot);
    assert.deepEqual(change,{kind:'cleared',cleanupComplete:false});assert.equal(app.vault.cleanupPending,true);
    assert.deepEqual(await blobs(root),refs);
    const relaunched=await launch(root,keychain,clock);
    assert.equal(relaunched.outcome.kind,'restored');assert.equal(relaunched.store.list.length,0);assert.equal(relaunched.vault.retention,'quit');
    assert.equal((relaunched.outcome as {cleanupPending:boolean}).cleanupPending,false);assert.deepEqual(await blobs(root),[]);
  }finally{await done(root,outside);}
});

test('SHR-40 switching from Delete when atePDF quits back to a durable mode saves only the current session',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);
    const oldRefs=await blobs(root),oldEpoch=app.vault.deletionEpoch;
    await app.vault.setRetention('quit',app.snapshot);
    // A new session's work in quit mode, with a recognized secret typed into chat.
    app.store.clear();app.chat.conversation=[];app.chat.draft=null;
    await app.say({role:'user',text:`Here is my password: ${CANARY}`});
    await app.controller.import([new File([new Uint8Array(await readFile(join(outside,'appendix.pdf')))],'appendix.pdf')]);assert.equal(app.controller.state.error,null);
    clock.t=T0+DAY_MS;
    await app.say({role:'assistant',text:'Your PDF is ready.'});
    assert.deepEqual(await app.vault.setRetention('keep',app.snapshot),{kind:'changed'});
    const {checkpoint,head}=await decrypted(root,keychain);
    assert.equal(checkpoint.retention.mode,'keep');assert.equal(head.deletionEpoch,oldEpoch+1);
    // Its age is the session's own last activity, not the moment of the switch.
    assert.equal(checkpoint.lastActivityAt,new Date(T0+DAY_MS).toISOString());
    const newRefs=await blobs(root);
    assert.equal(newRefs.length,1);assert.ok(newRefs.every(ref=>!oldRefs.includes(ref)));
    const raw=await allRaw(root,keychain);assert.ok(!raw.includes(CANARY));
    const relaunched=await launch(root,keychain,clock);
    assert.equal(relaunched.outcome.kind,'restored');assert.equal(relaunched.store.originals.length,1);
    assert.deepEqual(relaunched.chat.conversation.map(e=>e.text),[safeOrdinaryText(`Here is my password: ${CANARY}`),'Your PDF is ready.']);
    // Its fallback is the empty quit-mode generation, never the pre-quit workspace.
    await corrupt(join(root,names.manifest(head.generation)),bytes=>{bytes[bytes.length-1]^=1;return bytes;});
    const fallback=await launch(root,keychain,clock);
    assert.equal(fallback.outcome.kind,'restored');assert.equal(fallback.store.list.length,0);assert.equal((fallback.outcome as {recoveredPrevious:boolean}).recoveredPrevious,true);
  }finally{await done(root,outside);}
});

test('SHR-40 Start over keeps the retention setting; Delete local data resets it to Keep until I delete it',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);await app.vault.setRetention('7d',app.snapshot);
    await app.controller.clear();assert.equal(app.store.list.length,0);assert.equal(app.vault.retention,'7d');
    assert.equal((await launch(root,keychain,clock)).vault.retention,'7d');
    const next=await launch(root,keychain,clock);await populated(next,outside);
    await next.controller.clear(()=>next.vault.deleteAll());
    assert.equal(next.store.list.length,0);assert.equal(next.vault.retention,'keep');
    const relaunched=await launch(root,keychain,clock);assert.equal(relaunched.vault.retention,'keep');assert.equal(relaunched.store.list.length,0);assert.deepEqual(relaunched.chat.conversation,[]);
  }finally{await done(root,outside);}
});

test('SHR-40 Delete local data removes every managed file, leaves external originals and exports byte-identical, and survives relaunch',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);
    const external=await tree(outside),before=await decrypted(root,keychain);
    await writeFile(join(root,'staging','orphan.tmp'),new Uint8Array(64));
    assert.deepEqual(await app.vault.deleteAll(),{cleanupComplete:true});
    const after=await decrypted(root,keychain);
    assert.equal(after.head.deletionEpoch,before.head.deletionEpoch+1);assert.equal(after.head.previousGeneration,null);
    assert.deepEqual(Object.keys(await tree(root)).sort(),['head',`manifests/${after.head.generation}.atw`]);
    assert.deepEqual(await tree(outside),external);
    const relaunched=await launch(root,keychain,clock);
    assert.equal(relaunched.outcome.kind,'restored');assert.equal(relaunched.store.list.length,0);assert.deepEqual(relaunched.chat.conversation,[]);assert.equal(relaunched.chat.draft,null);
    // A crash that corrupts the new epoch never falls back to data from before it.
    await corrupt(join(root,names.manifest(after.head.generation)),bytes=>{bytes[bytes.length-1]^=1;return bytes;});
    assert.deepEqual((await launch(root,keychain,clock)).outcome,{kind:'blocked',reason:'corrupt',retryable:false});
  }finally{await done(root,outside);}
});

test('SHR-40 repeated Delete local data and Start over are safe and idempotent',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);
    for(let i=0;i<3;i++)assert.deepEqual(await app.vault.deleteAll(),{cleanupComplete:true});
    await app.controller.clear(()=>app.vault.deleteAll());assert.equal(app.controller.state.error,null);
    await app.controller.clear();assert.equal(app.controller.state.error,null);
    assert.equal(app.vault.deletionEpoch,5);assert.deepEqual(await blobs(root),[]);assert.equal((await readdir(join(root,'manifests'))).length,1);
    assert.equal((await launch(root,keychain,clock)).store.list.length,0);
  }finally{await done(root,outside);}
});

test('SHR-40 Delete local data joins active work: a running job is cancelled first and nothing it produced survives',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock,{delay:400});await populated(app,outside);
    const merged=app.store.focus;
    const running=app.controller.quick('remove',2);
    await new Promise(resolve=>setTimeout(resolve,50));assert.equal(app.controller.state.busy,true);
    // A chat line saved while the job runs belongs to the workspace being deleted.
    const lateChat=app.say({role:'assistant',text:'Late message from before the delete.'});
    await app.controller.settle();await running;
    assert.equal(app.controller.state.stage,'cancelled');assert.equal(app.store.focus,merged);
    await app.controller.clear(()=>app.vault.deleteAll());
    await lateChat.catch(()=>undefined);
    assert.equal(app.store.list.length,0);assert.deepEqual(await blobs(root),[]);
    const relaunched=await launch(root,keychain,clock);
    assert.equal(relaunched.store.list.length,0);assert.deepEqual(relaunched.chat.conversation,[]);
  }finally{await done(root,outside);}
});

test('SHR-40 a job already saving its commit settles before Delete local data, which then removes it',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);
    let release:()=>void=()=>{},holding=false;const gate=new Promise<void>(resolve=>{release=resolve;});
    // Hold publication: SHR-44 joins the write, then durably withdraws it before Delete.
    const write=app.backend.writeSealed.bind(app.backend);let hold=true;
    app.backend.writeSealed=async(name,plain,associated)=>{if(hold&&name===names.head){hold=false;holding=true;await gate;}return write(name,plain,associated);};
    const running=app.controller.quick('remove',2);
    while(!holding)await new Promise(resolve=>setTimeout(resolve,5));
    const settled=app.controller.settle();
    await new Promise(resolve=>setTimeout(resolve,20));assert.equal(app.controller.state.busy,true);
    release();await settled;await running;
    assert.equal(app.controller.state.stage,'cancelled');assert.equal(app.store.history.length,1);
    assert.deepEqual((await launch(root,keychain,clock)).store.history,app.store.history);
    await app.controller.clear(()=>app.vault.deleteAll());assert.equal(app.controller.state.error,null);
    assert.equal(app.store.list.length,0);assert.deepEqual(await blobs(root),[]);
    assert.equal((await launch(root,keychain,clock)).store.list.length,0);
  }finally{await done(root,outside);}
});

test('SHR-40 Delete local data works when the saved workspace cannot be opened (missing key, damage, newer version)',async()=>{
  for(const damage of ['key','corrupt','schema'] as const){
    const {root,outside,keychain,clock}=await scratch();
    try{
      const app=await launch(root,keychain,clock);await populated(app,outside);
      const external=await tree(outside),{checkpoint,head}=await decrypted(root,keychain);
      if(damage==='key')keychain.raw=null;
      if(damage==='corrupt'){await corrupt(join(root,names.manifest(head.generation)),b=>b.slice(0,20));await corrupt(join(root,names.manifest(head.previousGeneration!)),b=>b.slice(0,20));}
      if(damage==='schema'){const backend=new NodeVaultBackend(root,keychain);await backend.writeSealed(names.head,new TextEncoder().encode(JSON.stringify({...head,format:checkpoint.format,schemaVersion:9,workspaceID:checkpoint.workspaceID})),aad.head());}
      const blocked=await launch(root,keychain,clock);
      assert.equal(blocked.outcome.kind,'blocked',damage);
      // A save requested while the delete is queued is fenced out of the new workspace.
      const deletion=blocked.vault.deleteAll(),stale=blocked.vault.save(blocked.snapshot);
      assert.deepEqual(await deletion,{cleanupComplete:true},damage);
      await assert.rejects(stale,StaleSaveError);
      assert.equal(blocked.vault.mode,'writable');assert.equal(blocked.vault.retention,'keep');
      assert.deepEqual(Object.keys(await tree(root)),['head'],damage);
      assert.deepEqual(await tree(outside),external);
      const relaunched=await launch(root,keychain,clock);
      assert.deepEqual(relaunched.outcome,{kind:'empty',retention:'keep',cleanupPending:false},damage);
    }finally{await done(root,outside);}
  }
});

test('SHR-40 deleting an unopenable workspace removes the head first and reports failure truthfully',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);keychain.raw=null;
    const blocked=await launch(root,keychain,clock),before=await tree(root);
    // The head cannot be unlinked: nothing is removed and nothing is claimed.
    blocked.backend.fault=(step,name)=>{if(step==='remove'&&name===names.head)throw Object.assign(new Error('EACCES'),{code:'EACCES'});};
    await assert.rejects(blocked.vault.deleteAll(),new RegExp(DELETE_FAILED));assert.deepEqual(await tree(root),before);
    // Unlinked but its directory sync failed: not confirmed, nothing more is removed.
    blocked.backend.fault=(step,name)=>{if(step==='remove-sync'&&name===names.head)throw Object.assign(new Error('EIO'),{code:'EIO'});};
    await assert.rejects(blocked.vault.deleteAll(),new RegExp(DELETE_UNCONFIRMED));
    const partial=await tree(root);assert.ok(!('head' in partial));assert.deepEqual(Object.keys(partial).length,Object.keys(before).length-1);
    // A relaunch now finds stored files without a head: blocked, never restored.
    keychain.raw=crypto.getRandomValues(new Uint8Array(32));
    assert.deepEqual((await launch(root,keychain,clock)).outcome,{kind:'blocked',reason:'corrupt',retryable:false});
    // Retrying the delete completes it.
    blocked.backend.fault=null;
    assert.deepEqual(await blocked.vault.deleteAll(),{cleanupComplete:true});
    assert.deepEqual((await launch(root,keychain,clock)).outcome,{kind:'empty',retention:'keep',cleanupPending:false});
  }finally{await done(root,outside);}
});

test('SHR-40 a failed Delete local data on an open workspace removes nothing and says so',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);
    const before=await tree(root),refs=app.store.list.length;
    app.backend.fault=step=>{if(step==='stage')throw Object.assign(new Error('ENOSPC'),{code:'ENOSPC'});};
    await app.controller.clear(()=>app.vault.deleteAll());
    // Only an interrupted staging file (never referenced; removed at the next launch) may appear.
    const after=Object.fromEntries(Object.entries(await tree(root)).filter(([name])=>!name.startsWith('staging/')));
    assert.equal(app.controller.state.error,CLEAR_FAILED);assert.equal(app.store.list.length,refs);assert.deepEqual(after,before);
    app.backend.fault=null;
    assert.equal((await launch(root,keychain,clock)).store.list.length,refs);
  }finally{await done(root,outside);}
});

test('SHR-40 permission and storage failures during deletion leave cleanup pending, never claimed, and it finishes later',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);
    // A real permission failure: the blobs directory cannot be listed or changed.
    await chmod(join(root,'blobs'),0o000);
    assert.deepEqual(await app.vault.deleteAll(),{cleanupComplete:false});assert.equal(app.vault.cleanupPending,true);
    await chmod(join(root,'blobs'),0o700);
    assert.ok((await blobs(root)).length>0);
    // The deletion itself is durable: a relaunch shows nothing and finishes the cleanup.
    const relaunched=await launch(root,keychain,clock);
    assert.equal(relaunched.store.list.length,0);assert.deepEqual(relaunched.chat.conversation,[]);
    assert.equal((relaunched.outcome as {cleanupPending:boolean}).cleanupPending,false);assert.deepEqual(await blobs(root),[]);
    // Measuring storage fails closed too: no invented zero.
    relaunched.backend.fault=step=>{if(step==='usage')throw Object.assign(new Error('EIO'),{code:'EIO'});};
    await assert.rejects(relaunched.vault.usage());
  }finally{await done(root,outside);}
});

test('SHR-40 storage usage counts only atePDF-managed workspace files, by category, and excludes external files',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);
    const usage=await app.vault.usage(),files=await tree(root);
    const size=async(name:string)=>(await readFile(join(root,name))).length;
    let total=0;for(const name of Object.keys(files))total+=await size(name);
    assert.equal(usage.total,total);assert.equal(usage.pending,0);assert.equal(usage.unopened,0);
    let originals=0,results=0;for(const ref of app.store.list){const bytes=await size(names.blob(ref.ref));if(ref.original)originals+=bytes;else results+=bytes;}
    assert.equal(usage.originals,originals);assert.equal(usage.results,results);
    assert.equal(usage.records,total-originals-results);
    assert.ok(usage.originals>0&&usage.results>0&&usage.records>0);
    // Growing or adding the user's own files changes nothing here.
    await writeFile(join(outside,'another export.pdf'),new Uint8Array(5_000_000));
    assert.deepEqual(await app.vault.usage(),usage);
    // Files still to be removed are shown as such, not as the workspace.
    app.backend.fault=(step,name)=>{if(step==='remove'&&name.startsWith('blobs/'))throw new Error('EIO');};
    await app.vault.clear();app.backend.fault=null;
    const pending=await app.vault.usage();
    assert.equal(pending.originals+pending.results,0);assert.equal(pending.pending,originals+results);
    // In quit mode nothing from the session is on disk.
    await app.vault.setRetention('quit',app.snapshot);
    const quit=await app.vault.usage();assert.equal(quit.originals+quit.results+quit.pending,0);
    // A workspace that can't be opened is shown as unopened, not as empty.
    keychain.raw=null;const blocked=await launch(root,keychain,clock);
    const unopened=await blocked.vault.usage();assert.equal(unopened.unopened,unopened.total);assert.ok(unopened.total>0);
  }finally{await done(root,outside);}
});

test('SHR-40 retention changes keep SHR-71 protections: no recognized secret is written by a mode change or the switch back from quit',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    assert.equal(hasRejectedSecretDraft(`my password is ${CANARY}`),true);
    const app=await launch(root,keychain,clock);await populated(app,outside);
    await app.say({role:'user',text:`password: ${CANARY}`});
    app.chat.draft=`my password is ${CANARY}`;await app.vault.save(app.snapshot);
    for(const mode of ['30d','7d','keep','quit','keep'] as const)await app.vault.setRetention(mode,app.snapshot);
    for(const name of Object.keys(await tree(root))){const bytes=await readFile(join(root,name));assert.ok(!bytes.includes(Buffer.from(CANARY)),name);}
    assert.ok(!(await allRaw(root,keychain)).includes(CANARY));
    const {checkpoint}=await decrypted(root,keychain);assert.equal(checkpoint.draft,null);
  }finally{await done(root,outside);}
});

test('SHR-40 a quit-mode checkpoint may hold the preference only',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);
    const {checkpoint}=await decrypted(root,keychain);
    assert.throws(()=>parseCheckpoint({...checkpoint,retention:{mode:'quit'}}),/ephemeral/);
    assert.throws(()=>parseCheckpoint({...checkpoint,retention:{mode:'quit'},artifacts:[],originals:[],history:[],focus:null,undoPredecessor:null,selection:[],conversation:[],draft:{text:'x'}}),/ephemeral/);
    assert.equal(parseCheckpoint({...checkpoint,retention:{mode:'quit'},artifacts:[],originals:[],history:[],focus:null,undoPredecessor:null,selection:[],conversation:[],draft:null}).retention.mode,'quit');
    assert.throws(()=>parseCheckpoint({...checkpoint,retention:{mode:'90d'}}),/retention mode/);
  }finally{await done(root,outside);}
});

test('SHR-40 an expired workspace is deleted even when one of its PDFs is missing or damaged',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);await app.vault.setRetention('7d',app.snapshot);
    const [first]=await blobs(root);await rm(join(root,'blobs',first));
    // Before the period, a missing PDF blocks the workspace as in SHR-39 (nothing partial is opened).
    clock.t=T0+DAY_MS;assert.deepEqual((await launch(root,keychain,clock)).outcome,{kind:'blocked',reason:'missing-artifact',retryable:false});
    // After it, the workspace's age is read first and it is expired, not kept alive by the damage.
    clock.t=T0+7*DAY_MS;
    assert.deepEqual((await launch(root,keychain,clock)).outcome,{kind:'expired',retention:'7d',cleanupPending:false});
    assert.deepEqual(await blobs(root),[]);
  }finally{await done(root,outside);}
});

test('SHR-40 an expired workspace reached through the same-epoch fallback is expired, not restored',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);await app.vault.setRetention('7d',app.snapshot);
    const {head}=await decrypted(root,keychain);
    // The head, the commit point, records the setting; its predecessor still says Keep.
    assert.equal((head as {retention?:string}).retention,'7d');
    const backend=new NodeVaultBackend(root,keychain),headBytes=await readFile(join(root,'head'));
    // A head that disagrees with its own manifest is refused, not reconciled.
    await backend.writeSealed(names.head,new TextEncoder().encode(JSON.stringify({...head,retention:'keep'})),aad.head());
    assert.deepEqual((await launch(root,keychain,clock)).outcome,{kind:'blocked',reason:'corrupt',retryable:false});
    await writeFile(join(root,'head'),headBytes);
    await corrupt(join(root,names.manifest(head.generation)),bytes=>{bytes[bytes.length-1]^=1;return bytes;});
    clock.t=T0+DAY_MS;
    const fallback=await launch(root,keychain,clock);
    assert.equal(fallback.outcome.kind,'restored');assert.equal((fallback.outcome as {recoveredPrevious:boolean}).recoveredPrevious,true);
    clock.t=T0+7*DAY_MS;
    const expired=await launch(root,keychain,clock);
    assert.equal(expired.outcome.kind,'expired');assert.equal(expired.store.list.length,0);
    assert.equal((await launch(root,keychain,clock)).store.list.length,0);
  }finally{await done(root,outside);}
});

test('SHR-40 P1-1 a completion ticket goes stale once the workspace is emptied, and only then',async()=>{
  const session=new WorkspaceSession(),before=session.ticket();
  assert.equal(before(),true);
  session.advance();
  assert.equal(before(),false);
  const after=session.ticket();assert.equal(after(),true);assert.equal(before(),false);
  // The App gate this backs (pick → import) is exercised end to end in tests/e2e/retention.spec.ts,
  // with a held sample download and a held file chooser completing after Delete local data.
});

// P1-2: staging files (interrupted writes) are part of the truthful cleanup accounting.
const stagingFiles=async(root:string)=>(await readdir(join(root,'staging')).catch(()=>[] as string[])).sort();
async function withStagingLeftover(root:string){await mkdir(join(root,'staging'),{recursive:true});await writeFile(join(root,'staging','interrupted.tmp'),new Uint8Array(64));}
const failing=(code:string):never=>{throw Object.assign(new Error(code),{code});};

test('SHR-40 P1-2 a staging listing or unlink failure keeps Delete local data incomplete, visible as pending, until a later cleanup removes it',async()=>{
  for(const fault of ['staging-list','staging-remove','staging-skip'] as const){
    const {root,outside,keychain,clock}=await scratch();
    try{
      const app=await launch(root,keychain,clock);await populated(app,outside);
      await withStagingLeftover(root);
      app.backend.fault=step=>{if(fault==='staging-skip'&&step==='staging-remove')return 'skip';if(step===fault)failing('EACCES');};
      await app.controller.clear(()=>app.vault.deleteAll());app.chat.conversation=[];app.chat.draft=null;
      // The workspace itself is gone (new epoch), but deletion is not reported complete.
      assert.equal(app.controller.state.message,CLEANUP_INCOMPLETE,fault);assert.equal(app.vault.cleanupPending,true,fault);
      assert.deepEqual(await blobs(root),[],fault);assert.deepEqual(await stagingFiles(root),['interrupted.tmp'],fault);
      // The retained bytes are shown as waiting to be removed, not hidden.
      const usage=await app.vault.usage();assert.equal(usage.pending,64,fault);assert.equal(usage.originals+usage.results,0,fault);
      // A later save while the failure persists keeps it pending.
      await app.say({role:'user',text:'Hello again.'});assert.equal(app.vault.cleanupPending,true,fault);
      // The next cleanup after the failure clears removes it; only then is the warning cleared.
      app.backend.fault=null;
      await app.say({role:'user',text:'And again.'});
      assert.equal(app.vault.cleanupPending,false,fault);assert.deepEqual(await stagingFiles(root),[],fault);assert.equal((await app.vault.usage()).pending,0,fault);
    }finally{await done(root,outside);}
  }
});

test('SHR-40 P1-2 a staging directory sync failure is unconfirmed, and relaunch retries staging cleanup before reporting it complete',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);
    await withStagingLeftover(root);
    app.backend.fault=step=>{if(step==='staging-sync')failing('EIO');};
    assert.deepEqual(await app.vault.deleteAll(),{cleanupComplete:false});assert.equal(app.vault.cleanupPending,true);
    // Launch retries it; the unlink alone is not proof, the sync must succeed.
    const failingLaunch=await launch(root,keychain,clock,{fault:step=>{if(step==='staging-sync')failing('EIO');}});
    assert.equal((failingLaunch.outcome as {cleanupPending:boolean}).cleanupPending,true);
    const relaunched=await launch(root,keychain,clock);
    assert.equal((relaunched.outcome as {cleanupPending:boolean}).cleanupPending,false);assert.deepEqual(await stagingFiles(root),[]);
    // Start over includes staging too.
    await withStagingLeftover(root);
    relaunched.backend.fault=step=>{if(step==='staging-list')failing('EIO');};
    await relaunched.controller.clear();assert.equal(relaunched.controller.state.message,CLEANUP_INCOMPLETE);
  }finally{await done(root,outside);}
});

test('SHR-40 P1-2 a staging file left by a failed write is removed and verified at the next save',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);
    app.backend.fault=(step,name)=>{if(step==='stage'&&name.startsWith('manifests/'))failing('ENOSPC');};
    await assert.rejects(app.say({role:'user',text:'This save fails.'}));
    assert.equal((await stagingFiles(root)).length,1);
    assert.ok((await app.vault.usage()).pending>0);
    app.backend.fault=null;
    await app.say({role:'user',text:'This one works.'});
    assert.deepEqual(await stagingFiles(root),[]);assert.equal(app.vault.cleanupPending,false);
  }finally{await done(root,outside);}
});

// Final review B1: Delete local data on an unopenable workspace never trusts remove() for
// the head. Its absence is checked independently before anything is reported deleted.
test('SHR-40 B1 a head removal that reports success but leaves the head is verified, and unlock/relaunch never restores the old conversation',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);
    const {checkpoint}=await decrypted(root,keychain);assert.ok(checkpoint.conversation.length>0);
    keychain.state='locked';
    const blocked=await launch(root,keychain,clock);
    assert.deepEqual(blocked.outcome,{kind:'blocked',reason:'key-locked',retryable:true});
    // The review case: remove(head) says it succeeded but leaves the head, and every
    // cleanup listing fails.
    let lies=0;
    blocked.backend.fault=(step,name)=>{if(step==='remove'&&name===names.head&&!lies++)return 'skip';if(step==='list')failing('EIO');};
    assert.deepEqual(await blocked.vault.deleteAll(),{cleanupComplete:false});
    // The key becomes available and atePDF relaunches: the actual restored state is empty.
    blocked.backend.fault=null;keychain.state='ok';
    const relaunched=await launch(root,keychain,clock);
    assert.deepEqual(relaunched.chat.conversation,[]);assert.equal(relaunched.chat.draft,null);assert.equal(relaunched.store.list.length,0);
    assert.deepEqual(relaunched.outcome,{kind:'blocked',reason:'corrupt',retryable:false});
    assert.equal(relaunched.vault.mode,'blocked');
    // Why: the false success was caught, the head removed again and independently found gone.
    assert.equal(lies,2);
    assert.equal(blocked.backend.calls.filter(c=>c.op==='remove'&&c.name===names.head).length,2);
    assert.equal(await blocked.backend.exists(names.head),false);
    // Deleting again finishes the job; still nothing from before comes back.
    assert.deepEqual(await relaunched.vault.deleteAll(),{cleanupComplete:true});
    const fresh=await launch(root,keychain,clock);
    assert.deepEqual(fresh.outcome,{kind:'empty',retention:'keep',cleanupPending:false});assert.deepEqual(fresh.chat.conversation,[]);assert.equal(fresh.store.list.length,0);
  }finally{await done(root,outside);}
});

test('SHR-40 B1 a head that stays present, or whose presence is unknown, is never reported deleted and nothing else is removed',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);
    const {checkpoint}=await decrypted(root,keychain);
    keychain.state='locked';
    const blocked=await launch(root,keychain,clock),before=await tree(root);
    // Every head removal claims success but leaves the file; listings fail as well.
    blocked.backend.fault=(step,name)=>{if(step==='remove'&&name===names.head)return 'skip';if(step==='list')failing('EIO');};
    await assert.rejects(blocked.vault.deleteAll(),new RegExp(DELETE_FAILED));
    assert.deepEqual(await tree(root),before);
    assert.equal(blocked.vault.mode,'blocked');assert.equal(blocked.vault.blockedReason,'key-locked');
    // Whether the head is gone can't be determined: fail closed, still nothing more removed.
    blocked.backend.fault=(step,name)=>{if(step==='remove'&&name===names.head)return 'skip';if(step==='exists'&&name===names.head)failing('EIO');};
    await assert.rejects(blocked.vault.deleteAll(),new RegExp(DELETE_UNCONFIRMED));
    assert.deepEqual(await tree(root),before);assert.equal(blocked.vault.mode,'blocked');
    // A save queued behind the failed delete is still refused: no new workspace was started.
    await assert.rejects(blocked.vault.save(blocked.snapshot));assert.deepEqual(await tree(root),before);
    // The user was told nothing was removed, and nothing was: after unlock the workspace
    // opens whole, exactly as it was, never partially.
    keychain.state='ok';
    const relaunched=await launch(root,keychain,clock);
    assert.equal(relaunched.outcome.kind,'restored');assert.deepEqual(relaunched.chat.conversation,checkpoint.conversation);assert.equal(relaunched.store.list.length,checkpoint.artifacts.length);
  }finally{await done(root,outside);}
});

// Final review B2: the staging cleanup obligation does not depend on which generation restored.
test('SHR-40 B2 a fallback restore keeps staging cleanup pending and counted until a later save removes it',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const app=await launch(root,keychain,clock);await populated(app,outside);
    const {head,checkpoint}=await decrypted(root,keychain),backend=new NodeVaultBackend(root,keychain);
    const previousFile=await backend.readOpened(names.manifest(head.previousGeneration!),aad.manifest(checkpoint.workspaceID,head.previousGeneration!));
    assert.equal(previousFile.status,'ok');
    const previous=parseCheckpoint(JSON.parse(new TextDecoder().decode((previousFile as {bytes:Uint8Array}).bytes)));
    // Newest manifest corrupt, preceding generation valid, interrupted staging bytes present.
    await corrupt(join(root,names.manifest(head.generation)),bytes=>{bytes[bytes.length-1]^=1;return bytes;});
    await withStagingLeftover(root);
    const fallback=await launch(root,keychain,clock,{fault:step=>{if(step==='staging-list')failing('EACCES');}});
    // The previous generation restored.
    assert.equal(fallback.outcome.kind,'restored');assert.equal((fallback.outcome as {recoveredPrevious:boolean}).recoveredPrevious,true);
    assert.deepEqual(fallback.chat.conversation,previous.conversation);assert.equal(fallback.chat.draft,previous.draft?.text??null);
    assert.deepEqual(fallback.store.list.map(a=>a.ref).sort(),previous.artifacts.map(a=>a.ref).sort());
    // Staging could not be cleaned: pending, and its bytes are reported as still to remove.
    assert.equal((fallback.outcome as {cleanupPending:boolean}).cleanupPending,true);assert.equal(fallback.vault.cleanupPending,true);
    assert.deepEqual(await stagingFiles(root),['interrupted.tmp']);
    const usage=await fallback.vault.usage();assert.equal(usage.pending,64);assert.equal(usage.unopened,0);
    // Cleanup is allowed again; the next save retries it, removes the bytes and clears the flag.
    fallback.backend.fault=null;
    await fallback.say({role:'user',text:'Carry on.'});
    assert.deepEqual(await stagingFiles(root),[]);assert.equal(fallback.vault.cleanupPending,false);assert.equal((await fallback.vault.usage()).pending,0);
  }finally{await done(root,outside);}
});

// Cross-review S40-01: a fallback restore keeps the newest generation as evidence, but
// an earlier unlink whose directory sync failed is still owed a confirming sync of each
// directory. An empty listing is never proof that the removal is durable.
async function unsyncedUnlinkThenCorruptNewest(root:string,outside:string,keychain:TestKeychain,clock:Clock){
  const app=await launch(root,keychain,clock);await populated(app,outside);
  const orphan='blobs/file_s40_orphan.atw';await writeFile(join(root,orphan),new Uint8Array(64));
  app.backend.fault=(step,name)=>{if(step==='remove-sync'&&name===orphan)failing('EIO');};
  await app.say({role:'user',text:'Another checkpoint.'});
  // The unlink ran but its directory sync failed: cleanup is owed, the file no longer lists.
  assert.equal(app.vault.cleanupPending,true);
  assert.ok(app.backend.calls.some(c=>c.op==='remove'&&c.name===orphan&&!c.ok));
  assert.ok(!(await app.backend.list('blobs')).includes(orphan));
  const {head}=await decrypted(root,keychain);
  await corrupt(join(root,names.manifest(head.generation)),bytes=>{bytes[bytes.length-1]^=1;return bytes;});
  return {newest:names.manifest(head.generation)};
}
const syncFaultIn=(directories:readonly string[]):Fault=>(step,name)=>{if(step==='dir-sync'&&directories.includes(name))failing('EIO');};
const syncCalls=(app:App,from=0)=>app.backend.calls.slice(from).filter(c=>c.op==='syncDirectory');

test('SHR-40 S40-01 fallback restore after an unconfirmed unlink keeps cleanup pending while directory syncs fail',async()=>{
  const {root,outside,keychain,clock}=await scratch();
  try{
    const {newest}=await unsyncedUnlinkThenCorruptNewest(root,outside,keychain,clock);
    // The reviewer's reproduction: relaunch with every explicit directory sync failing.
    const next=await launch(root,keychain,clock,{fault:syncFaultIn(['manifests','blobs'])});
    assert.equal(next.outcome.kind,'restored');assert.equal((next.outcome as {recoveredPrevious:boolean}).recoveredPrevious,true);
    assert.equal((next.outcome as {cleanupPending:boolean}).cleanupPending,true,'failed cleanup must stay pending until both directory syncs succeed');
    assert.equal(next.vault.cleanupPending,true);
    // Launch attempted the confirming sync of each directory, and none succeeded.
    const attempted=syncCalls(next);
    assert.ok(attempted.some(c=>c.name==='manifests')&&attempted.some(c=>c.name==='blobs'),'both confirming syncs were attempted');
    assert.ok(attempted.every(c=>!c.ok));
    // The unreadable newest generation is kept as evidence, untouched.
    assert.equal(await next.backend.exists(newest),true);
    // A relaunch once syncing works confirms both directories, and only then is cleanup complete.
    const healthy=await launch(root,keychain,clock);
    assert.equal((healthy.outcome as {recoveredPrevious:boolean}).recoveredPrevious,true);
    assert.deepEqual(syncCalls(healthy).filter(c=>c.ok).map(c=>c.name).sort(),['blobs','manifests']);
    assert.equal((healthy.outcome as {cleanupPending:boolean}).cleanupPending,false);assert.equal(healthy.vault.cleanupPending,false);
    assert.equal(await healthy.backend.exists(newest),true,'confirmation does not require deleting the evidence');
  }finally{await done(root,outside);}
});

test('SHR-40 S40-01 each directory is confirmed independently; a failed one stays pending across later saves and launches until its sync succeeds',async()=>{
  for(const failingDirs of [['manifests'],['blobs'],['manifests','blobs']] as const){
    const label=failingDirs.join('+');
    const {root,outside,keychain,clock}=await scratch();
    try{
      await unsyncedUnlinkThenCorruptNewest(root,outside,keychain,clock);
      const first=await launch(root,keychain,clock,{fault:syncFaultIn(failingDirs)});
      assert.equal((first.outcome as {recoveredPrevious:boolean}).recoveredPrevious,true,label);
      assert.equal((first.outcome as {cleanupPending:boolean}).cleanupPending,true,label);
      // The healthy directory was confirmed; the failing one was attempted and not.
      for(const directory of ['manifests','blobs']){
        const calls=syncCalls(first).filter(c=>c.name===directory);
        assert.ok(calls.length>0,`${label}: ${directory} attempted`);
        assert.equal(calls.some(c=>c.ok),!failingDirs.includes(directory as never),`${label}: ${directory}`);
      }
      // Relaunch while it still fails: still pending, retried again.
      const again=await launch(root,keychain,clock,{fault:syncFaultIn(failingDirs)});
      assert.equal((again.outcome as {cleanupPending:boolean}).cleanupPending,true,label);
      assert.ok(syncCalls(again).some(c=>!c.ok),label);
      // A later save while it still fails: still pending (an empty listing is not proof).
      await again.say({role:'user',text:'Saved while syncing fails.'});
      assert.equal(again.vault.cleanupPending,true,label);
      if(failingDirs.length===2){
        // Only one directory recovers: still pending until the other one is confirmed too.
        again.backend.fault=syncFaultIn(['blobs']);
        const mark=again.backend.calls.length;
        await again.say({role:'user',text:'Manifests sync again.'});
        assert.ok(syncCalls(again,mark).some(c=>c.name==='manifests'&&c.ok),label);
        assert.equal(again.vault.cleanupPending,true,`${label}: blobs still owed`);
      }
      // Syncing works again: the next save confirms exactly what is still owed and clears it.
      again.backend.fault=null;
      const mark=again.backend.calls.length;
      await again.say({role:'user',text:'Saved once syncing works.'});
      assert.deepEqual(syncCalls(again,mark).filter(c=>c.ok).map(c=>c.name),failingDirs.length===2?['blobs']:[...failingDirs],label);
      assert.equal(again.vault.cleanupPending,false,label);
      // Nothing is owed any more: a later save syncs nothing extra, and a relaunch is clean.
      const quiet=again.backend.calls.length;
      await again.say({role:'user',text:'Nothing owed.'});
      assert.deepEqual(syncCalls(again,quiet),[],label);
      const relaunched=await launch(root,keychain,clock);
      assert.equal(relaunched.outcome.kind,'restored',label);assert.equal((relaunched.outcome as {cleanupPending:boolean}).cleanupPending,false,label);
    }finally{await done(root,outside);}
  }
});
