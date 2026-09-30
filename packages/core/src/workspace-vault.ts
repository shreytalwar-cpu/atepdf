import type {Artifact} from './local-file-store';
import {WORKSPACE_FORMAT,WORKSPACE_SCHEMA_VERSION,CheckpointError,DAY_MS,RETENTION_DAYS,aad,names,parseCheckpoint,parseHead,type PersistedArtifact,type PersistedEntry,type RetentionMode,type WorkspaceCheckpoint,type WorkspaceHead} from './workspace-checkpoint';

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
  /**
   * Remove every file in the staging directory (interrupted writes, never referenced
   * by a head), sync the directory and verify it is empty. Resolves for a staging
   * directory that does not exist; throws if listing, removal, the sync or the
   * verification fails, so a failure is never reported as cleaned.
   */
  cleanStaging():Promise<void>;
  /**
   * On-disk size of every workspace file: 'head', 'manifests/…' and 'blobs/…' by name,
   * plus one 'staging' entry totalling interrupted staging files. Regular files only;
   * throws if any workspace directory cannot be listed or measured.
   */
  usage():Promise<{name:string;bytes:number}[]>;
}

export type BlockedReason='key-missing'|'key-locked'|'key-unavailable'|'corrupt'|'missing-artifact'|'unsupported-schema'|'storage'|'clock';
// cleanupPending: files no longer referenced by the workspace (for example PDF
// copies from before a Start over) could not be verified as removed yet.
// expired: the saved workspace was older than its retention setting allows, so a
// new empty deletion epoch was published instead of restoring it.
export type RestoreOutcome=
  |{kind:'empty';retention:RetentionMode;cleanupPending:boolean}
  |{kind:'expired';retention:RetentionMode;cleanupPending:boolean}
  |{kind:'restored';checkpoint:WorkspaceCheckpoint;bytes:Map<string,Uint8Array>;recoveredPrevious:boolean;cleanupPending:boolean}
  |{kind:'blocked';reason:BlockedReason;retryable:boolean}
  |{kind:'unavailable'};
export type WorkspaceSnapshot={
  revision:number;artifacts:Artifact[];bytes:(ref:string)=>Uint8Array;originals:string[];history:string[];
  conversation:PersistedEntry[];draft:string|null;
};
type Options={redact:(text:string)=>string;now?:()=>Date;newID?:()=>string};
// current: nothing to expire. due: a finite retention period has passed since the
// last activity. clock: the clock is earlier than saved times, so age is unknown.
export type ExpiryState='current'|'due'|'clock';
export type RetentionChange={kind:'changed'}|{kind:'expired'|'cleared';cleanupComplete:boolean};
// Measured sizes of the files atePDF manages for the workspace, in bytes. Only what
// the vault can list is counted; external originals and exported files never are.
export type WorkspaceUsage={
  /** Encrypted copies of imported PDFs referenced by the current or fallback checkpoint. */
  originals:number;
  /** Encrypted results referenced by the current or fallback checkpoint. */
  results:number;
  /** Head and checkpoints: conversation, draft, page text and workspace metadata. */
  records:number;
  /** Unreferenced files and interrupted staging files still to be removed. */
  pending:number;
  /** Stored files the workspace could not open (blocked or unavailable workspace). */
  unopened:number;
  total:number;
};


export const blockedMessages:Record<BlockedReason,string>={
  'key-locked':'atePDF can’t open your saved workspace while this Mac’s keychain is locked. Unlock it, then try again.',
  'key-missing':'atePDF can’t open your saved workspace because its key on this Mac is missing. The saved files were left untouched, but they can’t be recovered.',
  'key-unavailable':'atePDF can’t reach this Mac’s keychain, so your saved workspace can’t be opened right now. The saved files were left untouched.',
  corrupt:'Your saved workspace couldn’t be verified, so atePDF didn’t open it. The saved files were left untouched.',
  'missing-artifact':'A saved PDF from your workspace is missing or damaged, so atePDF didn’t open a partial workspace. The saved files were left untouched.',
  'unsupported-schema':'Your saved workspace was created by a newer version of atePDF. Update atePDF to open it; nothing was changed.',
  storage:'atePDF couldn’t read its saved workspace on this Mac. The saved files were left untouched.',
  clock:'This Mac’s date is earlier than your last change in atePDF, so it can’t apply your retention setting. Your saved workspace was left untouched. Check the date and time, then try again.',
};
// Failure messages are chosen by what is actually known about the durable head.
// "Wasn't kept" / "nothing was removed" are only said when that is established.
export const STORAGE_WRITE_FAILED='atePDF couldn’t save this change on this device, so it wasn’t kept. Your previously saved work is unchanged.';
export const STORAGE_UNCONFIRMED='atePDF couldn’t confirm whether this change was saved on this device. It isn’t shown now, but it may reappear when atePDF opens again. Saving is paused until then.';
export const CLEAR_FAILED='atePDF couldn’t clear your saved workspace, so nothing was removed. Your conversation and files are still here.';
export const CLEANUP_INCOMPLETE='This conversation was cleared, but some of atePDF’s earlier PDF copies couldn’t be removed from this Mac yet. They stay encrypted and can’t be opened in atePDF; it will keep trying to remove them.';
export const CLEAR_UNCONFIRMED='atePDF couldn’t confirm that your saved workspace was cleared, so this conversation is still shown. Saving is paused; reopen atePDF to see what was kept.';
// Delete local data on a workspace that could not be opened (no new epoch can be
// sealed). The head is removed first, so nothing is removed unless that succeeds.
export const DELETE_FAILED='atePDF couldn’t delete its saved workspace on this Mac, so nothing was removed.';
export const DELETE_UNCONFIRMED='atePDF couldn’t confirm that its saved workspace was deleted from this Mac. Nothing more was removed; try again.';
export const expiredMessage=(mode:RetentionMode)=>`Your saved workspace was deleted because it hadn’t changed for ${RETENTION_DAYS[mode]??0} days, as set in Keep workspace.`;

const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const encode=(value:unknown)=>encoder.encode(JSON.stringify(value));
const sha256=async(bytes:Uint8Array)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)))].map(n=>n.toString(16).padStart(2,'0')).join('');
class Blocked extends Error{constructor(readonly reason:BlockedReason){super(blockedMessages[reason]);}}
/** A save created before a Start over; it belongs to a cleared workspace and is never written. */
export class StaleSaveError extends Error{constructor(){super('This change belongs to a cleared workspace and was not saved.');this.name='StaleSaveError';}}
/** A save found its workspace past its retention period: the workspace was expired instead of saved. */
export class WorkspaceExpiredError extends Error{constructor(readonly mode:RetentionMode,readonly cleanupComplete:boolean){super(expiredMessage(mode));this.name='WorkspaceExpiredError';}}
const CLEANUP_ATTEMPTS=3;
// Where a head replacement ended: established as the new head (written, synced and
// verified), established as not replacing the acknowledged head, or unknown.
type Publication='published'|'unpublished'|'uncertain';
const sameHead=(a:WorkspaceHead|null,b:WorkspaceHead|null)=>!!a&&!!b&&a.workspaceID===b.workspaceID&&a.generation===b.generation&&a.previousGeneration===b.previousGeneration&&a.deletionEpoch===b.deletionEpoch&&a.schemaVersion===b.schemaVersion&&a.retention===b.retention;

const hasContent=(c:{artifacts:unknown[];conversation:unknown[];draft:unknown})=>!!(c.artifacts.length||c.conversation.length||c.draft);

export class WorkspaceVault{
  mode:'closed'|'writable'|'blocked'|'unavailable'='closed';
  #head:WorkspaceHead|null=null;
  #workspaceID='';#generation=0;#previous:number|null=null;#epoch=0;#revision=0;
  #retention:RetentionMode='keep';
  // Retention clock in ms: the last user activity that changed the workspace, and
  // the newest time written to disk. #content: the durable checkpoint holds user data.
  #lastActivity=0;#savedAt=0;#content=false;
  // The newest durable checkpoint; rewritten as-is when only the retention mode changes.
  #last:WorkspaceCheckpoint|null=null;
  #blockedReason:BlockedReason|null=null;
  // Advances whenever the workspace is emptied (Start over, expiry, switching to Delete
  // when atePDF quits, Delete local data). A save requested before that is refused,
  // including after Delete local data starts a new workspace whose epoch restarts at 0.
  #fence=0;
  #cleanupPending=false;
  // Staging files (interrupted writes) that are not yet verified removed. Retried at
  // every later cleanup until removal is confirmed.
  #stagingPending=false;
  // Removals that may have happened but are not durably confirmed (the unlink ran,
  // the directory sync did not succeed). Carried across every later cleanup in this
  // session until an idempotent remove of that name (unlink + sync) succeeds.
  #unconfirmed=new Set<string>();
  // Directories whose earlier unlinks (possibly by a previous process) are not yet
  // durably committed. Every launch adds both: a previous process may have unlinked
  // a file without a successful sync, and an empty listing is not proof of a durable
  // removal. Each directory leaves the set only when its own sync succeeds, whichever
  // checkpoint restored (a fallback included); until then cleanup stays pending and
  // every later cleanup retries it.
  #unsynced=new Set<'manifests'|'blobs'>();
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
  /** The retention setting of the open workspace. */
  get retention(){return this.#retention;}
  /** Why writes are refused, when that is known (for example 'clock'). */
  get blockedReason(){return this.mode==='blocked'?this.#blockedReason:null;}
  /** Last user activity that changed the retained workspace (ms), or null when nothing is retained. */
  get lastActivity(){return this.#content?this.#lastActivity:null;}

  /** Open and restore the newest valid checkpoint. Writes only staging cleanup, a brand-new workspace's genesis head, and expiry. */
  open():Promise<RestoreOutcome>{return this.#serial(()=>this.#open());}
  /** Mark the workspace unusable for writes, e.g. when restored PDFs fail revalidation. */
  block(){this.mode='blocked';this.#blockedReason='missing-artifact';}
  /**
   * Serialize one full checkpoint. Resolves only after the new head is durable.
   * A save is bound to the workspace it was requested in: if a Start over, expiry or
   * deletion commits first, it is refused with StaleSaveError and nothing is written.
   * A workspace past its retention period is expired instead (WorkspaceExpiredError),
   * so a late change can never renew it. With Delete when atePDF quits nothing is
   * written: the session is memory-only.
   */
  save(snapshot:()=>WorkspaceSnapshot,current:()=>boolean=()=>true):Promise<void>{
    const fence=this.#fence;
    return this.#serial(async()=>{
      if(this.#fence!==fence)throw new StaleSaveError();
      if(this.mode==='writable'){
        // Memory-only session. Its activity time is kept so a later switch to a
        // durable mode measures age from the right moment.
        if(this.#retention==='quit'){if(!current())throw new StaleSaveError();this.#lastActivity=this.#now().getTime();return;}
        const state=this.expiryState();
        if(state==='due'){const mode=this.#retention;throw new WorkspaceExpiredError(mode,await this.#clear(mode));}
        if(state==='clock'){this.#blockClock();throw new Error(blockedMessages.clock);}
      }
      if(!current())throw new StaleSaveError();
      return this.#save(snapshot(),true,this.#retention,current);
    });
  }
  /**
   * Whether the retained workspace has outlived a finite retention setting. Keep until
   * I delete it and Delete when atePDF quits never expire by age, and an empty
   * workspace has nothing to expire. A clock earlier than the last activity or save
   * time, by any amount, or an invalid clock means the age is unknown: 'clock', never
   * a silent extension.
   */
  expiryState(now=this.#now().getTime()):ExpiryState{return this.#age(this.#retention,this.#content,now);}
  #age(mode:RetentionMode,content:boolean,now:number):ExpiryState{
    const days=RETENTION_DAYS[mode];
    if(!days||!content)return 'current';
    // Any clock earlier than a time already written means the age is unknown (ADR 0010).
    if(!Number.isFinite(now)||now<this.#lastActivity||now<this.#savedAt)return 'clock';
    return now-this.#lastActivity>=days*DAY_MS?'due':'current';
  }
  /**
   * How long the workspace has been idle (ms) when switching to `mode` would expire it
   * at once, else null. `session`: a memory-only session (Delete when atePDF quits)
   * currently holds work.
   */
  idleIfExpiring(mode:RetentionMode,session:boolean):number|null{
    const now=this.#now().getTime();
    return this.#age(mode,this.#retention==='quit'?session:this.#content,now)==='due'?now-this.#lastActivity:null;
  }
  /** Expire the whole workspace now if its retention period has passed (launch, foreground return, before an action). */
  expireIfDue():Promise<{kind:'current'}|{kind:'clock'}|{kind:'expired';mode:RetentionMode;cleanupComplete:boolean}>{
    return this.#serial(async()=>{
      if(this.mode!=='writable')return {kind:'current'} as const;
      const state=this.expiryState();
      if(state==='clock'){this.#blockClock();return {kind:'clock'} as const;}
      if(state==='current')return {kind:'current'} as const;
      const mode=this.#retention;
      return {kind:'expired',mode,cleanupComplete:await this.#clear(mode)} as const;
    });
  }
  /**
   * Change the retention setting. Changing it is not workspace activity, so the
   * existing age is kept, and a shorter period applies to it at once ('expired').
   * Choosing Delete when atePDF quits first publishes a new empty deletion epoch, so
   * the saved workspace is gone before the session continues in memory only
   * ('cleared'). Leaving it saves the current session in the chosen mode.
   */
  setRetention(mode:RetentionMode,snapshot:()=>WorkspaceSnapshot):Promise<RetentionChange>{
    return this.#serial(async():Promise<RetentionChange>=>{
      if(this.mode!=='writable')throw new Error(STORAGE_WRITE_FAILED);
      const from=this.#retention;
      if(mode===from)return {kind:'changed'};
      if(mode==='quit')return {kind:'cleared',cleanupComplete:await this.#clear('quit')};
      const session=from==='quit'?snapshot():null;
      const state=this.#age(mode,session?hasContent(session):this.#content,this.#now().getTime());
      if(state==='clock')throw new Error(blockedMessages.clock);
      if(state==='due')return {kind:'expired',cleanupComplete:await this.#clear(mode)};
      if(session)await this.#save(session,false,mode);
      else await this.#rewrite(mode);
      return {kind:'changed'};
    });
  }
  /**
   * Publish an empty workspace in a new deletion epoch, then remove and verify
   * the removal of every older file. cleanupComplete is false when some old
   * files remain; they are retried after later checkpoints and at launch.
   * The retention setting is kept.
   */
  clear():Promise<{cleanupComplete:boolean}>{return this.#serial(async()=>({cleanupComplete:await this.#clear(this.#retention)}));}
  /**
   * Delete local data: every atePDF-managed workspace file, and the retention setting
   * returns to Keep until I delete it. An open workspace publishes a new empty epoch
   * first, exactly as Start over does. A workspace that could not be opened (blocked
   * or unavailable) is removed head first, so no relaunch can restore any part of
   * it, then a new empty workspace is started when the key allows.
   */
  deleteAll():Promise<{cleanupComplete:boolean}>{
    return this.#serial(async()=>{
      if(this.mode==='writable'){
        return {cleanupComplete:await this.#clear('keep')};
      }
      return this.#wipe();
    });
  }
  /** Sizes of the files atePDF manages for this workspace, by category. Throws if storage can't be measured. */
  usage():Promise<WorkspaceUsage>{return this.#serial(()=>this.#usage());}

  /** A write that fails may leave a staging file behind; the next cleanup removes and verifies it. */
  async #write(name:string,plain:Uint8Array,associatedData:string){
    try{await this.backend.writeSealed(name,plain,associatedData);}
    catch(error){this.#stagingPending=true;throw error;}
  }
  #serial<T>(work:()=>Promise<T>):Promise<T>{const next=this.#queue.then(work,work);this.#queue=next.catch(()=>undefined);return next;}
  #blockClock(){this.mode='blocked';this.#blockedReason='clock';}

  async #open():Promise<RestoreOutcome>{
    this.#unsynced.add('manifests').add('blobs');
    try{
      if(!await this.backend.exists(names.head)){
        // A head exists from before the first user data is written (the genesis
        // head), so stored files without one mean the head was lost, not that a
        // first save was interrupted. Keep everything and fail closed.
        if((await this.backend.list('manifests')).length||(await this.backend.list('blobs')).length)throw new Blocked('corrupt');
        if(!await this.#genesis())return {kind:'unavailable'};
        return {kind:'empty',retention:'keep',cleanupPending:!await this.#collect(new Set(),new Set(),{confirm:true,staging:true})};
      }
      const key=await this.backend.keyStatus(false);
      // Never create a replacement key over an existing workspace.
      if(key!=='ready')throw new Blocked(key==='locked'?'key-locked':key==='missing'?'key-missing':'key-unavailable');
      const head=await this.#readHead();
      if(head.generation===0){
        // Genesis only: nothing was ever committed, so any manifest/blob beside it
        // is an interrupted first save and is removed now.
        this.#adopt(head);this.mode='writable';
        return {kind:'empty',retention:'keep',cleanupPending:!await this.#collect(new Set(),new Set(),{confirm:true,staging:true})};
      }
      // An expired workspace is deleted, not opened. Its age is checked before any
      // PDF is read, so a missing or damaged PDF cannot keep an expired workspace alive.
      const newest=await this.#readCheckpoint(head,head.generation);
      if(newest){
        this.#enter(head,newest);
        const early=await this.#retentionOutcome();if(early)return early;
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
      this.#enter(head,checkpoint);
      // Checked again on what was actually loaded (a fallback, or a newest manifest
      // the early read could not open), so no path restores an expired workspace.
      const late=await this.#retentionOutcome();if(late)return late;
      // Staging belongs to no generation, so it is cleaned whichever checkpoint
      // restored, a fallback included. Until verified empty it stays pending, is
      // counted in usage and is retried at every later cleanup.
      let cleanupPending=!await this.#sweepStaging();
      // Retry cleanup of anything the head no longer references. After a fallback
      // the newest manifest is unreadable, so its files are kept as evidence, but
      // earlier unlinks still need both directory syncs before anything is reported
      // clean. A failed sync keeps cleanup pending; later saves and launches retry it.
      if(recoveredPrevious){
        let confirmed=false;
        for(let attempt=0;attempt<CLEANUP_ATTEMPTS&&!confirmed;attempt++)confirmed=await this.#syncDirectories();
        if(!confirmed)cleanupPending=true;
      }else{
        const keepRefs=new Set(checkpoint.artifacts.map(a=>a.ref)),keepGenerations=new Set([head.generation]);
        let predecessorRead=true;
        if(head.previousGeneration!==null){
          keepGenerations.add(head.previousGeneration);
          const previous=await this.#readCheckpoint(head,head.previousGeneration);
          if(previous){
            const refs=new Set(previous.artifacts.map(a=>a.ref));
            this.#refsByGeneration.set(head.previousGeneration,refs);
            for(const ref of refs)keepRefs.add(ref);
          }else predecessorRead=false; // an unreadable predecessor: leave its blobs alone
        }
        cleanupPending=predecessorRead?!await this.#collect(keepRefs,keepGenerations,{confirm:true}):true;
      }
      this.#cleanupPending=cleanupPending;
      return {kind:'restored',checkpoint,bytes,recoveredPrevious,cleanupPending};
    }catch(error){
      const reason=error instanceof Blocked?error.reason:'storage';
      this.mode='blocked';this.#blockedReason=reason;
      return {kind:'blocked',reason,retryable:reason==='key-locked'||reason==='key-unavailable'||reason==='storage'};
    }
  }
  /** Write the genesis head of a brand-new workspace (creating its key). False when the workspace stays unsaved. */
  async #genesis():Promise<boolean>{
    if(await this.backend.keyStatus(true)!=='ready'){this.mode='unavailable';return false;}
    const genesis:WorkspaceHead={format:WORKSPACE_FORMAT,schemaVersion:WORKSPACE_SCHEMA_VERSION,workspaceID:this.#newID(),generation:0,previousGeneration:null,deletionEpoch:0,retention:'keep'};
    this.#head=null;
    // An empty workspace either way: a failed genesis write only costs durability.
    if(await this.#commitHead(genesis,'roll-forward')!=='published'){this.mode='unavailable';return false;}
    this.#adopt(genesis);this.mode='writable';return true;
  }
  #adopt(head:WorkspaceHead){
    this.#head=head;this.#workspaceID=head.workspaceID;this.#epoch=head.deletionEpoch;this.#generation=head.generation;this.#previous=null;this.#revision=0;
    this.#blobs=new Map();this.#refsByGeneration=new Map();
    this.#retention='keep';this.#last=null;this.#content=false;this.#lastActivity=this.#now().getTime();this.#savedAt=0;
  }
  /** Adopt a loaded checkpoint as the open workspace. */
  #enter(head:WorkspaceHead,checkpoint:WorkspaceCheckpoint){
    // The head names the committed retention setting. Its own manifest must agree; a
    // fallback manifest may predate a later setting change, and the head's setting wins.
    if(head.retention&&checkpoint.generation===head.generation&&checkpoint.retention.mode!==head.retention)throw new Blocked('corrupt');
    // Delete when atePDF quits never has retained content to fall back to.
    if(head.retention==='quit'&&hasContent(checkpoint))throw new Blocked('corrupt');
    this.#head=head;this.#workspaceID=head.workspaceID;this.#epoch=head.deletionEpoch;this.#revision=checkpoint.revision;
    // New generations always move forward from the newest published number.
    this.#generation=head.generation;this.#previous=checkpoint.generation;
    this.#blobs=new Map(checkpoint.artifacts.map(a=>[a.ref,a.blobGeneration]));
    this.#refsByGeneration=new Map([[checkpoint.generation,new Set(checkpoint.artifacts.map(a=>a.ref))]]);
    this.#track(checkpoint);if(head.retention)this.#retention=head.retention;this.mode='writable';
  }
  #track(checkpoint:WorkspaceCheckpoint){
    this.#last=checkpoint;this.#retention=checkpoint.retention.mode;this.#content=hasContent(checkpoint);
    this.#lastActivity=Date.parse(checkpoint.lastActivityAt);this.#savedAt=Date.parse(checkpoint.savedAt);
  }
  /** At launch: an expired workspace is replaced by an empty epoch; an unknown age blocks it. */
  async #retentionOutcome():Promise<RestoreOutcome|null>{
    const state=this.expiryState();
    if(state==='clock'){this.#blockClock();return {kind:'blocked',reason:'clock',retryable:true};}
    if(state==='current')return null;
    const mode=this.#retention;
    return {kind:'expired',retention:mode,cleanupPending:!await this.#clear(mode)};
  }
  async #readCheckpoint(head:WorkspaceHead,generation:number):Promise<WorkspaceCheckpoint|null>{
    try{
      const result=await this.backend.readOpened(names.manifest(generation),aad.manifest(head.workspaceID,generation));
      if(result.status!=='ok')return null;
      const checkpoint=parseCheckpoint(JSON.parse(decoder.decode(result.bytes)));
      return checkpoint.workspaceID===head.workspaceID&&checkpoint.generation===generation&&checkpoint.deletionEpoch===head.deletionEpoch&&checkpoint.schemaVersion===head.schemaVersion?checkpoint:null;
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

  #persisted(snapshot:WorkspaceSnapshot,generation:number,activity:boolean,mode:RetentionMode):WorkspaceCheckpoint{
    // Allowlisted projection. SHR-71's guard already ran before chat retention;
    // it is applied again here so no free text reaches disk unguarded.
    const safe=(text:string)=>this.#redact(text);
    const draft=snapshot.draft&&snapshot.draft.trim()&&safe(snapshot.draft)===snapshot.draft?{text:snapshot.draft}:null;
    const artifacts=snapshot.artifacts.map((a):PersistedArtifact=>({ref:a.ref,name:safe(a.name),sizeBytes:a.sizeBytes,pageCount:a.pageCount,sha256:a.checksum,original:a.original,note:safe(a.note),
      inspection:{pages:a.inspection.pages.map(p=>({text:p.text,width:p.width,height:p.height,rotation:p.rotation}))},blobGeneration:this.#blobs.get(a.ref)??generation}));
    const now=this.#now().toISOString();
    return parseCheckpoint({format:WORKSPACE_FORMAT,schemaVersion:WORKSPACE_SCHEMA_VERSION,workspaceID:this.#workspaceID,generation,revision:snapshot.revision,deletionEpoch:this.#epoch,
      savedAt:now,lastActivityAt:activity?now:new Date(this.#lastActivity).toISOString(),retention:{mode},artifacts,originals:[...snapshot.originals],history:[...snapshot.history],
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
  #empty(generation:number,epoch:number,revision:number,mode:RetentionMode):WorkspaceCheckpoint{
    const now=this.#now().toISOString();
    return {format:WORKSPACE_FORMAT,schemaVersion:WORKSPACE_SCHEMA_VERSION,workspaceID:this.#workspaceID,generation,revision,deletionEpoch:epoch,savedAt:now,lastActivityAt:now,
      retention:{mode},artifacts:[],originals:[],history:[],focus:null,undoPredecessor:null,selection:[],collections:[],conversation:[],draft:null};
  }
  async #save(snapshot:WorkspaceSnapshot,activity:boolean,mode=this.#retention,current:()=>boolean=()=>true){
    if(this.mode!=='writable')throw new Error(STORAGE_WRITE_FAILED);
    const generation=this.#generation+1;
    let checkpoint:WorkspaceCheckpoint;const written=new Map<string,number>();
    try{
      checkpoint=this.#persisted(snapshot,generation,activity,mode);
      // 1. Immutable blobs: write each new artifact once, then prove it opens and matches.
      for(const artifact of checkpoint.artifacts){
        if(this.#blobs.has(artifact.ref))continue;
        const bytes=snapshot.bytes(artifact.ref),associated=aad.blob(this.#workspaceID,artifact.ref,generation);
        if(bytes.length!==artifact.sizeBytes||await sha256(bytes)!==artifact.sha256)throw new Error('Artifact changed before checkpoint.');
        await this.#write(names.blob(artifact.ref),bytes,associated);
        const check=await this.backend.readOpened(names.blob(artifact.ref),associated);
        if(check.status!=='ok'||await sha256(check.bytes)!==artifact.sha256)throw new Error('Artifact verification failed.');
        written.set(artifact.ref,generation);
      }
    }catch{
      // Definitely unpublished: the acknowledged head was never touched. Files from
      // this attempt are unreferenced and collected after a later checkpoint.
      throw new Error(STORAGE_WRITE_FAILED);
    }
    await this.#commit(checkpoint,written,current);
  }
  /** Publish the newest checkpoint again with another retention mode; its PDFs are already durable. */
  async #rewrite(mode:RetentionMode){
    if(this.mode!=='writable')throw new Error(STORAGE_WRITE_FAILED);
    const generation=this.#generation+1,base=this.#last??this.#empty(generation,this.#epoch,this.#revision,mode);
    await this.#commit(parseCheckpoint({...base,generation,deletionEpoch:this.#epoch,savedAt:this.#now().toISOString(),retention:{mode}}),new Map());
  }
  /** Write and verify a complete manifest, then publish it through the head, the commit point. */
  async #commit(checkpoint:WorkspaceCheckpoint,written:Map<string,number>,current:()=>boolean=()=>true){
    const generation=checkpoint.generation;
    try{
      // 2. Complete manifest, verified before anything points to it.
      const manifest=encode(checkpoint),manifestAAD=aad.manifest(this.#workspaceID,generation);
      await this.#write(names.manifest(generation),manifest,manifestAAD);
      const check=await this.backend.readOpened(names.manifest(generation),manifestAAD);
      if(check.status!=='ok'||decoder.decode(check.bytes)!==decoder.decode(manifest))throw new Error('Manifest verification failed.');
    }catch{throw new Error(STORAGE_WRITE_FAILED);}
    // A stale attempt owns only its unreferenced files, never the acknowledged
    // head or fallback. Leave orphans for a later successful checkpoint/launch.
    if(!current())throw new StaleSaveError();
    // 3. Commit point: atomically replace the head, keeping the previous generation.
    const next:WorkspaceHead={format:WORKSPACE_FORMAT,schemaVersion:WORKSPACE_SCHEMA_VERSION,workspaceID:this.#workspaceID,generation,previousGeneration:this.#previous,deletionEpoch:this.#epoch,retention:checkpoint.retention.mode};
    const publication=await this.#commitHead(next,'withdraw');
    if(publication!=='published'){
      // This generation number may be named by a head on disk; never reuse it.
      this.#generation=generation;
      if(publication==='uncertain'){this.mode='blocked';this.#blockedReason=null;throw new Error(STORAGE_UNCONFIRMED);}
      throw new Error(STORAGE_WRITE_FAILED);
    }
    for(const [ref,created] of written)this.#blobs.set(ref,created);
    this.#refsByGeneration.set(generation,new Set(checkpoint.artifacts.map(a=>a.ref)));
    const previous=this.#previous;this.#previous=generation;this.#generation=generation;this.#revision=checkpoint.revision;
    this.#track(checkpoint);
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
    await this.#write(names.head,encode(head),aad.head());
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
   * - at launch (every path, a fallback restore included) and with options.confirm,
   *   both directories are also synced after the clean listing. A previous process
   *   may have unlinked a file without a successful sync; syncing the directory
   *   durably commits that unlink, and an unlink lost to a crash reappears in the
   *   listing and is removed again. So the obligation survives restarts without a
   *   separate on-disk record. Each directory is confirmed independently, and one
   *   whose sync fails stays owed, retried by every later cleanup until it succeeds;
   * - staging (options.staging: launch, clear, deletion; and every later cleanup
   *   while an earlier staging cleanup is unconfirmed or a write failed) is removed and
   *   verified empty by the backend. A failed listing, unlink or sync keeps cleanup
   *   pending, and the staging bytes stay visible in usage until a retry succeeds.
   */
  async #collect(keepRefs:Set<string>,keepGenerations:Set<number>,options:{confirm?:boolean;staging?:boolean}={}):Promise<boolean>{
    if(options.staging||this.#stagingPending)await this.#sweepStaging();
    const kept=(name:string)=>{
      const generation=/^manifests\/(\d+)\.atw$/.exec(name)?.[1],ref=/^blobs\/(.+)\.atw$/.exec(name)?.[1];
      return generation!==undefined?keepGenerations.has(Number(generation)):ref!==undefined&&keepRefs.has(ref);
    };
    const unreferenced=async()=>[...await this.backend.list('manifests'),...await this.backend.list('blobs')].filter(name=>!kept(name));
    for(const name of [...this.#unconfirmed])if(kept(name))this.#unconfirmed.delete(name);
    if(options.confirm)this.#unsynced.add('manifests').add('blobs');
    for(let pass=0;pass<=CLEANUP_ATTEMPTS;pass++){
      let listed:string[];
      try{listed=await unreferenced();}catch{continue;}
      const targets=new Set([...listed,...this.#unconfirmed]);
      if(!targets.size){
        if(!await this.#syncDirectories())continue;
        this.#cleanupPending=this.#stagingPending;return !this.#stagingPending;
      }
      if(pass===CLEANUP_ATTEMPTS)break;
      for(const name of targets){
        try{await this.backend.remove(name);this.#unconfirmed.delete(name);}catch{this.#unconfirmed.add(name);}
      }
    }
    this.#cleanupPending=true;return false;
  }
  /** Sync every directory still owed a confirming sync, each independently; true once none is owed. */
  async #syncDirectories():Promise<boolean>{
    for(const directory of ['manifests','blobs'] as const){
      if(!this.#unsynced.has(directory))continue;
      try{await this.backend.syncDirectory(directory);this.#unsynced.delete(directory);}catch{/* still owed; retried later */}
    }
    return !this.#unsynced.size;
  }
  /** Remove staging files; true only once the backend verifies staging is empty. Until then it stays pending and is retried at every later cleanup. */
  async #sweepStaging():Promise<boolean>{
    let cleaned=false;
    for(let attempt=0;attempt<CLEANUP_ATTEMPTS&&!cleaned;attempt++){try{await this.backend.cleanStaging();cleaned=true;}catch{/* retried below, or later */}}
    this.#stagingPending=!cleaned;return cleaned;
  }
  async #clear(mode:RetentionMode):Promise<boolean>{
    if(this.mode!=='writable')throw new Error(STORAGE_WRITE_FAILED);
    const generation=this.#generation+1,epoch=this.#epoch+1;
    const empty=this.#empty(generation,epoch,this.#revision+1,mode);
    try{
      const manifestAAD=aad.manifest(this.#workspaceID,generation);
      await this.#write(names.manifest(generation),encode(empty),manifestAAD);
      if((await this.backend.readOpened(names.manifest(generation),manifestAAD)).status!=='ok')throw new Error('Manifest verification failed.');
    }catch{throw new Error(CLEAR_FAILED);}
    // Publish the new epoch before any deletion, with no fallback predecessor. A
    // pre-clear head is never put back: an unsettled clear is completed, or reported.
    const publication=await this.#commitHead({format:WORKSPACE_FORMAT,schemaVersion:WORKSPACE_SCHEMA_VERSION,workspaceID:this.#workspaceID,generation,previousGeneration:null,deletionEpoch:epoch,retention:mode},'roll-forward');
    if(publication!=='published'){
      this.#generation=generation;
      if(publication==='uncertain'){this.mode='blocked';this.#blockedReason=null;throw new Error(CLEAR_UNCONFIRMED);}
      throw new Error(CLEAR_FAILED);
    }
    this.#generation=generation;this.#previous=generation;this.#epoch=epoch;this.#revision++;this.#fence++;
    this.#blobs.clear();this.#refsByGeneration=new Map([[generation,new Set()]]);this.#track(empty);
    // The clear is durable now. Removal of the old copies is only claimed once verified.
    return this.#collect(new Set(),new Set([generation]),{staging:true});
  }
  /**
   * Remove a workspace that could not be opened, without its key: the head first
   * (confirmed by unlink, directory sync and an independent check that it is gone), so every later crash leaves stored
   * files without a head, which launch keeps blocked and never restores. Then every
   * manifest, blob and staging file, then a new genesis head when the key allows.
   */
  async #wipe():Promise<{cleanupComplete:boolean}>{
    // A resolved remove() is not proof: the head is gone only when a remove that also
    // synced is followed by an independent query that finds no head. A head still
    // present, or of unknown presence, is never reported deleted: nothing more is
    // removed and the workspace stays blocked exactly as it was.
    let head:'gone'|'present'|'unknown'='unknown';
    for(let attempt=0;attempt<CLEANUP_ATTEMPTS&&head!=='gone';attempt++){
      let synced=true,present:boolean|null=null;
      try{await this.backend.remove(names.head);}catch{synced=false;}
      try{present=await this.backend.exists(names.head);}catch{/* unknown */}
      head=present===true?'present':present===false&&synced?'gone':'unknown';
    }
    if(head!=='gone')throw new Error(head==='present'?DELETE_FAILED:DELETE_UNCONFIRMED);
    this.#fence++;this.#head=null;this.#blockedReason=null;
    const cleanupComplete=await this.#collect(new Set(),new Set(),{confirm:true,staging:true});
    // Leftovers beside a genesis head are removed at the next launch (see #open).
    try{await this.#genesis();}catch{this.mode='unavailable';}
    return {cleanupComplete};
  }
  async #usage():Promise<WorkspaceUsage>{
    const files=await this.backend.usage(),usage:WorkspaceUsage={originals:0,results:0,records:0,pending:0,unopened:0,total:0};
    const head=this.mode==='writable'?this.#head:null;
    const generations=new Set([head?.generation,head?.previousGeneration].filter((g):g is number=>typeof g==='number'&&g>0));
    const refs=new Set([...generations].flatMap(g=>[...this.#refsByGeneration.get(g)??[]])),originals=new Set(this.#last?.originals??[]);
    for(const {name,bytes} of files){
      usage.total+=bytes;
      if(!head){usage.unopened+=bytes;continue;}
      const generation=/^manifests\/(\d+)\.atw$/.exec(name)?.[1],ref=/^blobs\/(.+)\.atw$/.exec(name)?.[1];
      if(name==='head'||(generation!==undefined&&generations.has(Number(generation))))usage.records+=bytes;
      else if(ref!==undefined&&refs.has(ref)){if(originals.has(ref))usage.originals+=bytes;else usage.results+=bytes;}
      else usage.pending+=bytes;
    }
    return usage;
  }
}
export const savedArtifacts=(checkpoint:WorkspaceCheckpoint,bytes:Map<string,Uint8Array>)=>checkpoint.artifacts.map(a=>{
  const data=bytes.get(a.ref);if(!data)throw new Error(blockedMessages['missing-artifact']);
  return {meta:{ref:a.ref,name:a.name,sizeBytes:a.sizeBytes,pageCount:a.pageCount,original:a.original,inspection:a.inspection,checksum:a.sha256,note:a.note} satisfies Artifact,bytes:data};
});
