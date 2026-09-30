import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {NodeVaultBackend,newKeychain} from '../helpers/workspace-backend';
import {WorkspaceVault,StaleSaveError,type WorkspaceSnapshot} from '../../packages/core/src/workspace-vault';
import {LocalFileStore} from '../../packages/core/src/local-file-store';
const inspection={pages:[{width:612,height:792,rotation:0,text:''}]};
async function fixture(){
  const root=await mkdtemp(join(tmpdir(),'rev-s44-')),keychain=newKeychain(),backend=new NodeVaultBackend(root,keychain),vault=new WorkspaceVault(backend,{redact:t=>t}),store=new LocalFileStore();
  await vault.open();
  const snapshot=():WorkspaceSnapshot=>({revision:store.revision,artifacts:store.list,originals:store.originals,history:store.history,bytes:ref=>store.get(ref).bytes,conversation:[],draft:null});
  const add=async(name:string,n:number)=>{const a=await store.prepare(new Uint8Array([n]),name,inspection,true);store.commit([a],store.revision);return a.meta.ref;};
  return {root,keychain,backend,vault,store,snapshot,add};
}
const reopen=(f:Awaited<ReturnType<typeof fixture>>)=>new WorkspaceVault(new NodeVaultBackend(f.root,f.keychain),{redact:(t:string)=>t}).open();
// staleAtPublication: current() true at queue admission, false at the pre-head check (#save line 264).
const staleAtPublication=()=>{let calls=0;return ()=>calls++<1;};

test('S44 repro A: stale save after an unpublished head failure preserves the acknowledged head manifest',async()=>{
  const f=await fixture();
  try{
    await f.add('a.pdf',1);await f.vault.save(f.snapshot);          // gen1
    await f.add('b.pdf',2);await f.vault.save(f.snapshot);          // gen2 = acknowledged head (A,B)
    await f.add('c.pdf',3);let failed=false;
    f.backend.fault=(step,name)=>{if(step==='stage'&&name==='head'&&!failed){failed=true;throw new Error('EIO');}};
    await assert.rejects(f.vault.save(f.snapshot));                 // gen3 unpublished, vault stays writable
    f.backend.fault=null;assert.equal(f.vault.mode,'writable');
    const manifestsBefore=(await readdir(join(f.root,'manifests'))).sort();
    await assert.rejects(f.vault.save(f.snapshot,staleAtPublication()),StaleSaveError); // stale (cancelled) save
    const manifestsAfter=(await readdir(join(f.root,'manifests'))).sort();
    assert.ok(manifestsBefore.every(name=>manifestsAfter.includes(name)));
    const reopened=await reopen(f);
    assert.equal(reopened.kind,'restored');
    if(reopened.kind==='restored'){assert.equal(reopened.recoveredPrevious,false,'acknowledged head must still load');assert.deepEqual(reopened.checkpoint.artifacts.map(a=>a.name),['a.pdf','b.pdf']);}
  }finally{await rm(f.root,{recursive:true,force:true});}
});

test('S44 repro C: first stale save after relaunch preserves blobs unique to the fallback predecessor',async()=>{
  const f=await fixture();
  try{
    const a=await f.add('a.pdf',1);await f.vault.save(f.snapshot);   // gen1 {a}
    f.store.clear();await f.add('b.pdf',2);await f.vault.save(f.snapshot); // gen2 {b}, predecessor gen1 {a}
    const blobsBefore=(await readdir(join(f.root,'blobs'))).sort();
    // Relaunch
    const v2=new WorkspaceVault(new NodeVaultBackend(f.root,f.keychain),{redact:t=>t});const out=await v2.open();assert.equal(out.kind,'restored');
    const snap2=():WorkspaceSnapshot=>({revision:9,artifacts:[],originals:[],history:[],bytes:()=>new Uint8Array(),conversation:[],draft:null});
    await assert.rejects(v2.save(snap2,staleAtPublication()),StaleSaveError);
    const blobsAfter=(await readdir(join(f.root,'blobs'))).sort();
    assert.deepEqual(blobsAfter,blobsBefore);assert.ok(blobsAfter.includes(a+'.atw'));
    // Corrupt the newest manifest: restore must be able to fall back to gen1.
    await writeFile(join(f.root,'manifests','2.atw'),new Uint8Array([0,1,2]));
    const reopened=await reopen(f);
    assert.equal(reopened.kind,'restored','fallback predecessor should remain intact');
    if(reopened.kind==='restored'){assert.equal(reopened.recoveredPrevious,true);assert.deepEqual(reopened.checkpoint.artifacts.map(a=>a.name),['a.pdf']);}
  }finally{await rm(f.root,{recursive:true,force:true});}
});

test('S44 control C: same flow without the stale save keeps the fallback predecessor restorable',async()=>{
  const f=await fixture();
  try{
    await f.add('a.pdf',1);await f.vault.save(f.snapshot);f.store.clear();await f.add('b.pdf',2);await f.vault.save(f.snapshot);
    const v2=new WorkspaceVault(new NodeVaultBackend(f.root,f.keychain),{redact:t=>t});await v2.open();
    await writeFile(join(f.root,'manifests','2.atw'),new Uint8Array([0,1,2]));
    const reopened=await reopen(f);assert.equal(reopened.kind,'restored');
  }finally{await rm(f.root,{recursive:true,force:true});}
});
