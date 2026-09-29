import {mkdir,open,readFile,readdir,rename,rm,stat,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {NAME} from '../../packages/core/src/workspace-checkpoint';
import type {VaultKeyStatus,VaultReadResult,WorkspaceVaultBackend} from '../../packages/core/src/workspace-vault';

// Synthetic test double for the Mac vault: same file format (ATW1 magic, then an
// AES-256-GCM combined box of 12-byte nonce, ciphertext and 16-byte tag, with the
// associated data authenticated) and the same stage/sync/rename write order.
// The "keychain" is an in-memory object that outlives a simulated relaunch.
export const MAGIC=new TextEncoder().encode('ATW1');
export type TestKeychain={raw:Uint8Array|null;state:'ok'|'locked'|'unavailable'};
// 'stage': fails before the target changes. 'rename': fails after the atomic rename
// but before the directory sync completes (a sync failure). 'remove': fails to
// unlink; returning 'skip' instead makes the removal report success but leave the file.
// 'remove-sync': the unlink happened but the directory sync failed. 'list', 'exists'
// and 'read': the storage query itself fails (for example EIO or EACCES).
export type FaultStep='stage'|'rename'|'remove'|'remove-sync'|'list'|'exists'|'read';
export type Fault=(step:FaultStep,name:string)=>void|'skip';
export const newKeychain=():TestKeychain=>({raw:null,state:'ok'});

export class NodeVaultBackend implements WorkspaceVaultBackend{
  fault:Fault|null=null;
  constructor(readonly root:string,readonly keychain:TestKeychain){}
  #path(name:string){if(!NAME.test(name))throw new Error('Rejected storage name.');return join(this.root,name);}
  async #key(){
    if(this.keychain.state!=='ok'||!this.keychain.raw)throw Object.assign(new Error('Key unavailable'),{locked:this.keychain.state==='locked'});
    return crypto.subtle.importKey('raw',new Uint8Array(this.keychain.raw),'AES-GCM',false,['encrypt','decrypt']);
  }
  async keyStatus(create:boolean):Promise<VaultKeyStatus>{
    if(this.keychain.state==='locked')return 'locked';
    if(this.keychain.state==='unavailable')return 'unavailable';
    if(this.keychain.raw)return 'ready';
    if(!create)return 'missing';
    this.keychain.raw=crypto.getRandomValues(new Uint8Array(32));return 'ready';
  }
  // Only a definite "no such file" means absent; any other failure is reported.
  async exists(name:string){
    const path=this.#path(name);this.fault?.('exists',name);
    try{await stat(path);return true;}catch(error){if((error as {code?:string}).code==='ENOENT')return false;throw error;}
  }
  async writeSealed(name:string,plain:Uint8Array,associatedData:string){
    const target=this.#path(name),key=await this.#key(),nonce=crypto.getRandomValues(new Uint8Array(12));
    const sealed=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce,additionalData:new TextEncoder().encode(associatedData)},key,new Uint8Array(plain)));
    const staging=join(this.root,'staging');await mkdir(staging,{recursive:true,mode:0o700});await mkdir(dirname(target),{recursive:true,mode:0o700});
    const temp=join(staging,`${crypto.randomUUID()}.tmp`),file=await open(temp,'wx',0o600);
    try{await file.writeFile(Buffer.concat([MAGIC,nonce,sealed]));await file.sync();}finally{await file.close();}
    this.fault?.('stage',name);
    await rename(temp,target);
    this.fault?.('rename',name);
    const directory=await open(dirname(target),'r');try{await directory.sync();}finally{await directory.close();}
  }
  async readOpened(name:string,associatedData:string):Promise<VaultReadResult>{
    let data:Uint8Array;
    const path=this.#path(name);this.fault?.('read',name);
    try{data=new Uint8Array(await readFile(path));}catch(error){if((error as {code?:string}).code==='ENOENT')return {status:'missing'};throw error;}
    let key:CryptoKey;
    try{key=await this.#key();}catch(e){return {status:(e as {locked?:boolean}).locked?'locked':'auth'};}
    if(data.length<MAGIC.length+12+16||MAGIC.some((b,i)=>data[i]!==b))return {status:'auth'};
    try{return {status:'ok',bytes:new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:data.slice(4,16),additionalData:new TextEncoder().encode(associatedData)},key,data.slice(16)))};}
    catch{return {status:'auth'};}
  }
  // A directory that was never created is empty; any other listing failure is thrown.
  async list(directory:'blobs'|'manifests'){
    this.fault?.('list',directory);
    let entries:string[];
    try{entries=await readdir(join(this.root,directory));}catch(error){if((error as {code?:string}).code==='ENOENT')return [];throw error;}
    return entries.map(name=>`${directory}/${name}`).filter(name=>NAME.test(name));
  }
  async remove(name:string){
    const target=this.#path(name);if(this.fault?.('remove',name)==='skip')return;
    await rm(target,{force:true});
    // Idempotent for an absent file, and only complete once the directory is synced.
    this.fault?.('remove-sync',name);
    const directory=await open(dirname(target),'r');try{await directory.sync();}finally{await directory.close();}
  }
  async cleanStaging(){await rm(join(this.root,'staging'),{recursive:true,force:true});}
}
export async function corrupt(path:string,mutate:(bytes:Uint8Array)=>Uint8Array){await writeFile(path,mutate(new Uint8Array(await readFile(path))));}
