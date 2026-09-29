import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,unlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {preflight,transform} from '../../packages/web-pdf/src/engine';
import {LocalFileStore} from '../../packages/core/src/local-file-store';
import {JobController} from '../../packages/core/src/job-controller';
import {WorkspaceVault,savedArtifacts,STORAGE_WRITE_FAILED,STORAGE_UNCONFIRMED,CLEAR_FAILED,CLEAR_UNCONFIRMED,type WorkspaceSnapshot} from '../../packages/core/src/workspace-vault';
import {aad,names,parseCheckpoint,WORKSPACE_FORMAT,type PersistedEntry,type WorkspaceCheckpoint} from '../../packages/core/src/workspace-checkpoint';
import {quickPlan} from '../../packages/contracts/src/protocol';
import {safeOrdinaryText} from '../../packages/planner/src/privacy';
import type {EngineRequest,Inspection} from '../../packages/web-pdf/src/types';
import {NodeVaultBackend,newKeychain,corrupt,type TestKeychain,type Fault} from '../helpers/workspace-backend';
import {CheckpointScheduler} from '../../packages/core/src/workspace-checkpoints';

// Synthetic local data only: bundled fixture PDFs, a temporary directory and an
// in-memory stand-in for the device-local Keychain. No network, no providers.
const fixture=async(name:string)=>new Uint8Array(await readFile(`tests/fixtures/${name}`));
const hash=async(bytes:Uint8Array)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)))].map(n=>n.toString(16).padStart(2,'0')).join('');
async function independent(bytes:Uint8Array):Promise<Inspection>{
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task=getDocument({data:bytes.slice(),useSystemFonts:true,verbosity:0});const doc=await task.promise;
  try{const pages=[];for(let n=1;n<=doc.numPages;n++){const p=await doc.getPage(n),v=p.getViewport({scale:1}),t=await p.getTextContent();pages.push({text:t.items.map(i=>'str'in i?i.str:'').join(' ').replace(/\s+/g,' ').trim(),width:v.width,height:v.height,rotation:p.rotate});}return {pages};}finally{await task.destroy();}
}
type Calls={inspect:number;transform:number};
const services=(calls:Calls)=>({worker:async(r:EngineRequest)=>{if(r.kind==='inspect'){calls.inspect++;return {pages:(await preflight(r.bytes)).getPageCount()};}calls.transform++;return transform(r,()=>{});},inspect:independent,recognize:async()=>[]});
const CANARY='hunter2-canary-7Qz';

// One simulated app launch: fresh memory, the same private directory and keychain.
// fault, when given, is active from before open() so launch-time failures are exercised.
async function launch(root:string,keychain:TestKeychain,fault:Fault|null=null){
  const backend=new NodeVaultBackend(root,keychain),vault=new WorkspaceVault(backend,{redact:safeOrdinaryText});backend.fault=fault;
  const calls:Calls={inspect:0,transform:0},store=new LocalFileStore(),controller=new JobController(store,services(calls));
  const chat:{conversation:PersistedEntry[];draft:string|null}={conversation:[],draft:null};
  const snapshot=():WorkspaceSnapshot=>({revision:store.revision,artifacts:store.list,bytes:ref=>store.get(ref).bytes,originals:store.originals,history:store.history,conversation:chat.conversation,draft:chat.draft});
  const outcome=await vault.open();
  if(outcome.kind==='restored'){
    await controller.restore(savedArtifacts(outcome.checkpoint,outcome.bytes),outcome.checkpoint.originals,outcome.checkpoint.history,outcome.checkpoint.revision);
    chat.conversation=outcome.checkpoint.conversation;chat.draft=outcome.checkpoint.draft?.text??null;
  }
  if(vault.mode==='writable')controller.setDurability({save:()=>vault.save(snapshot),clear:()=>vault.clear()});
  const say=async(entry:Omit<PersistedEntry,'id'>)=>{chat.conversation=[...chat.conversation,{...entry,id:chat.conversation.length+1}];await vault.save(snapshot);};
  return {backend,vault,store,controller,chat,outcome,calls,say,snapshot};
}
async function decrypted(root:string,keychain:TestKeychain):Promise<{checkpoint:WorkspaceCheckpoint;raw:string}>{
  const backend=new NodeVaultBackend(root,keychain),head=await backend.readOpened(names.head,aad.head());assert.equal(head.status,'ok');
  const {workspaceID,generation}=JSON.parse(new TextDecoder().decode((head as {bytes:Uint8Array}).bytes));
  const manifest=await backend.readOpened(names.manifest(generation),aad.manifest(workspaceID,generation));assert.equal(manifest.status,'ok');
  const raw=new TextDecoder().decode((manifest as {bytes:Uint8Array}).bytes);return {checkpoint:parseCheckpoint(JSON.parse(raw)),raw};
}
async function tree(root:string){
  const out:Record<string,string>={};
  for(const dir of ['','manifests','blobs'])for(const name of await readdir(join(root,dir)).catch(()=>[] as string[])){const path=join(root,dir,name);try{out[join(dir,name)]=await hash(new Uint8Array(await readFile(path)));}catch{/* directory */}}
  return out;
}
async function scratch(){return mkdtemp(join(tmpdir(),'atepdf-shr39-'));}
// A populated workspace: two originals, merge, remove page 2, plus chat and draft.
async function populated(root:string,keychain:TestKeychain){
  const app=await launch(root,keychain);assert.equal(app.outcome.kind,'empty');
  await app.say({role:'user',text:'I’ve added 2 PDFs.',files:[{name:'brief.pdf',size:1},{name:'appendix.pdf',size:1}]});
  await app.controller.import(await Promise.all(['brief.pdf','appendix.pdf'].map(async n=>new File([await fixture(n)],n))));assert.equal(app.controller.state.error,null);
  await app.controller.quick('merge');assert.equal(app.controller.state.error,null);const merged=app.store.focus!;
  await app.say({role:'assistant',text:'I merged your PDFs in the order added.',artifactRef:merged,resultTitle:'Merged PDF'});
  await app.controller.quick('remove',2);assert.equal(app.controller.state.error,null);const removed=app.store.focus!;
  await app.say({role:'assistant',text:'I removed page 2.',artifactRef:removed,resultTitle:'PDF with page 2 removed'});
  await app.say({role:'assistant',text:'Shall I create a new copy?',choice:'compress'});
  app.chat.draft='remove page 3';await app.vault.save(app.snapshot);
  return {...app,merged,removed};
}

test('SHR-39 quit/relaunch round-trips actual PDF bytes, order, focus, Undo predecessor, chat, draft and revision',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const first=await populated(root,keychain);
    const before=new Map(await Promise.all(first.store.list.map(async a=>[a.ref,{hash:await hash(first.store.get(a.ref).bytes),bytes:first.store.get(a.ref).bytes}] as const)));
    const {originals,history,revision}=first.store,conversation=first.chat.conversation,generation=first.vault.generation;
    const second=await launch(root,keychain);
    assert.equal(second.outcome.kind,'restored');
    assert.deepEqual(second.store.originals,originals);assert.deepEqual(second.store.history,history);
    assert.equal(second.store.focus,first.removed);assert.equal(second.store.canUndo,true);
    const checkpoint=(second.outcome as {checkpoint:WorkspaceCheckpoint}).checkpoint;
    assert.equal(checkpoint.undoPredecessor,first.merged);assert.equal(checkpoint.focus,first.removed);assert.deepEqual(checkpoint.selection,originals);
    for(const artifact of second.store.list){
      const {bytes,meta}=second.store.get(artifact.ref);
      assert.deepEqual(bytes,before.get(artifact.ref)!.bytes);assert.equal(await hash(bytes),before.get(artifact.ref)!.hash);assert.equal(meta.checksum,before.get(artifact.ref)!.hash);
    }
    assert.match(second.store.get(first.removed).meta.inspection.pages[1].text,/B1/);
    assert.deepEqual(second.chat.conversation,conversation);assert.equal(second.chat.draft,'remove page 3');
    // Revision moves past the saved one; the generation keeps moving forward.
    assert.equal(checkpoint.revision,revision);assert.equal(second.store.revision,revision+1);
    await second.say({role:'user',text:'Undo the last change.'});assert.equal(second.vault.generation,generation+1);
    // One Undo after relaunch restores the predecessor and is itself durable.
    await second.controller.undo();assert.equal(second.controller.state.error,null);assert.equal(second.store.focus,first.merged);
    const third=await launch(root,keychain);assert.equal(third.store.focus,first.merged);assert.equal(third.store.canUndo,false);
    assert.ok(third.store.list.some(a=>a.ref===first.removed),'earlier result stays available after Undo');
    // Originals stay byte-identical across every relaunch.
    for(const ref of originals)assert.equal(await hash(third.store.get(ref).bytes),before.get(ref)!.hash);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('SHR-39 restore is inert: no model, network, transform or confirmation replay, and stale plans are rejected',async()=>{
  const root=await scratch(),keychain=newKeychain(),realFetch=globalThis.fetch;
  try{
    const first=await populated(root,keychain);
    const staleRequest=first.controller.request(),stalePlan=quickPlan(staleRequest,'compress');
    let fetches=0;globalThis.fetch=(async()=>{fetches++;throw new Error('network disabled in test');}) as typeof fetch;
    const second=await launch(root,keychain);
    assert.equal(fetches,0);assert.equal(second.calls.transform,0);assert.equal(second.calls.inspect,second.store.list.length);
    assert.equal(second.controller.state.busy,false);assert.equal(second.controller.state.error,null);
    // The restored question is display-only; nothing about it is executable.
    const question=second.chat.conversation.find(e=>e.choice);assert.deepEqual(Object.keys(question!).sort(),['choice','id','role','text']);
    await assert.rejects(second.controller.execute(stalePlan,staleRequest),/Files changed/);
    assert.equal(second.calls.transform,0);assert.equal(fetches,0);
  }finally{globalThis.fetch=realFetch;await rm(root,{recursive:true,force:true});}
});

test('SHR-39 serialized state holds no recognized secret, password, token or planner request/envelope and is encrypted at rest',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await populated(root,keychain);
    const request=app.controller.request(),envelope=quickPlan(request,'merge');
    // Simulate a caller that bypassed the chat guard and leaked executable fields.
    const leaky={role:'user',text:`password: ${CANARY}`,files:[{name:`api_key=${CANARY}.pdf`,size:1}],request,envelope,revision:3,token:`Bearer ${CANARY}0000000000`,resultTitle:`secret: ${CANARY}`} as unknown as Omit<PersistedEntry,'id'>;
    await app.say(leaky);app.chat.draft=`my password is ${CANARY}`;await app.vault.save(app.snapshot);
    const {checkpoint,raw}=await decrypted(root,keychain);
    for(const needle of [CANARY,'requestId','workspaceRevision','planner','resultRefs','token','Bearer'])assert.ok(!raw.includes(needle),`manifest must not contain ${needle}`);
    assert.equal(checkpoint.draft,null);
    assert.deepEqual(Object.keys(checkpoint.conversation.at(-1)!).sort(),['files','id','resultTitle','role','text']);
    // Nothing on disk is plaintext: no PDF header, fixture text, canary or JSON.
    for(const [path] of Object.entries(await tree(root))){
      const bytes=Buffer.from(await readFile(join(root,path)));
      for(const needle of ['%PDF',CANARY,'"format"',WORKSPACE_FORMAT,'"conversation"'])assert.equal(bytes.includes(needle),false,`${path} leaks ${needle}`);
    }
    // Restored state carries the redacted text only.
    const again=await launch(root,keychain);assert.ok(!JSON.stringify(again.chat).includes(CANARY));assert.equal(again.chat.draft,null);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('SHR-39 storage failure never acknowledges a durable commit and the last good checkpoint survives',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await launch(root,keychain);
    await app.controller.import(await Promise.all(['brief.pdf','appendix.pdf'].map(async n=>new File([await fixture(n)],n))));
    const good=await tree(root),revision=app.store.revision;
    app.backend.fault=(step,name)=>{if(step==='stage'&&name.startsWith('manifests/'))throw new Error('synthetic disk full');};
    await app.controller.quick('merge');
    assert.equal(app.controller.state.error,STORAGE_WRITE_FAILED);assert.equal(app.controller.state.stage,'failed');
    assert.equal(app.store.focus,null);assert.equal(app.store.list.length,2);assert.ok(app.store.revision>revision);
    // A failed Undo is withdrawn too.
    app.backend.fault=null;await app.controller.quick('merge');await app.controller.quick('remove',2);const focus=app.store.focus;
    app.backend.fault=(step,name)=>{if(name==='head'&&step==='stage')throw new Error('synthetic write failure');};
    await app.controller.undo();assert.equal(app.controller.state.error,STORAGE_WRITE_FAILED);assert.equal(app.store.focus,focus);
    app.backend.fault=null;
    const next=await launch(root,keychain);assert.equal(next.outcome.kind,'restored');assert.equal(next.store.focus,focus);
    assert.notDeepEqual(good,await tree(root));
  }finally{await rm(root,{recursive:true,force:true});}
});

test('SHR-39 interrupted writes restore the previous complete generation and orphans are collected later',async()=>{
  for(const crash of [{step:'rename',name:'blobs/'},{step:'stage',name:'head'},{step:'rename',name:'manifests/'},{step:'stage',name:'blobs/'}] as const){
    const root=await scratch(),keychain=newKeychain();
    try{
      const app=await launch(root,keychain);
      await app.controller.import(await Promise.all(['brief.pdf','appendix.pdf'].map(async n=>new File([await fixture(n)],n))));
      const originals=app.store.originals;
      app.backend.fault=(step,name)=>{if(step===crash.step&&name.startsWith(crash.name))throw new Error('synthetic power loss');};
      await app.controller.quick('merge');assert.equal(app.controller.state.error,STORAGE_WRITE_FAILED);
      const next=await launch(root,keychain);
      assert.equal(next.outcome.kind,'restored',`${crash.step} ${crash.name}`);assert.deepEqual(next.store.originals,originals);assert.equal(next.store.focus,null);
      await next.controller.quick('merge');assert.equal(next.controller.state.error,null);
      const kept=(await next.backend.list('blobs')).sort(),refs=next.store.list.map(a=>names.blob(a.ref)).sort();
      assert.deepEqual(kept,refs,'unreferenced blobs from the interrupted attempt are collected');
      assert.equal((await next.backend.list('manifests')).length,2,'current and previous generation are kept');
      assert.deepEqual(await readdir(join(root,'staging')).catch(()=>[]),[]);
    }finally{await rm(root,{recursive:true,force:true});}
  }
});

test('SHR-39 corrupt or truncated manifest falls back only to the preceding same-epoch generation',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await populated(root,keychain);const previousDraft=app.chat.draft;
    app.chat.draft='compress it';await app.vault.save(app.snapshot);
    await corrupt(join(root,names.manifest(app.vault.generation)),bytes=>bytes.slice(0,bytes.length>>1));
    const next=await launch(root,keychain);
    assert.equal(next.outcome.kind,'restored');assert.equal((next.outcome as {recoveredPrevious:boolean}).recoveredPrevious,true);
    assert.equal(next.chat.draft,previousDraft);assert.equal(next.store.focus,app.removed);
    // Both generations damaged: fail closed, touch nothing.
    await corrupt(join(root,names.manifest(app.vault.generation-1)),bytes=>{bytes[bytes.length-1]^=1;return bytes;});
    const before=await tree(root),blocked=await launch(root,keychain);
    assert.deepEqual(blocked.outcome,{kind:'blocked',reason:'corrupt',retryable:false});
    assert.equal(blocked.store.list.length,0);assert.equal(blocked.vault.mode,'blocked');assert.deepEqual(await tree(root),before);
    await assert.rejects(blocked.vault.save(blocked.snapshot));assert.deepEqual(await tree(root),before);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('SHR-39 missing or corrupt artifacts never produce a partial workspace',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await populated(root,keychain);
    // A blob referenced by both kept generations: nothing valid remains.
    const original=names.blob(app.store.originals[0]);await unlink(join(root,original));
    const before=await tree(root),missing=await launch(root,keychain);
    assert.deepEqual(missing.outcome,{kind:'blocked',reason:'missing-artifact',retryable:false});assert.equal(missing.store.list.length,0);assert.deepEqual(await tree(root),before);
  }finally{await rm(root,{recursive:true,force:true});}
  const again=await scratch(),keychain2=newKeychain();
  try{
    const app=await populated(again,keychain2);
    await corrupt(join(again,names.blob(app.store.originals[1])),bytes=>{bytes[40]^=0xff;return bytes;});
    const damaged=await launch(again,keychain2);
    assert.deepEqual(damaged.outcome,{kind:'blocked',reason:'missing-artifact',retryable:false});assert.equal(damaged.store.list.length,0);
  }finally{await rm(again,{recursive:true,force:true});}
});

test('SHR-39 a validly sealed blob whose bytes differ from the manifest hash is refused',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await populated(root,keychain);const {checkpoint}=await decrypted(root,keychain),target=checkpoint.artifacts[0];
    const other=await fixture('appendix.pdf');assert.notEqual(await hash(other),target.sha256);
    await app.backend.writeSealed(names.blob(target.ref),other,aad.blob(checkpoint.workspaceID,target.ref,target.blobGeneration));
    const next=await launch(root,keychain);assert.deepEqual(next.outcome,{kind:'blocked',reason:'missing-artifact',retryable:false});assert.equal(next.store.list.length,0);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('SHR-39 a blob moved to another reference or generation fails authentication',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await populated(root,keychain);const [a,b]=app.store.originals;
    await writeFile(join(root,names.blob(b)),await readFile(join(root,names.blob(a))));
    const next=await launch(root,keychain);assert.deepEqual(next.outcome,{kind:'blocked',reason:'missing-artifact',retryable:false});
  }finally{await rm(root,{recursive:true,force:true});}
});

test('SHR-39 future schema is rejected without fallback or downgrade writes',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await populated(root,keychain);
    const {checkpoint}=await decrypted(root,keychain),generation=app.vault.generation+1;
    const future={...checkpoint,schemaVersion:2,generation};
    await app.backend.writeSealed(names.manifest(generation),new TextEncoder().encode(JSON.stringify(future)),aad.manifest(checkpoint.workspaceID,generation));
    await app.backend.writeSealed(names.head,new TextEncoder().encode(JSON.stringify({format:WORKSPACE_FORMAT,schemaVersion:2,workspaceID:checkpoint.workspaceID,generation,previousGeneration:app.vault.generation,deletionEpoch:0})),aad.head());
    const before=await tree(root),next=await launch(root,keychain);
    assert.deepEqual(next.outcome,{kind:'blocked',reason:'unsupported-schema',retryable:false});assert.deepEqual(await tree(root),before);
    // A current-format head over a future manifest is refused the same way.
    await app.backend.writeSealed(names.head,new TextEncoder().encode(JSON.stringify({format:WORKSPACE_FORMAT,schemaVersion:1,workspaceID:checkpoint.workspaceID,generation,previousGeneration:app.vault.generation,deletionEpoch:0})),aad.head());
    assert.deepEqual((await launch(root,keychain)).outcome,{kind:'blocked',reason:'unsupported-schema',retryable:false});
    // Unknown fields are not silently ignored.
    assert.throws(()=>parseCheckpoint({...checkpoint,pendingRequest:{}}),/unexpected field/);
    assert.throws(()=>parseCheckpoint({...checkpoint,retention:{mode:'quit'}}),/ephemeral/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('SHR-39 locked, missing, wrong or unavailable keychain keys fail safely without replacing the workspace',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await populated(root,keychain);const before=await tree(root),key=keychain.raw!;
    keychain.state='locked';
    assert.deepEqual((await launch(root,keychain)).outcome,{kind:'blocked',reason:'key-locked',retryable:true});
    keychain.state='ok';const unlocked=await launch(root,keychain);assert.equal(unlocked.outcome.kind,'restored');assert.equal(unlocked.store.focus,app.removed);
    keychain.state='unavailable';assert.deepEqual((await launch(root,keychain)).outcome,{kind:'blocked',reason:'key-unavailable',retryable:true});
    keychain.state='ok';keychain.raw=null;
    const lost=await launch(root,keychain);assert.deepEqual(lost.outcome,{kind:'blocked',reason:'key-missing',retryable:false});
    assert.equal(keychain.raw,null,'no replacement key is created over an existing workspace');
    keychain.raw=crypto.getRandomValues(new Uint8Array(32));
    assert.deepEqual((await launch(root,keychain)).outcome,{kind:'blocked',reason:'corrupt',retryable:false});
    assert.deepEqual(await tree(root),before,'encrypted state is left intact');
    keychain.raw=key;assert.equal((await launch(root,keychain)).outcome.kind,'restored');
  }finally{await rm(root,{recursive:true,force:true});}
  const fresh=await scratch(),unavailable=newKeychain();unavailable.state='unavailable';
  try{
    const app=await launch(fresh,unavailable);assert.deepEqual(app.outcome,{kind:'unavailable'});assert.equal(app.vault.mode,'unavailable');
    // Session-only: existing in-memory behavior, nothing written.
    await app.controller.import([new File([await fixture('brief.pdf')],'brief.pdf')]);assert.equal(app.controller.state.error,null);assert.deepEqual(await tree(fresh),{});
  }finally{await rm(fresh,{recursive:true,force:true});}
});

test('SHR-39 clearing publishes a new deletion epoch before collection and never falls back across it',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await populated(root,keychain);app.chat.conversation=[];app.chat.draft=null;
    await app.controller.clear();assert.equal(app.controller.state.error,null);assert.equal(app.vault.deletionEpoch,1);
    assert.deepEqual(await app.backend.list('blobs'),[]);assert.equal((await app.backend.list('manifests')).length,1);
    const cleared=await launch(root,keychain);assert.equal(cleared.outcome.kind,'restored');assert.equal(cleared.store.list.length,0);assert.deepEqual(cleared.chat.conversation,[]);
    await cleared.controller.import([new File([await fixture('brief.pdf')],'brief.pdf')]);
    // Damage the only post-clear checkpoint: there is no older same-epoch state.
    await corrupt(join(root,names.manifest(cleared.vault.generation)),bytes=>bytes.slice(0,10));
    const next=await launch(root,keychain);assert.equal(next.outcome.kind,'restored');assert.equal(next.store.list.length,0,'recovers the empty same-epoch generation, never pre-clear state');
    await corrupt(join(root,names.manifest(cleared.vault.generation-1)),bytes=>bytes.slice(0,10));
    assert.deepEqual((await launch(root,keychain)).outcome,{kind:'blocked',reason:'corrupt',retryable:false});
  }finally{await rm(root,{recursive:true,force:true});}
});

test('SHR-39 imported blobs are immutable and only two generations are retained',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await launch(root,keychain);
    await app.controller.import(await Promise.all(['brief.pdf','appendix.pdf'].map(async n=>new File([await fixture(n)],n))));
    const blobs=Object.fromEntries(Object.entries(await tree(root)).filter(([path])=>path.startsWith('blobs')));
    for(const text of ['one','two','three'])await app.say({role:'user',text});
    await app.controller.quick('merge');
    const after=await tree(root);for(const [path,digest] of Object.entries(blobs))assert.equal(after[path],digest,`${path} was rewritten`);
    assert.deepEqual((await app.backend.list('manifests')).sort(),[names.manifest(app.vault.generation-1),names.manifest(app.vault.generation)].sort());
  }finally{await rm(root,{recursive:true,force:true});}
});

test('SHR-39 stored data without a head fails closed and is preserved',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    await populated(root,keychain);await unlink(join(root,names.head));
    const before=await tree(root),next=await launch(root,keychain);
    assert.deepEqual(next.outcome,{kind:'blocked',reason:'corrupt',retryable:false});assert.deepEqual(await tree(root),before);
  }finally{await rm(root,{recursive:true,force:true});}
});

// ---- Review P1 regressions (PR #81) ----------------------------------------
const refsOf=(store:LocalFileStore)=>store.list.map(a=>a.ref).sort();
async function headOnDisk(root:string,keychain:TestKeychain){
  const result=await new NodeVaultBackend(root,keychain).readOpened(names.head,aad.head());
  return result.status==='ok'?JSON.parse(new TextDecoder().decode(result.bytes)) as {generation:number;previousGeneration:number|null;deletionEpoch:number;workspaceID:string}:null;
}

test('SHR-39 P1-1 a failure after head replacement is reconciled; "not kept" is only said when relaunch cannot restore the change',async()=>{
  const cases=[
    {name:'head restored',failHeadRestore:false,failRemoval:false,expected:STORAGE_WRITE_FAILED},
    {name:'head restore fails, manifest withdrawn',failHeadRestore:true,failRemoval:false,expected:STORAGE_WRITE_FAILED},
    {name:'manifest removal fails, head restored',failHeadRestore:false,failRemoval:true,expected:STORAGE_WRITE_FAILED},
    {name:'every reversal fails',failHeadRestore:true,failRemoval:true,expected:STORAGE_UNCONFIRMED},
  ];
  for(const c of cases){
    const root=await scratch(),keychain=newKeychain();
    try{
      const app=await populated(root,keychain);const before=refsOf(app.store),focus=app.store.focus,revision=app.store.revision;
      let headWrites=0;
      app.backend.fault=(step,name)=>{
        // The head is atomically replaced, then its directory sync fails.
        if(name==='head'&&step==='rename'&&++headWrites===1)throw new Error('synthetic sync failure after head replacement');
        if(name==='head'&&step==='stage'&&headWrites>=1&&c.failHeadRestore)throw new Error('synthetic reversal failure');
        if(step==='remove'&&name.startsWith('manifests/')&&c.failRemoval)throw new Error('synthetic removal failure');
      };
      await app.controller.quick('merge');
      const message=app.controller.state.error;
      assert.equal(message,c.expected,c.name);
      // The visible workspace is withdrawn either way; the revision still moves on.
      assert.deepEqual(refsOf(app.store),before,c.name);assert.equal(app.store.focus,focus,c.name);assert.ok(app.store.revision>revision);
      app.backend.fault=null;
      const next=await launch(root,keychain);assert.equal(next.outcome.kind,'restored',c.name);
      const restoredChange=refsOf(next.store).length!==before.length||next.store.focus!==focus;
      if(message===STORAGE_WRITE_FAILED){
        assert.equal(restoredChange,false,`${c.name}: a change reported as not kept must never be restored`);
        assert.equal(app.vault.mode,'writable',c.name);
        // Saving continues, and never reuses the generation a head may have named.
        const generation=app.vault.generation;await app.say({role:'user',text:'continue'});assert.equal(app.vault.generation,generation+1);
      }else{
        assert.match(message!,/may reappear/);assert.doesNotMatch(message!,/wasn’t kept/);
        assert.equal(app.vault.mode,'blocked');await assert.rejects(app.vault.save(app.snapshot));
      }
    }finally{await rm(root,{recursive:true,force:true});}
  }
});

test('SHR-39 P1-1 a head write that fails before replacement is definitely unpublished; sync failures on blobs and manifests are failures',async()=>{
  for(const fault of [{step:'stage',name:'head'},{step:'rename',name:'manifests/'},{step:'rename',name:'blobs/'}] as const){
    const root=await scratch(),keychain=newKeychain();
    try{
      const app=await populated(root,keychain);const before=refsOf(app.store),head=await headOnDisk(root,keychain);
      app.backend.fault=(step,name)=>{if(step===fault.step&&name.startsWith(fault.name))throw new Error('synthetic failure');};
      await app.controller.quick('merge');
      assert.equal(app.controller.state.error,STORAGE_WRITE_FAILED);assert.equal(app.vault.mode,'writable');
      assert.deepEqual(await headOnDisk(root,keychain),head,'the acknowledged head is untouched');
      app.backend.fault=null;const next=await launch(root,keychain);assert.deepEqual(refsOf(next.store),before);
    }finally{await rm(root,{recursive:true,force:true});}
  }
});

test('SHR-39 P1-1 the first save after genesis cannot be withdrawn by manifest removal alone',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await launch(root,keychain);assert.equal(app.outcome.kind,'empty');
    let headWrites=0;
    app.backend.fault=(step,name)=>{if(name==='head'&&step==='rename'&&++headWrites===1)throw new Error('sync failure');if(name==='head'&&step==='stage'&&headWrites>=1)throw new Error('reversal failure');};
    await app.controller.import([new File([await fixture('brief.pdf')],'brief.pdf')]);
    assert.equal(app.controller.state.error,STORAGE_UNCONFIRMED);assert.equal(app.store.list.length,0);assert.equal(app.vault.mode,'blocked');
    // The change was withdrawn from disk too, so relaunch fails closed rather than restoring it.
    app.backend.fault=null;const next=await launch(root,keychain);assert.notEqual(next.outcome.kind,'restored');assert.equal(next.store.list.length,0);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('SHR-39 P1-2 a committed generation-1 workspace whose head is lost is preserved and blocked, never opened empty',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await launch(root,keychain);
    await app.controller.import([new File([await fixture('brief.pdf')],'brief.pdf')]);assert.equal(app.controller.state.error,null);
    assert.equal(app.vault.generation,1);assert.deepEqual(await app.backend.list('manifests'),[names.manifest(1)]);
    await unlink(join(root,names.head));
    const before=await tree(root),next=await launch(root,keychain);
    assert.deepEqual(next.outcome,{kind:'blocked',reason:'corrupt',retryable:false});
    assert.equal(next.store.list.length,0);assert.equal(next.vault.mode,'blocked');
    assert.deepEqual(await tree(root),before,'the generation-1 manifest and its PDF are kept byte for byte');
    assert.ok(before[names.manifest(1)]);
    await assert.rejects(next.vault.save(next.snapshot));await assert.rejects(next.vault.clear());assert.deepEqual(await tree(root),before);
    // Blobs alone without a head are preserved too.
    await unlink(join(root,names.manifest(1)));const blobsOnly=await tree(root);
    assert.equal((await launch(root,keychain)).outcome.kind,'blocked');assert.deepEqual(await tree(root),blobsOnly);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('SHR-39 P1-2 the genesis head is the evidence that an interrupted first save was never committed',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await launch(root,keychain);const genesis=await headOnDisk(root,keychain);
    assert.equal(genesis?.generation,0);assert.equal(genesis?.previousGeneration,null);assert.deepEqual(await app.backend.list('manifests'),[]);
    app.backend.fault=(step,name)=>{if(name==='head'&&step==='stage')throw new Error('power loss before the first head');};
    await app.controller.import([new File([await fixture('brief.pdf')],'brief.pdf')]);assert.equal(app.controller.state.error,STORAGE_WRITE_FAILED);
    assert.deepEqual(await app.backend.list('manifests'),[names.manifest(1)],'the uncommitted manifest is left on disk');
    const next=await launch(root,keychain);
    assert.equal(next.outcome.kind,'empty');assert.equal((await headOnDisk(root,keychain))?.workspaceID,genesis?.workspaceID);
    // The orphan is only collected once a real first checkpoint is published.
    await next.controller.import([new File([await fixture('appendix.pdf')],'appendix.pdf')]);assert.equal(next.controller.state.error,null);
    assert.deepEqual(await next.backend.list('blobs'),next.store.list.map(a=>names.blob(a.ref)));
  }finally{await rm(root,{recursive:true,force:true});}
});

test('SHR-39 P1-3 Start over empties the workspace only after the durable clear is verified',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await populated(root,keychain);const visible:number[]=[];
    app.backend.fault=(step,name)=>{if(name==='head'&&step==='stage')visible.push(app.store.list.length);};
    await app.controller.clear();app.backend.fault=null;
    assert.equal(app.controller.state.error,null);assert.ok(visible.length&&visible.every(n=>n>0),'files stay shown while the clear is written');
    assert.equal(app.store.list.length,0);assert.equal(app.vault.deletionEpoch,1);assert.deepEqual(await app.backend.list('blobs'),[]);
    const next=await launch(root,keychain);assert.equal(next.outcome.kind,'restored');assert.equal(next.store.list.length,0);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('SHR-39 P1-3 a failed or unconfirmed Start over keeps the workspace shown and never reports a clear that relaunch undoes',async()=>{
  const cases=[
    {name:'manifest write fails before publication',fault:(step:string,name:string)=>{if(name.startsWith('manifests/')&&step==='stage')throw new Error('x');},expected:CLEAR_FAILED,relaunchEmpty:false},
    {name:'head write fails before replacement',fault:(step:string,name:string)=>{if(name==='head'&&step==='stage')throw new Error('x');},expected:CLEAR_FAILED,relaunchEmpty:false},
    {name:'head replaced, sync fails, roll-forward succeeds',fault:(()=>{let n=0;return (step:string,name:string)=>{if(name==='head'&&step==='rename'&&++n===1)throw new Error('x');};})(),expected:null,relaunchEmpty:true},
    {name:'head replaced, sync and roll-forward fail',fault:(step:string,name:string)=>{if(name==='head'&&step==='rename')throw new Error('x');},expected:CLEAR_UNCONFIRMED,relaunchEmpty:true},
  ];
  for(const c of cases){
    const root=await scratch(),keychain=newKeychain();
    try{
      const app=await populated(root,keychain);const before=refsOf(app.store),focus=app.store.focus;
      app.backend.fault=c.fault;await app.controller.clear();app.backend.fault=null;
      assert.equal(app.controller.state.error,c.expected,c.name);
      if(c.expected===null){assert.equal(app.store.list.length,0,c.name);}
      else{
        // Nothing is presented as deleted: the previous workspace is still shown.
        assert.deepEqual(refsOf(app.store),before,c.name);assert.equal(app.store.focus,focus,c.name);
        assert.equal(app.vault.mode,c.expected===CLEAR_UNCONFIRMED?'blocked':'writable',c.name);
      }
      const next=await launch(root,keychain);assert.equal(next.outcome.kind,'restored',c.name);
      if(c.relaunchEmpty)assert.equal(next.store.list.length,0,`${c.name}: never pre-clear state once the new epoch head landed`);
      else{assert.deepEqual(refsOf(next.store),before,c.name);assert.equal(next.store.focus,focus,c.name);}
      if(c.expected===CLEAR_FAILED)assert.doesNotMatch(c.expected,/cleared here/);
    }finally{await rm(root,{recursive:true,force:true});}
  }
});

test('SHR-39 P1-3 no fallback across a deletion epoch after Start over',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await populated(root,keychain);await app.controller.clear();assert.equal(app.controller.state.error,null);
    app.chat.conversation=[];app.chat.draft=null;await app.say({role:'user',text:'new epoch'});
    for(const generation of [app.vault.generation,app.vault.generation-1])await corrupt(join(root,names.manifest(generation)),bytes=>bytes.slice(0,8));
    const next=await launch(root,keychain);
    assert.deepEqual(next.outcome,{kind:'blocked',reason:'corrupt',retryable:false});assert.equal(next.store.list.length,0);
    assert.deepEqual(await next.backend.list('blobs'),[],'pre-clear PDFs were collected after the new epoch was published');
  }finally{await rm(root,{recursive:true,force:true});}
});

// ---- Second review P1 regressions (PR #81) ---------------------------------
const cleanupModule=import('../../packages/core/src/workspace-vault');
// A workspace whose chat and draft reference no PDF, so an old-epoch snapshot is
// valid on its own after a clear (the reviewer's reproduction).
async function chattyWorkspace(root:string,keychain:TestKeychain){
  const app=await launch(root,keychain);
  await app.controller.import([new File([await fixture('brief.pdf')],'brief.pdf')]);assert.equal(app.controller.state.error,null);
  await app.say({role:'user',text:'old chat that Start over must remove'});
  app.chat.draft='old draft that Start over must remove';await app.vault.save(app.snapshot);
  return app;
}

test('SHR-39 P1-4 a chat or draft save queued behind Start over cannot resurrect old text',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await chattyWorkspace(root,keychain);
    // Start over begins; a draft timer or chat effect queues a save behind it.
    const clearing=app.controller.clear();const queued=app.vault.save(app.snapshot);
    await clearing;
    assert.equal(app.controller.state.error,null);assert.equal(app.store.list.length,0);
    const outcome=await queued.then(()=>'saved',(error:Error)=>error.name);
    // The App empties its chat and draft once the clear is confirmed.
    app.chat.conversation=[];app.chat.draft=null;
    assert.equal(outcome,'StaleSaveError','a save from the pre-clear epoch must not publish');
    const next=await launch(root,keychain);
    assert.equal(next.outcome.kind,'restored');assert.deepEqual(next.chat.conversation,[]);assert.equal(next.chat.draft,null);
    const {raw}=await decrypted(root,keychain);assert.ok(!raw.includes('must remove'),'no old chat or draft in the published manifest');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('SHR-39 P1-5 Start over does not claim removal until old PDF copies are verified gone, and retries cleanup',async()=>{
  const {CLEANUP_INCOMPLETE}=await cleanupModule as unknown as {CLEANUP_INCOMPLETE:string};
  for(const mode of ['throw','skip'] as const){
    const root=await scratch(),keychain=newKeychain();
    try{
      const app=await populated(root,keychain);const oldBlobs=(await app.backend.list('blobs')).sort();assert.ok(oldBlobs.length);
      app.backend.fault=(step,name)=>{if(step==='remove'&&name.startsWith('blobs/')){if(mode==='skip')return 'skip';throw new Error('synthetic removal failure');}};
      await app.controller.clear();
      // The clear itself is durable (new epoch), so the workspace is empty, but the
      // result is reported truthfully as incomplete, never as a clean removal.
      assert.equal(app.controller.state.error,null,mode);assert.equal(app.store.list.length,0,mode);
      assert.equal(app.controller.state.message,CLEANUP_INCOMPLETE,mode);
      assert.equal((app.vault as unknown as {cleanupPending:boolean}).cleanupPending,true,mode);
      assert.deepEqual((await app.backend.list('blobs')).sort(),oldBlobs,`${mode}: the copies really are still there`);
      // Relaunch while cleanup is still failing: empty workspace, never old data, cleanup still reported.
      const stuck=await launch(root,keychain,app.backend.fault);
      assert.equal(stuck.outcome.kind,'restored');assert.equal(stuck.store.list.length,0);assert.deepEqual(stuck.chat.conversation,[]);
      assert.equal((stuck.outcome as {cleanupPending?:boolean}).cleanupPending,true,`${mode}: launch-time cleanup failure is reported`);
      assert.deepEqual((await app.backend.list('blobs')).sort(),oldBlobs,`${mode}: launch did not claim or fake removal`);
      // A later retry in the same session succeeds once removal works.
      app.backend.fault=null;app.chat.conversation=[];app.chat.draft=null;
      await app.say({role:'user',text:'after clear'});
      assert.equal((app.vault as unknown as {cleanupPending:boolean}).cleanupPending,false,mode);
      assert.deepEqual(await app.backend.list('blobs'),[],`${mode}: retry removed the old copies`);
    }finally{await rm(root,{recursive:true,force:true});}
  }
});

test('SHR-39 P1-5 an incomplete cleanup is retried and verified at the next launch',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await populated(root,keychain);
    app.backend.fault=(step,name)=>{if(step==='remove'&&name.startsWith('blobs/'))throw new Error('synthetic removal failure');};
    await app.controller.clear();assert.ok((await app.backend.list('blobs')).length);
    // Relaunch with removal still failing: reported, not hidden.
    const failing=new NodeVaultBackend(root,keychain);failing.fault=app.backend.fault;
    const blockedVault=new WorkspaceVault(failing,{redact:safeOrdinaryText});const stillPending=await blockedVault.open();
    assert.equal(stillPending.kind,'restored');assert.equal((stillPending as {cleanupPending?:boolean}).cleanupPending,true);
    // Relaunch with removal working: cleaned and verified during open.
    const next=await launch(root,keychain);
    assert.equal((next.outcome as {cleanupPending?:boolean}).cleanupPending,false);
    assert.deepEqual(await next.backend.list('blobs'),[]);assert.equal((next.vault as unknown as {cleanupPending:boolean}).cleanupPending,false);
  }finally{await rm(root,{recursive:true,force:true});}
});

const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
test('SHR-39 P1-4 Start over suspends chat and draft checkpoints and resets the view before they resume',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await chattyWorkspace(root,keychain);const errors:unknown[]=[];let saves=0;
    const scheduler=new CheckpointScheduler(async()=>{saves++;await app.vault.save(app.snapshot);},error=>errors.push(error),20);
    // A draft edit just before Start over leaves a pending draft checkpoint.
    app.chat.draft='typed just before Start over';scheduler.draft();assert.equal(scheduler.draftPending,true);
    const error=await scheduler.exclusive(async()=>{
      assert.equal(scheduler.draftPending,false,'the pending draft checkpoint is cancelled');
      // Chat effects and draft edits while the clear is running are not scheduled.
      app.chat.conversation=[...app.chat.conversation,{id:99,role:'assistant',text:'late message from before the clear'}];scheduler.now();scheduler.draft();
      assert.equal(scheduler.draftPending,false);
      await app.controller.clear();
      if(app.controller.state.error)return app.controller.state.error;
      app.chat.conversation=[];app.chat.draft=null; // the view is reset before checkpoints resume
      return null;
    });
    assert.equal(error,null);await pause(60);assert.equal(saves,0,'nothing was checkpointed during Start over');
    // New activity after the clear is saved in the new epoch only.
    app.chat.conversation=[{id:1,role:'user',text:'fresh start'}];scheduler.now();await pause(60);
    assert.equal(saves,1);assert.deepEqual(errors,[]);
    const next=await launch(root,keychain);
    assert.deepEqual(next.chat.conversation.map(e=>e.text),['fresh start']);assert.equal(next.chat.draft,null);assert.equal(next.store.list.length,0);
    const {raw}=await decrypted(root,keychain);
    for(const old of ['must remove','typed just before','late message'])assert.ok(!raw.includes(old),`no "${old}" after Start over`);
    scheduler.dispose();
  }finally{await rm(root,{recursive:true,force:true});}
});

test('SHR-39 P1-4 a failed Start over resumes checkpointing in the unchanged workspace',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await chattyWorkspace(root,keychain);const errors:unknown[]=[];
    const scheduler=new CheckpointScheduler(()=>app.vault.save(app.snapshot),error=>errors.push(error),20);
    app.backend.fault=(step,name)=>{if(name.startsWith('manifests/')&&step==='stage')throw new Error('synthetic failure');};
    const error=await scheduler.exclusive(async()=>{await app.controller.clear();return app.controller.state.error;});
    app.backend.fault=null;
    assert.equal(error,CLEAR_FAILED);assert.equal(scheduler.suspended,false);assert.equal(app.store.list.length,1);
    app.chat.conversation=[...app.chat.conversation,{id:50,role:'assistant',text:CLEAR_FAILED}];scheduler.now();await pause(60);
    assert.deepEqual(errors,[]);
    const next=await launch(root,keychain);assert.equal(next.store.list.length,1);assert.ok(next.chat.conversation.some(e=>e.text===CLEAR_FAILED));
    scheduler.dispose();
  }finally{await rm(root,{recursive:true,force:true});}
});

// ---- Third review P1 regressions (PR #81) ----------------------------------
const cleanupState=(vault:WorkspaceVault)=>(vault as unknown as {cleanupPending:boolean}).cleanupPending;
async function cleanupConstants(){return await cleanupModule as unknown as {CLEANUP_INCOMPLETE:string};}

test('SHR-39 P1-6 a failed blob or manifest listing never reports cleanup as complete',async()=>{
  const {CLEANUP_INCOMPLETE}=await cleanupConstants();
  for(const directory of ['blobs','manifests'] as const){
    const root=await scratch(),keychain=newKeychain();
    try{
      const app=await populated(root,keychain);const before=await tree(root);
      app.backend.fault=(step,name)=>{if(step==='list'&&name===directory)throw Object.assign(new Error('synthetic EIO'),{code:'EIO'});};
      await app.controller.clear();
      assert.equal(app.controller.state.error,null,directory);assert.equal(app.store.list.length,0,directory);
      assert.equal(app.controller.state.message,CLEANUP_INCOMPLETE,`${directory}: an unknown listing is not proof of removal`);
      assert.equal(cleanupState(app.vault),true,directory);
      app.backend.fault=null;
      const remaining=Object.keys(before).filter(path=>path.startsWith(`${directory}/`)&&path!==names.manifest(app.vault.generation));
      assert.ok(remaining.length,directory);
      // Once listing works again, a retry removes and verifies.
      app.chat.conversation=[];app.chat.draft=null;await app.say({role:'user',text:'after clear'});
      assert.equal(cleanupState(app.vault),false,directory);assert.deepEqual(await app.backend.list('blobs'),[]);
    }finally{await rm(root,{recursive:true,force:true});}
  }
});

test('SHR-39 P1-6 an unlink whose directory sync fails keeps cleanup pending until a later sync confirms it',async()=>{
  const {CLEANUP_INCOMPLETE}=await cleanupConstants();
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await populated(root,keychain);
    app.backend.fault=(step,name)=>{if(step==='remove-sync'&&name.startsWith('blobs/'))throw new Error('synthetic directory fsync failure');};
    await app.controller.clear();
    // The files are gone from the listing, but their removal is not durable yet.
    assert.deepEqual(await app.backend.list('blobs'),[]);
    assert.equal(app.controller.state.message,CLEANUP_INCOMPLETE);assert.equal(cleanupState(app.vault),true);
    // A later checkpoint retries; the directory sync now succeeds and confirms it.
    app.backend.fault=null;app.chat.conversation=[];app.chat.draft=null;await app.say({role:'user',text:'after clear'});
    assert.equal(cleanupState(app.vault),false);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('SHR-39 P1-7 a manifest listing failure with a missing head blocks a committed text-only workspace',async()=>{
  const root=await scratch(),keychain=newKeychain();
  try{
    const app=await launch(root,keychain);
    await app.say({role:'user',text:'committed text-only workspace'});app.chat.draft='committed draft';await app.vault.save(app.snapshot);
    assert.deepEqual(await app.backend.list('blobs'),[],'no PDF blobs at all');
    await unlink(join(root,names.head));const before=await tree(root);assert.ok(Object.keys(before).some(path=>path.startsWith('manifests/')));
    const listingFails:Fault=(step,name)=>{if(step==='list'&&name==='manifests')throw Object.assign(new Error('synthetic EACCES'),{code:'EACCES'});};
    const next=await launch(root,keychain,listingFails);
    assert.equal(next.outcome.kind,'blocked','never inferred empty from a failed listing');
    assert.equal((next.outcome as {retryable?:boolean}).retryable,true);assert.equal(next.vault.mode,'blocked');
    assert.deepEqual(await tree(root),before,'the committed manifest is untouched and no genesis head was written');
    await assert.rejects(next.vault.save(next.snapshot));assert.deepEqual(await tree(root),before);
    // With listing working, the lost head is still detected and the data preserved.
    const again=await launch(root,keychain);assert.deepEqual(again.outcome,{kind:'blocked',reason:'corrupt',retryable:false});assert.deepEqual(await tree(root),before);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('SHR-39 P1-7 head existence and read failures fail closed instead of looking like a missing head',async()=>{
  for(const step of ['exists','read'] as const){
    const root=await scratch(),keychain=newKeychain();
    try{
      const app=await populated(root,keychain);const before=await tree(root);
      const next=await launch(root,keychain,(s,name)=>{if(s===step&&name==='head')throw Object.assign(new Error('synthetic EIO'),{code:'EIO'});});
      assert.equal(next.outcome.kind,'blocked',step);assert.equal((next.outcome as {retryable?:boolean}).retryable,true,step);
      assert.deepEqual(await tree(root),before,`${step}: nothing written or removed`);
      assert.equal((await launch(root,keychain)).store.focus,app.removed,`${step}: the workspace opens once storage is readable`);
    }finally{await rm(root,{recursive:true,force:true});}
  }
});
