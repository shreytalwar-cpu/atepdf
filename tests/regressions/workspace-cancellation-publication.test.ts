import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {JobController} from '../../packages/core/src/job-controller';
import {LocalFileStore} from '../../packages/core/src/local-file-store';
import {NodeVaultBackend,newKeychain,type TestKeychain} from '../helpers/workspace-backend';
import {WorkspaceVault} from '../../packages/core/src/workspace-vault';
import {workspaceHook,deferred} from '../helpers/workspace-hook';
const inspection={pages:[{width:612,height:792,rotation:0,text:''}]};
const services={worker:async()=>({pages:1}),inspect:async()=>inspection,recognize:async()=>[]};
const file=(name='old.pdf')=>({name,size:1,arrayBuffer:async()=>new Uint8Array([1]).buffer}) as unknown as File;
const reopen=(root:string,keychain:TestKeychain)=>new WorkspaceVault(new NodeVaultBackend(root,keychain),{redact:t=>t}).open();
test('S44 repro: Cancel during an uncertain head publication is reported as uncertainty with an honest paused notice',async()=>{
  const root=await mkdtemp(join(tmpdir(),'rev-s44-unc-')),keychain=newKeychain();
  try{
    const b=new NodeVaultBackend(root,keychain),c=new JobController(new LocalFileStore(),services),h=await workspaceHook(c,{backend:b});
    for(let i=0;i<5&&h.view.restoring;i++)await h.flush();assert.equal(h.view.durable,true);
    await h.view.importFiles([file('first.pdf')]);await h.flush();
    const gate=deferred<void>(),entered=deferred<void>(),write=b.writeSealed.bind(b);let headWrites=-1,armed=false;
    b.writeSealed=async(name,bytes,aad)=>{if(name.startsWith('blobs/'))armed=true;if(name==='head'&&armed&&headWrites===-1){headWrites=0;entered.resolve();await gate.promise;}if(name==='head'&&headWrites>=0)headWrites++;return write(name,bytes,aad);};
    b.fault=(step,name)=>{
      if(name==='head'&&step==='rename'&&headWrites===1)throw new Error('sync failed after rename'); // new head is on disk
      if(name.startsWith('manifests/')&&step==='remove')throw new Error('EIO');                     // withdrawal cannot remove manifest
      if(name==='head'&&step==='stage'&&headWrites>=2)throw new Error('EIO');                        // cannot put old head back
    };
    const pending=h.view.importFiles([file('cancelled.pdf')]);
    await entered.promise;h.view.cancel();gate.resolve();await pending;for(let i=0;i<3;i++)await h.flush();
    b.fault=null;
    h.dispose();
    const disk=await reopen(root,keychain);
    assert.match(c.state.error!,/cancelled files may reappear after relaunch/);
    assert.match(h.view.notice.text,/saving is paused/);
    assert.equal(disk.kind,'restored');if(disk.kind==='restored')assert.ok(disk.checkpoint.artifacts.some(a=>a.name==='cancelled.pdf'));
    assert.notEqual(c.state.stage,'cancelled','an uncertain publication must not be reported as a clean cancellation');
  }finally{await rm(root,{recursive:true,force:true});}
});
