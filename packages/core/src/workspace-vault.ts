import type {Artifact} from './local-file-store';
import {WORKSPACE_FORMAT,WORKSPACE_SCHEMA_VERSION,CheckpointError,aad,names,parseCheckpoint,parseHead,type PersistedArtifact,type PersistedEntry,type RetentionMode,type WorkspaceCheckpoint,type WorkspaceHead} from './workspace-checkpoint';

// Platform storage for one private workspace directory (ADR 0010). The backend
// owns the device-local key: callers pass plaintext and associated data, and the
// key never crosses into JavaScript. Every write is durable and atomic for its
// own file (stage, sync, same-volume rename); the vault orders files so that the
// head record is the single commit point.
export type VaultKeyStatus='ready'|'missing'|'locked'|'unavailable';
export type VaultReadResult={status:'ok';bytes:Uint8Array}|{status:'missing'|'auth'|'locked'};
// Storage queries never turn an unknown state into an answer: only a definite
// "no such file or directory" means absent or empty; every other failure throws.
export interface WorkspaceVaultBackend{
  /** Load the key; with create=true a missing key is created. Never replaces an existing key. */
  keyStatus(create:boolean):Promise<VaultKeyStatus>;
  /** False only when the file definitely does not exist; throws if that cannot be determined. */
  exists(name:string):Promise<boolean>;
  writeSealed(name:string,plain:Uint8Array,associatedData:string):Promise<void>;
  /** 'missing' only when the file definitely does not exist; I/O failures throw. */
  readOpened(name:string,associatedData:string):Promise<VaultReadResult>;
  /** [] only for a directory that does not exist or is empty; a failed listing throws. */
  list(directory:'blobs'|'manifests'):Promise<string[]>;
  /** Unlink (idempotent if already absent) and sync the directory. Resolves only when both succeed. */
  remove(name:string):Promise<void>;
  /** fsync a workspace directory, durably committing earlier entry changes in it (including another process's unlinks). Resolves for a directory that does not exist. */
  syncDirectory(directory:'blobs'|'manifests'):Promise<void>;
  /** Remove interrupted staging files. They are never referenced by a head. */
  cleanStaging():Promise<void>;
}

export type BlockedReason='key-missing'|'key-locked'|'key-unavailable'|'corrupt'|'missing-artifact'|'unsupported-schema'|'storage';
// cleanupPending: files no longer referenced by the workspace (for example PDF
// copies from before a Start over) could not be verified as removed yet.
export type RestoreOutcome=
  |{kind:'empty';cleanupPending:boolean}
  |{kind:'restored';checkpoint:WorkspaceCheckpoint;bytes:Map<string,Uint8Array>;recoveredPrevious:boolean;cleanupPending:boolean}
  |{kind:'blocked';reason:BlockedReason;retryable:boolean}
  |{kind:'unavailable'};
export type WorkspaceSnapshot={
  revision:number;artifacts:Artifact[];bytes:(ref:string)=>Uint8Array;originals:string[];history:string[];
  conversation:PersistedEntry[];draft:string|null;
};
type Options={redact:(text:string)=>string;now?:()=>Date;newID?:()=>string};

export const blockedMessages:Record<BlockedReason,string>={
  'key-locked':'atePDF can’t open your saved workspace while this Mac’s keychain is locked. Unlock it, then try again.',
  'key-missing':'atePDF can’t open your saved workspace because its key on this Mac is missing. The saved files were left untouched, but they can’t be recovered.',
  'key-unavailable':'atePDF can’t reach this Mac’s keychain, so your saved workspace can’t be opened right now. The saved files were left untouched.',
  corrupt:'Your saved workspace couldn’t be verified, so atePDF didn’t open it. The saved files were left untouched.',
  'missing-artifact':'A saved PDF from your workspace is missing or damaged, so atePDF didn’t open a partial workspace. The saved files were left untouched.',
  'unsupported-schema':'Your saved workspace was created by a newer version of atePDF. Update atePDF to open it; nothing was changed.',
  storage:'atePDF couldn’t read its saved workspace on this Mac. The saved files were left untouched.',
};
// Failure messages are chosen by what is actually known about the durable head.
// "Wasn't kept" / "nothing was removed" are only said when that is established.
export const STORAGE_WRITE_FAILED='atePDF couldn’t save this change on this device, so it wasn’t kept. Your previously saved work is unchanged.';
export const STORAGE_UNCONFIRMED='atePDF couldn’t confirm whether this change was saved on this device. It isn’t shown now, but it may reappear when atePDF opens again. Saving is paused until then.';
export const CLEAR_FAILED='atePDF couldn’t clear your saved workspace, so nothing was removed. Your conversation and files are still here.';
export const CLEANUP_INCOMPLETE='This conversation was cleared, but some of atePDF’s earlier PDF copies couldn’t be removed from this Mac yet. They stay encrypted and can’t be opened in atePDF; it will keep trying to remove them.';
export const CLEAR_UNCONFIRMED='atePDF couldn’t confirm that your saved workspace was cleared, so this conversation is still shown. Saving is paused; reopen atePDF to see what was kept.';

const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const encode=(value:unknown)=>encoder.encode(JSON.stringify(value));
const sha256=async(bytes:Uint8Array)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)))].map(n=>n.toString(16).padStart(2,'0')).join('');
class Blocked extends Error{constructor(readonly reason:BlockedReason){super(blockedMessages[reason]);}}
/** A save created before a Start over; it belongs to a cleared workspace and is never written. */
export class StaleSaveError extends Error{constructor(){super('This change belongs to a cleared workspace and was not saved.');this.name='StaleSaveError';}}
const CLEANUP_ATTEMPTS=3;
// Where a head replacement ended: established as the new head (written, synced and
// verified), established as not replacing the acknowledged head, or unknown.
type Publication='published'|'unpublished'|'uncertain';
const sameHead=(a:WorkspaceHead|null,b:WorkspaceHead|null)=>!!a&&!!b&&a.workspaceID===b.workspaceID&&a.generation===b.generation&&a.previousGeneration===b.previousGeneration&&a.deletionEpoch===b.deletionEpoch&&a.schemaVersion===b.schemaVersion;

export class WorkspaceVault{
  mode:'closed'|'writable'|'blocked'|'unavailable'='closed';
  #head:WorkspaceHead|null=null;
  #workspaceID='';#generation=0;#previous:number|null=null;#epoch=0;#revision=0;
  #retention:RetentionMode='keep';
  #cleanupPending=false;
  // Removals that may have happened but are not durably confirmed (the unlink ran,
  // the directory sync did not succeed). Carried across every later cleanup in this
  // session until an idempotent remove of that name (unlink + sync) succeeds.
  #unconfirmed=new Set<string>();
  // Immutable blobs already durable, with the generation that sealed them.
  #blobs=new Map<string,number>();
  #refsByGeneration=new Map<number,Set<string>>();
  #queue:Promise<unknown>=Promise.resolve();
  #now:()=>Date;#newID:()=>string;#redact:(text:string)=>string;
  constructor(private backend:WorkspaceVaultBackend,options:Options){this.#redact=options.redact;this.#now=options.now??(()=>new Date());this.#newID=options.newID??(()=>crypto.randomUUID());}
  get generation(){return this.#generation;}
  get deletionEpoch(){return this.#epoch;}
  /** True while unreferenced files (such as PDF copies from before a Start over) remain unverified as removed. */
  get cleanupPending(){return this.#cleanupPending;}

  /** Open and restore the newest valid checkpoint. Writes only staging cleanup and, for a brand-new workspace, the genesis head. */
  open():Promise<RestoreOutcome>{return this.#serial(()=>this.#open());}
  /** Mark the workspace unusable for writes, e.g. when restored PDFs fail revalidation. */
  block(){this.mode='blocked';}
  /**
   * Serialize one full checkpoint. Resolves only after the new head is durable.
   * A save is bound to the deletion epoch it was requested in: if a Start over
   * commits first, it is refused with StaleSaveError and nothing is written.
   */
  save(snapshot:()=>WorkspaceSnapshot):Promise<void>{
    const epoch=this.#epoch;
    return this.#serial(()=>{if(this.#epoch!==epoch)throw new StaleSaveError();return this.#save(snapshot());});
  }
  /**
   * Publish an empty workspace in a new deletion epoch, then remove and verify
   * the removal of every older file. cleanupComplete is false when some old
   * files remain; they are retried after later checkpoints and at launch.
   */
  clear():Promise<{cleanupComplete:boolean}>{return this.#serial(()=>this.#clear());}

  #serial<T>(work:()=>Promise<T>):Promise<T>{const next=this.#queue.then(work,work);this.#queue=next.catch(()=>undefined);return next;}

  async #open():Promise<RestoreOutcome>{
    try{
      await this.backend.cleanStaging();
      if(!await this.backend.exists(names.head)){
        // A head exists from before the first user data is written (the genesis
        // head), so stored files without one mean the head was lost, not that a
        // first save was interrupted. Keep everything and fail closed.
        if((await this.backend.list('manifests')).length||(await this.backend.list('blobs')).length)throw new Blocked('corrupt');
        if(await this.backend.keyStatus(true)!=='ready'){this.mode='unavailable';return {kind:'unavailable'};}
        const genesis:WorkspaceHead={format:WORKSPACE_FORMAT,schemaVersion:WORKSPACE_SCHEMA_VERSION,workspaceID:this.#newID(),generation:0,previousGeneration:null,deletionEpoch:0};
        this.#head=null;
        // An empty workspace either way: a failed genesis write only costs durability.
        if(await this.#commitHead(genesis,'roll-forward')!=='published'){this.mode='unavailable';return {kind:'unavailable'};}
        this.#adopt(genesis);this.mode='writable';return {kind:'empty',cleanupPending:false};
      }
      const key=await this.backend.keyStatus(false);
      // Never create a replacement key over an existing workspace.
      if(key!=='ready')throw new Blocked(key==='locked'?'key-locked':key==='missing'?'key-missing':'key-unavailable');
      const head=await this.#readHead();
      if(head.generation===0){
        // Genesis only: nothing was ever committed, so any manifest/blob beside it
        // is an interrupted first save and is removed now.
        this.#adopt(head);this.mode='writable';
        return {kind:'empty',cleanupPending:!await this.#collect(new Set(),new Set(),true)};
      }
      let restored:{checkpoint:WorkspaceCheckpoint;bytes:Map<string,Uint8Array>},recoveredPrevious=false;
      try{restored=await this.#load(head,head.generation);}
      catch(error){
        // Only the immediately preceding generation of the same deletion epoch may
        // stand in; a clear or expiry always publishes a head with no predecessor.
        if(!(error instanceof Blocked)||error.reason==='unsupported-schema'||error.reason==='key-locked'||head.previousGeneration===null)throw error;
        try{restored=await this.#load(head,head.previousGeneration);recoveredPrevious=true;}catch{throw error;}
      }
      const {checkpoint,bytes}=restored;
      this.#head=head;this.#workspaceID=head.workspaceID;this.#epoch=head.deletionEpoch;this.#revision=checkpoint.revision;this.#retention=checkpoint.retention.mode;
      // New generations always move forward from the newest published number.
      this.#generation=head.generation;this.#previous=checkpoint.generation;
      this.#blobs=new Map(checkpoint.artifacts.map(a=>[a.ref,a.blobGeneration]));
      this.#refsByGeneration=new Map([[checkpoint.generation,new Set(checkpoint.artifacts.map(a=>a.ref))]]);
      this.mode='writable';
      // Retry cleanup of anything the head no longer references. After a fallback
      // the newest manifest is unreadable, so its files are kept as evidence.
      let cleanupPending=false;
      if(!recoveredPrevious){
        const keepRefs=new Set(checkpoint.artifacts.map(a=>a.ref)),keepGenerations=new Set([head.generation]);
        if(head.previousGeneration!==null){
          keepGenerations.add(head.previousGeneration);
          const previous=await this.#refsOf(head,head.previousGeneration);
          if(previous)for(const ref of previous)keepRefs.add(ref);
          else cleanupPending=true; // an unreadable predecessor: leave its blobs alone
        }
        if(!cleanupPending)cleanupPending=!await this.#collect(keepRefs,keepGenerations,true);
        else this.#cleanupPending=true;
      }
      return {kind:'restored',checkpoint,bytes,recoveredPrevious,cleanupPending};
    }catch(error){
      const reason=error instanceof Blocked?error.reason:'storage';
      this.mode='blocked';
      return {kind:'blocked',reason,retryable:reason==='key-locked'||reason==='key-unavailable'||reason==='storage'};
    }
  }
  #adopt(head:WorkspaceHead){
    this.#head=head;this.#workspaceID=head.workspaceID;this.#epoch=head.deletionEpoch;this.#generation=head.generation;this.#previous=null;this.#revision=0;
    this.#blobs=new Map();this.#refsByGeneration=new Map();
  }
  async #refsOf(head:WorkspaceHead,generation:number):Promise<Set<string>|null>{
    try{
      const result=await this.backend.readOpened(names.manifest(generation),aad.manifest(head.workspaceID,generation));
      if(result.status!=='ok')return null;
      const checkpoint=parseCheckpoint(JSON.parse(decoder.decode(result.bytes)));
      return checkpoint.workspaceID===head.workspaceID&&checkpoint.generation===generation?new Set(checkpoint.artifacts.map(a=>a.ref)):null;
    }catch{return null;}
  }
  async #readHead():Promise<WorkspaceHead>{
    const result=await this.backend.readOpened(names.head,aad.head());
    if(result.status==='locked')throw new Blocked('key-locked');
    if(result.status!=='ok')throw new Blocked('corrupt');
    return this.#parse(result.bytes,parseHead);
  }
  #parse<T>(bytes:Uint8Array,parse:(value:unknown)=>T):T{
    try{return parse(JSON.parse(decoder.decode(bytes)));}
    catch(error){throw new Blocked(error instanceof CheckpointError&&error.kind==='unsupported-schema'?'unsupported-schema':'corrupt');}
  }
  async #load(head:WorkspaceHead,generation:number){
    const result=await this.backend.readOpened(names.manifest(generation),aad.manifest(head.workspaceID,generation));
    if(result.status==='locked')throw new Blocked('key-locked');
    if(result.status!=='ok')throw new Blocked('corrupt');
    const checkpoint=this.#parse(result.bytes,parseCheckpoint);
    if(checkpoint.workspaceID!==head.workspaceID||checkpoint.generation!==generation||checkpoint.deletionEpoch!==head.deletionEpoch||checkpoint.schemaVersion!==head.schemaVersion)throw new Blocked('corrupt');
    const bytes=new Map<string,Uint8Array>();
    for(const artifact of checkpoint.artifacts){
      const blob=await this.backend.readOpened(names.blob(artifact.ref),aad.blob(head.workspaceID,artifact.ref,artifact.blobGeneration));
      if(blob.status==='locked')throw new Blocked('key-locked');
      if(blob.status!=='ok'||blob.bytes.length!==artifact.sizeBytes||await sha256(blob.bytes)!==artifact.sha256)throw new Blocked('missing-artifact');
      bytes.set(artifact.ref,blob.bytes);
    }
    return {checkpoint,bytes};
  }

  #persisted(snapshot:WorkspaceSnapshot,generation:number):WorkspaceCheckpoint{
    // Allowlisted projection. SHR-71's guard already ran before chat retention;
    // it is applied again here so no free text reaches disk unguarded.
    const safe=(text:string)=>this.#redact(text);
    const draft=snapshot.draft&&snapshot.draft.trim()&&safe(snapshot.draft)===snapshot.draft?{text:snapshot.draft}:null;
    const artifacts=snapshot.artifacts.map((a):PersistedArtifact=>({ref:a.ref,name:safe(a.name),sizeBytes:a.sizeBytes,pageCount:a.pageCount,sha256:a.checksum,original:a.original,note:safe(a.note),
      inspection:{pages:a.inspection.pages.map(p=>({text:p.text,width:p.width,height:p.height,rotation:p.rotation}))},blobGeneration:this.#blobs.get(a.ref)??generation}));
    const now=this.#now().toISOString();
    return parseCheckpoint({format:WORKSPACE_FORMAT,schemaVersion:WORKSPACE_SCHEMA_VERSION,workspaceID:this.#workspaceID,generation,revision:snapshot.revision,deletionEpoch:this.#epoch,
      savedAt:now,lastActivityAt:now,retention:{mode:this.#retention},artifacts,originals:[...snapshot.originals],history:[...snapshot.history],
      focus:snapshot.history.at(-1)??null,undoPredecessor:snapshot.history.at(-2)??null,selection:[...snapshot.originals],collections:[],
      conversation:snapshot.conversation.map(e=>{
        const entry:PersistedEntry={id:e.id,role:e.role,text:safe(e.text)};
        if(e.files)entry.files=e.files.map(f=>({name:safe(f.name),size:f.size}));
        if(e.artifactRef)entry.artifactRef=e.artifactRef;
        if(e.resultTitle!==undefined)entry.resultTitle=safe(e.resultTitle);
        if(e.choice)entry.choice=e.choice;
        return entry;
      }),draft});
  }
  async #save(snapshot:WorkspaceSnapshot){
    if(this.mode!=='writable')throw new Error(STORAGE_WRITE_FAILED);
    const generation=this.#generation+1;
    let checkpoint:WorkspaceCheckpoint;const written=new Map<string,number>();
    try{
      checkpoint=this.#persisted(snapshot,generation);
      // 1. Immutable blobs: write each new artifact once, then prove it opens and matches.
      for(const artifact of checkpoint.artifacts){
        if(this.#blobs.has(artifact.ref))continue;
        const bytes=snapshot.bytes(artifact.ref),associated=aad.blob(this.#workspaceID,artifact.ref,generation);
        if(bytes.length!==artifact.sizeBytes||await sha256(bytes)!==artifact.sha256)throw new Error('Artifact changed before checkpoint.');
        await this.backend.writeSealed(names.blob(artifact.ref),bytes,associated);
        const check=await this.backend.readOpened(names.blob(artifact.ref),associated);
        if(check.status!=='ok'||await sha256(check.bytes)!==artifact.sha256)throw new Error('Artifact verification failed.');
        written.set(artifact.ref,generation);
      }
      // 2. Complete manifest, verified before anything points to it.
      const manifest=encode(checkpoint),manifestAAD=aad.manifest(this.#workspaceID,generation);
      await this.backend.writeSealed(names.manifest(generation),manifest,manifestAAD);
      const check=await this.backend.readOpened(names.manifest(generation),manifestAAD);
      if(check.status!=='ok'||decoder.decode(check.bytes)!==decoder.decode(manifest))throw new Error('Manifest verification failed.');
    }catch{
      // Definitely unpublished: the acknowledged head was never touched. Files from
      // this attempt are unreferenced and collected after a later checkpoint.
      throw new Error(STORAGE_WRITE_FAILED);
    }
    // 3. Commit point: atomically replace the head, keeping the previous generation.
    const next:WorkspaceHead={format:WORKSPACE_FORMAT,schemaVersion:WORKSPACE_SCHEMA_VERSION,workspaceID:this.#workspaceID,generation,previousGeneration:this.#previous,deletionEpoch:this.#epoch};
    const publication=await this.#commitHead(next,'withdraw');
    if(publication!=='published'){
      // This generation number may be named by a head on disk; never reuse it.
      this.#generation=generation;
      if(publication==='uncertain'){this.mode='blocked';throw new Error(STORAGE_UNCONFIRMED);}
      throw new Error(STORAGE_WRITE_FAILED);
    }
    for(const [ref,created] of written)this.#blobs.set(ref,created);
    this.#refsByGeneration.set(generation,new Set(checkpoint.artifacts.map(a=>a.ref)));
    const previous=this.#previous;this.#previous=generation;this.#generation=generation;this.#revision=snapshot.revision;
    await this.#collectAfter(previous);
  }
  /**
   * Replace the head and establish where that ended. Success needs the write,
   * its file and directory syncs, and a matching read-back. After any failure the
   * head is read again: if the acknowledged head is still there, the new one never
   * replaced it. Otherwise the outcome is reconciled before anything is reported:
   * - 'withdraw' (a save): make the new generation unrestorable by removing its
   *   manifest, and put the acknowledged head back. Restoring the head is enough;
   *   removal alone is enough when restore can fall back to the acknowledged
   *   same-epoch generation.
   * - 'roll-forward' (a clear or the genesis head): write the new head again.
   * Only if reconciliation also fails is the outcome 'uncertain'.
   */
  async #commitHead(next:WorkspaceHead,recovery:'withdraw'|'roll-forward'):Promise<Publication>{
    try{await this.#writeHead(next);return 'published';}catch{/* reconcile below */}
    const onDisk=await this.#peekHead();
    if(onDisk!=='unreadable'&&(onDisk===null?this.#head===null:sameHead(onDisk,this.#head)))return 'unpublished';
    if(recovery==='roll-forward'){try{await this.#writeHead(next);return 'published';}catch{return 'uncertain';}}
    let withdrawn=false;
    try{
      this.#unconfirmed.add(names.manifest(next.generation));
      await this.backend.remove(names.manifest(next.generation));
      this.#unconfirmed.delete(names.manifest(next.generation));
      // Without a same-epoch predecessor, a head naming a removed manifest restores
      // nothing usable, so removal alone does not re-establish the acknowledged state.
      withdrawn=next.previousGeneration!==null&&!await this.backend.exists(names.manifest(next.generation));
    }catch{/* try the head too */}
    if(this.#head)try{await this.#writeHead(this.#head);withdrawn=true;}catch{/* reported below */}
    return withdrawn?'unpublished':'uncertain';
  }
  async #writeHead(head:WorkspaceHead){
    await this.backend.writeSealed(names.head,encode(head),aad.head());
    const check=await this.#peekHead();
    if(check==='unreadable'||!sameHead(check,head))throw new Error('Head verification failed.');
    this.#head=head;
  }
  async #peekHead():Promise<WorkspaceHead|null|'unreadable'>{
    try{
      const result=await this.backend.readOpened(names.head,aad.head());
      if(result.status==='missing')return null;
      if(result.status!=='ok')return 'unreadable';
      return parseHead(JSON.parse(decoder.decode(result.bytes)));
    }catch{return 'unreadable';}
  }
  async #collectAfter(previous:number|null){
    const keep=new Set<string>();
    for(const generation of [this.#generation,previous])for(const ref of generation===null?[]:this.#refsByGeneration.get(generation)??[])keep.add(ref);
    for(const generation of [...this.#refsByGeneration.keys()])if(generation!==this.#generation&&generation!==previous)this.#refsByGeneration.delete(generation);
    for(const ref of [...this.#blobs.keys()])if(!keep.has(ref))this.#blobs.delete(ref);
    // Cleanup failure never undoes a published checkpoint; it stays pending and is retried.
    await this.#collect(keep,new Set([this.#generation,previous].filter((g):g is number=>g!==null)));
  }
  /**
   * Remove every manifest and blob not kept, and report true only with positive,
   * durable confirmation:
   * - a successful listing of both directories shows no unreferenced file (a failed
   *   listing is unknown, never empty);
   * - every name whose removal is unconfirmed, from this or any earlier cleanup in
   *   this session, has since had an idempotent remove (unlink + directory sync)
   *   succeed. Absence from a listing alone never confirms a removal;
   * - at launch (confirmDirectories), both directories are also synced after the
   *   clean listing. A previous process may have unlinked a file without a
   *   successful sync; syncing the directory durably commits that unlink, and an
   *   unlink lost to a crash reappears in the listing and is removed again. So the
   *   obligation survives restarts without a separate on-disk record.
   */
  async #collect(keepRefs:Set<string>,keepGenerations:Set<number>,confirmDirectories=false):Promise<boolean>{
    const kept=(name:string)=>{
      const generation=/^manifests\/(\d+)\.atw$/.exec(name)?.[1],ref=/^blobs\/(.+)\.atw$/.exec(name)?.[1];
      return generation!==undefined?keepGenerations.has(Number(generation)):ref!==undefined&&keepRefs.has(ref);
    };
    const unreferenced=async()=>[...await this.backend.list('manifests'),...await this.backend.list('blobs')].filter(name=>!kept(name));
    for(const name of [...this.#unconfirmed])if(kept(name))this.#unconfirmed.delete(name);
    let directoriesConfirmed=!confirmDirectories;
    for(let pass=0;pass<=CLEANUP_ATTEMPTS;pass++){
      let listed:string[];
      try{listed=await unreferenced();}catch{continue;}
      const targets=new Set([...listed,...this.#unconfirmed]);
      if(!targets.size){
        if(!directoriesConfirmed){
          try{await this.backend.syncDirectory('manifests');await this.backend.syncDirectory('blobs');directoriesConfirmed=true;}
          catch{continue;}
        }
        this.#cleanupPending=false;return true;
      }
      if(pass===CLEANUP_ATTEMPTS)break;
      for(const name of targets){
        try{await this.backend.remove(name);this.#unconfirmed.delete(name);}catch{this.#unconfirmed.add(name);}
      }
    }
    this.#cleanupPending=true;return false;
  }
  async #clear(){
    if(this.mode!=='writable')throw new Error(STORAGE_WRITE_FAILED);
    const generation=this.#generation+1,epoch=this.#epoch+1,now=this.#now().toISOString();
    const empty:WorkspaceCheckpoint={format:WORKSPACE_FORMAT,schemaVersion:WORKSPACE_SCHEMA_VERSION,workspaceID:this.#workspaceID,generation,revision:this.#revision+1,deletionEpoch:epoch,savedAt:now,lastActivityAt:now,
      retention:{mode:this.#retention},artifacts:[],originals:[],history:[],focus:null,undoPredecessor:null,selection:[],collections:[],conversation:[],draft:null};
    try{
      const manifestAAD=aad.manifest(this.#workspaceID,generation);
      await this.backend.writeSealed(names.manifest(generation),encode(empty),manifestAAD);
      if((await this.backend.readOpened(names.manifest(generation),manifestAAD)).status!=='ok')throw new Error('Manifest verification failed.');
    }catch{throw new Error(CLEAR_FAILED);}
    // Publish the new epoch before any deletion, with no fallback predecessor. A
    // pre-clear head is never put back: an unsettled clear is completed, or reported.
    const publication=await this.#commitHead({format:WORKSPACE_FORMAT,schemaVersion:WORKSPACE_SCHEMA_VERSION,workspaceID:this.#workspaceID,generation,previousGeneration:null,deletionEpoch:epoch},'roll-forward');
    if(publication!=='published'){
      this.#generation=generation;
      if(publication==='uncertain'){this.mode='blocked';throw new Error(CLEAR_UNCONFIRMED);}
      throw new Error(CLEAR_FAILED);
    }
    this.#generation=generation;this.#previous=generation;this.#epoch=epoch;this.#revision++;
    this.#blobs.clear();this.#refsByGeneration=new Map([[generation,new Set()]]);
    // The clear is durable now. Removal of the old copies is only claimed once verified.
    return {cleanupComplete:await this.#collect(new Set(),new Set([generation]))};
  }
}
export const savedArtifacts=(checkpoint:WorkspaceCheckpoint,bytes:Map<string,Uint8Array>)=>checkpoint.artifacts.map(a=>{
  const data=bytes.get(a.ref);if(!data)throw new Error(blockedMessages['missing-artifact']);
  return {meta:{ref:a.ref,name:a.name,sizeBytes:a.sizeBytes,pageCount:a.pageCount,original:a.original,inspection:a.inspection,checksum:a.sha256,note:a.note} satisfies Artifact,bytes:data};
});
