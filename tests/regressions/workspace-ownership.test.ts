import test from 'node:test';
import assert from 'node:assert/strict';
import {JobController} from '../../packages/core/src/job-controller';
import {LocalFileStore} from '../../packages/core/src/local-file-store';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {NodeVaultBackend,newKeychain} from '../helpers/workspace-backend';
import {WorkspaceVault,type WorkspaceSnapshot} from '../../packages/core/src/workspace-vault';
import {WorkspaceSession,CheckpointScheduler} from '../../packages/core/src/workspace-checkpoints';
import {workspaceHook,deferred} from '../helpers/workspace-hook';
import {syntheticInspection} from '../helpers/synthetic-inspection';
const inspection=syntheticInspection(1);
const services={worker:async()=>({pages:1}),inspect:async()=>inspection,recognize:async()=>[]};
const file=(name='old.pdf',release=()=>{})=>({name,size:1,arrayBuffer:async()=>new Uint8Array([1]).buffer,release}) as unknown as File;
function reset(w:any){const id=w.append({role:'assistant',text:'clear',choice:'clear',revision:w.store.revision});w.setChoice(id);return id;}
async function clear(h:any){const id=reset(h.view);await h.flush();h.view.confirm(h.view.entries.find((e:any)=>e.id===id));await h.flush();for(let i=0;i<100&&h.view.busy;i++)await h.flush();}
async function result(store:LocalFileStore,ref:string,n=1){const artifact=await store.prepare(new Uint8Array([n]),'result.pdf',inspection,false,ref);store.commit([artifact],store.revision);return artifact.meta;}

for(const action of ['Cancel','Start Over'] as const)test(`delayed sample + ${action}: no import, chat or save after invalidation`,async()=>{
  const sample=deferred<File[]>(),controller=new JobController(new LocalFileStore(),services);let released=0;
  const h=await workspaceHook(controller,{sampleFiles:()=>sample.promise});
  try{const pending=h.view.pick(true);if(action==='Cancel')h.view.cancel();else await clear(h);const before=h.view.entries;sample.resolve([file('old.pdf',()=>released++)]);await pending;await h.flush();assert.equal(controller.store.list.length,0);assert.deepEqual(h.view.entries,before);assert.equal(released,1);}finally{h.dispose();}
});

test('old picker callback after a new import: newest selection remains authoritative',async()=>{
  const picker=deferred<File[]>(),controller=new JobController(new LocalFileStore(),services);let released=0;
  const h=await workspaceHook(controller,{chooseFiles:()=>picker.promise});
  try{const old=h.view.pick();await h.view.importFiles([file('new.pdf')]);picker.resolve([file('old.pdf',()=>released++)]);await old;await h.flush();assert.deepEqual(controller.store.list.map(f=>f.name),['new.pdf']);assert.equal(released,1);}finally{h.dispose();}
});

test('pending setup completion after reset cannot append chat or restore focus',async()=>{
  const status=deferred<unknown>(),controller=new JobController(new LocalFileStore(),services);
  const h=await workspaceHook(controller,{plannerStatus:()=>status.promise});
  try{const pending=h.view.connect();await clear(h);status.resolve({connected:false,enabled:false,remaining:0,token:'test'});await pending;await h.flush();assert.deepEqual(h.view.entries,[]);assert.equal(h.view.choice,null);assert.equal(h.view.connectionToken.current,null);}finally{h.dispose();}
});

for(const outcome of ['saved','shared','failure'])test(`pending export ${outcome} after reset: no stale receipt or error`,async()=>{
  const saving=deferred<string>(),controller=new JobController(new LocalFileStore(),services);const artifact=await result(controller.store,'out_old');let external:Uint8Array|undefined;
  const h=await workspaceHook(controller,{save:async bytes=>{external=bytes;return saving.promise;}});
  try{const pending=h.view.exportResult(artifact);await clear(h);if(outcome==='failure')saving.reject(new Error('old error'));else saving.resolve(outcome);await pending;await h.flush();assert.deepEqual(h.view.receipts,{});assert.deepEqual([...external!],[1]);assert.equal(controller.store.focus,null);}finally{h.dispose();}
});

test('repeated cancel while sample is pending is idempotent and silent on late rejection',async()=>{
  const sample=deferred<File[]>(),controller=new JobController(new LocalFileStore(),services);const h=await workspaceHook(controller,{sampleFiles:()=>sample.promise});
  try{const pending=h.view.pick(true);h.view.cancel();h.view.cancel();const before=h.view.entries;sample.reject(new Error('old failed fetch'));await pending;await h.flush();assert.deepEqual(h.view.entries,before);assert.equal(h.view.loading,false);}finally{h.dispose();}
});

test('old callback after Undo cannot alter the current result hash or append an import',async()=>{
  const picker=deferred<File[]>(),store=new LocalFileStore(),controller=new JobController(store,services);await result(store,'out_first',1);await result(store,'out_second',2);
  const h=await workspaceHook(controller,{chooseFiles:()=>picker.promise});
  try{const pending=h.view.pick();await h.flush();h.view.cancel();await h.flush();h.view.undo();await h.flush();const hash=store.get(store.focus!).meta.checksum,revision=store.revision;picker.resolve([file()]);await pending;await h.flush();assert.equal(store.focus,'out_first');assert.equal(store.get(store.focus!).meta.checksum,hash);assert.equal(store.revision,revision);assert.equal(store.originals.length,0);}finally{h.dispose();}
});


for(const transition of ['Cancel','Start Over','new import','Undo','generation change'] as const)test(`current result hash/state survive a stale sample after ${transition}`,async()=>{
  const sample=deferred<File[]>(),store=new LocalFileStore(),controller=new JobController(store,services);await result(store,'out_first',1);await result(store,'out_second',2);
  const h=await workspaceHook(controller,{sampleFiles:()=>sample.promise});
  try{
    const pending=h.view.pick(true);await h.flush();
    if(transition==='Cancel')h.view.cancel();
    else if(transition==='Start Over'){await clear(h);await result(store,'out_new',3);}
    else if(transition==='new import')await h.view.importFiles([file('new.pdf')]);
    else if(transition==='Undo'){h.view.cancel();await h.flush();h.view.undo();await h.flush();}
    else h.view.session.advance();
    const expected={focus:store.focus,revision:store.revision,history:store.history,files:store.list,hash:store.get(store.focus!).meta.checksum};
    sample.resolve([file()]);await pending;await h.flush();
    assert.deepEqual({focus:store.focus,revision:store.revision,history:store.history,files:store.list,hash:store.get(store.focus!).meta.checksum},expected);
  }finally{h.dispose();}
});

test('new picker owns loading: old finally cannot unlock the replacement',async()=>{
  const old=deferred<File[]>(),next=deferred<File[]>(),controller=new JobController(new LocalFileStore(),services);let calls=0;
  const h=await workspaceHook(controller,{chooseFiles:()=>++calls===1?old.promise:next.promise});
  try{const first=h.view.pick(),second=h.view.pick();old.resolve([file()]);await first;await h.flush();assert.equal(h.view.loading,true);assert.equal(controller.store.list.length,0);next.resolve([file('new.pdf')]);await second;await h.flush();assert.equal(h.view.loading,false);assert.deepEqual(controller.store.list.map(f=>f.name),['new.pdf']);}finally{h.dispose();}
});

test('invalidated partial import releases all temporary copies and leaves external original bytes unchanged',async()=>{
  const root=await mkdtemp(join(tmpdir(),'shr44-import-')),external=join(root,'original.pdf'),copy=join(root,'picker-copy.pdf');const bytes=new Uint8Array([1]);await writeFile(external,bytes);await writeFile(copy,bytes);
  const gate=deferred<unknown>(),entered=deferred<void>(),store=new LocalFileStore(),controller=new JobController(store,{...services,inspect:async()=>{entered.resolve();await gate.promise;return inspection;}});let released=0;
  const h=await workspaceHook(controller);
  try{
    const pending=h.view.importFiles([{name:'first.pdf',size:1,arrayBuffer:async()=>{return new Uint8Array(await readFile(copy)).buffer;},release:async()=>{released++;await rm(copy);}},file('unread.pdf',()=>released++)] as unknown as File[]);
    await entered.promise;h.view.cancel();gate.resolve(undefined);await pending;await h.flush();assert.equal(store.list.length,0);assert.equal(released,2);assert.deepEqual(new Uint8Array(await readFile(external)),bytes);await assert.rejects(readFile(copy));
  }finally{h.dispose();await rm(root,{recursive:true,force:true});}
});

test('generation advance aborts cooperative work and voids old tickets',()=>{
  const session=new WorkspaceSession(),current=session.ticket(),signal=session.signal;session.advance();session.advance();assert.equal(current(),false);assert.equal(signal.aborted,true);assert.equal(session.signal.aborted,false);assert.equal(session.ticket()(),true);
});

test('checkpoint scheduled before reset never runs in the new generation or reports an old error',async()=>{
  let saves=0,errors=0;const scheduler=new CheckpointScheduler(async()=>{saves++;throw new Error('old');},()=>errors++);
  scheduler.now();await scheduler.exclusive(async()=>{});await new Promise(done=>setTimeout(done,0));assert.equal(saves,0);assert.equal(errors,0);scheduler.dispose();
});

test('G6 receipt remains bound to its saved result after another result becomes current',async()=>{
  const saving=deferred<string>(),store=new LocalFileStore(),controller=new JobController(store,services);const artifact=await result(store,'out_first');const h=await workspaceHook(controller,{save:()=>saving.promise});
  try{const pending=h.view.exportResult(artifact);await result(store,'out_next',2);saving.resolve('saved');await pending;await h.flush();assert.equal(h.view.receipts[artifact.ref],'Saved to your device');assert.equal(store.focus,'out_next');}finally{h.dispose();}
});

test('non-cooperative engine completion cannot promote after Cancel; lock drains before replacement',async()=>{
  const gate=deferred<unknown>(),entered=deferred<void>(),store=new LocalFileStore();await result(store,'out_current');
  const controller=new JobController(store,{...services,worker:async request=>{if(request.kind==='inspect')return {pages:1};entered.resolve();await gate.promise;return {bytes:new Uint8Array([9]),note:''};}});
  // Two synthetic originals admit Merge; the current result remains immutable.
  for(const name of ['first.pdf','second.pdf']){const original=await store.prepare(new Uint8Array([1]),name,inspection,true);store.commit([original],store.revision);}
  const h=await workspaceHook(controller);
  try{h.view.action('merge','Merge');await entered.promise;const hash=store.get('out_current').meta.checksum;h.view.cancel();const cancelledEntries=h.view.entries;h.view.cancel();assert.deepEqual(h.view.entries,cancelledEntries);assert.equal(controller.state.busy,true);const importing=h.view.importFiles([file('new.pdf')]);await h.flush();assert.equal(store.originals.length,2);gate.resolve(undefined);await importing;await h.flush();assert.equal(store.focus,'out_current');assert.equal(store.get('out_current').meta.checksum,hash);assert.equal(controller.state.stage,'complete');assert.equal(store.originals.length,3);assert.equal(h.view.entries.some((e:any)=>e.resultTitle==='Merged PDF'),false);}finally{h.dispose();}
});

async function durableFixture(){
  const root=await mkdtemp(join(tmpdir(),'shr44-vault-')),keychain=newKeychain(),backend=new NodeVaultBackend(root,keychain),vault=new WorkspaceVault(backend,{redact:text=>text}),store=new LocalFileStore(),controller=new JobController(store,services);await vault.open();
  const snapshot=():WorkspaceSnapshot=>({...controller.durableState(true),bytes:ref=>store.get(ref).bytes,conversation:[],draft:null});
  controller.setDurability({save:signal=>vault.save(snapshot,()=>!signal?.aborted),clear:()=>vault.clear()});return {root,keychain,backend,vault,store,controller,snapshot};
}

test('pending durable import save + Cancel cannot persist a partial import on relaunch',async()=>{
  const f=await durableFixture(),gate=deferred<void>(),entered=deferred<void>();const write=f.backend.writeSealed.bind(f.backend);f.backend.writeSealed=async(name,bytes,aad)=>{if(name.startsWith('manifests/')){entered.resolve();await gate.promise;}await write(name,bytes,aad);};
  try{const pending=f.controller.import([file()]);await entered.promise;f.controller.cancel();gate.resolve();await pending;assert.equal(f.store.list.length,0);assert.equal(f.controller.state.stage,'cancelled');const reopened=await new WorkspaceVault(new NodeVaultBackend(f.root,f.keychain),{redact:text=>text}).open();assert.equal(reopened.kind,'empty');}finally{await rm(f.root,{recursive:true,force:true});}
});

test('Cancel during atomic head publication drains and durably withdraws the candidate',async()=>{
  const f=await durableFixture(),gate=deferred<void>(),entered=deferred<void>();const write=f.backend.writeSealed.bind(f.backend);let paused=false;
  f.backend.writeSealed=async(name,bytes,aad)=>{await write(name,bytes,aad);if(name==='head'&&!paused){paused=true;entered.resolve();await gate.promise;}};
  try{const pending=f.controller.import([file()]);await entered.promise;f.controller.cancel();assert.equal(f.controller.state.busy,true);gate.resolve();await pending;assert.equal(f.store.list.length,0);const reopened=await new WorkspaceVault(new NodeVaultBackend(f.root,f.keychain),{redact:text=>text}).open();assert.equal(reopened.kind,'restored');if(reopened.kind==='restored')assert.equal(reopened.checkpoint.artifacts.length,0);}finally{await rm(f.root,{recursive:true,force:true});}
});

test('pending workspace save completion after reset cannot restore old state on disk',async()=>{
  const f=await durableFixture();await f.controller.import([file()]);const gate=deferred<void>(),entered=deferred<void>(),write=f.backend.writeSealed.bind(f.backend);let paused=false;
  f.backend.writeSealed=async(name,bytes,aad)=>{if(name.startsWith('manifests/')&&!paused){paused=true;entered.resolve();await gate.promise;}await write(name,bytes,aad);};
  try{const saving=f.vault.save(f.snapshot);await entered.promise;const reset=f.controller.clear();gate.resolve();await saving;await reset;assert.equal(f.store.list.length,0);const reopened=await new WorkspaceVault(new NodeVaultBackend(f.root,f.keychain),{redact:text=>text}).open();assert.equal(reopened.kind,'restored');if(reopened.kind==='restored'){assert.equal(reopened.checkpoint.artifacts.length,0);assert.equal(reopened.checkpoint.history.length,0);}}finally{await rm(f.root,{recursive:true,force:true});}
});

test('S44-02 vault open is non-cancellable; subsequent save and Start Over remain durable',async()=>{
  const f=await durableFixture();await f.controller.import([file()]);const gate=deferred<void>(),entered=deferred<void>(),read=f.backend.readOpened.bind(f.backend);let paused=false;
  f.backend.readOpened=async(name,aad)=>{if(name==='head'&&!paused){paused=true;entered.resolve();await gate.promise;}return read(name,aad);};
  const fresh=new JobController(new LocalFileStore(),services),h=await workspaceHook(fresh,{backend:f.backend});
  try{await entered.promise;h.view.cancel();await h.flush();assert.equal(h.view.restoring,true);gate.resolve();for(let i=0;i<20&&h.view.restoring;i++)await h.flush();assert.equal(h.view.durable,true);await h.view.importFiles([file('new.pdf')]);await h.flush();assert.equal(fresh.store.list.length,2);await clear(h);const disk=await new WorkspaceVault(new NodeVaultBackend(f.root,f.keychain),{redact:t=>t}).open();assert.equal(disk.kind,'restored');if(disk.kind==='restored')assert.equal(disk.checkpoint.artifacts.length,0);}finally{h.dispose();await rm(f.root,{recursive:true,force:true});}
});

 test('S44-02 Cancel during controller restore shows a blocked-saving notice and never claims Start Over cleared disk',async()=>{
  const f=await durableFixture();await f.controller.import([file()]);const gate=deferred<void>(),entered=deferred<void>();
  const fresh=new JobController(new LocalFileStore(),{...services,inspect:async()=>{entered.resolve();await gate.promise;return inspection;}}),h=await workspaceHook(fresh,{backend:f.backend});
  try{await entered.promise;h.view.cancel();gate.resolve();await fresh.settle();await h.flush();assert.equal(h.view.durable,false);assert.match(h.view.notice.text,/New work in this session won’t be saved/);await h.view.importFiles([file('new.pdf')]);await h.flush();await clear(h);assert.ok(h.view.entries.some((e:any)=>/can’t clear the saved workspace/.test(e.text)));assert.equal(fresh.store.list.length,1);const disk=await new WorkspaceVault(new NodeVaultBackend(f.root,f.keychain),{redact:t=>t}).open();assert.equal(disk.kind,'restored');if(disk.kind==='restored')assert.deepEqual(disk.checkpoint.artifacts.map(a=>a.name),['old.pdf']);}finally{h.dispose();await rm(f.root,{recursive:true,force:true});}
});

 test('S44-05 failed withdrawal checkpoint reports uncertainty and the candidate can reappear',async()=>{
  const f=await durableFixture(),gate=deferred<void>(),entered=deferred<void>();let saves=0;
  f.controller.setDurability({save:async()=>{if(++saves===2)throw new Error('withdrawal failed');await f.vault.save(f.snapshot);entered.resolve();await gate.promise;},clear:()=>f.vault.clear()});
  try{const pending=f.controller.import([file('cancelled.pdf')]);await entered.promise;f.controller.cancel();gate.resolve();await pending;assert.equal(f.controller.state.stage,'failed');assert.match(f.controller.state.error!,/cancelled files may reappear after relaunch/);assert.equal(f.store.list.length,0);const disk=await new WorkspaceVault(new NodeVaultBackend(f.root,f.keychain),{redact:t=>t}).open();assert.equal(disk.kind,'restored');if(disk.kind==='restored')assert.deepEqual(disk.checkpoint.artifacts.map(a=>a.name),['cancelled.pdf']);}finally{await rm(f.root,{recursive:true,force:true});}
});

 test('G6 OS save lock survives Undo, import and reset until the sheet resolves',async()=>{
  const pendingSave=deferred<string>(),store=new LocalFileStore(),controller=new JobController(store,services);const artifact=await result(store,'out_first');let writes=0;
  const h=await workspaceHook(controller,{save:()=>{writes++;return pendingSave.promise;}});
  try{const pending=h.view.exportResult(artifact);await h.flush();await result(store,'out_second',2);h.view.undo();await h.flush();await h.view.importFiles([file('new.pdf')]);await h.flush();await h.view.exportResult(artifact);assert.equal(writes,1);await clear(h);const next=await result(store,'out_new',3);await h.view.exportResult(next);assert.equal(writes,1);assert.equal(h.view.saving,artifact.ref);pendingSave.resolve('saved');await pending;await h.flush();assert.deepEqual(h.view.receipts,{});assert.equal(h.view.saving,null);}finally{h.dispose();}
});
