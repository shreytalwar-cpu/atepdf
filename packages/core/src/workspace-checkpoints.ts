import {StaleSaveError} from './workspace-vault';

/**
 * Work that starts in one workspace and completes later: a file picker, sample
 * loading or a drop that has not been imported yet. Start over, expiry and Delete
 * local data advance the session as they begin, so a completion that arrives
 * afterwards finds its ticket stale and is discarded: nothing is imported, added to
 * the conversation or saved into the emptied workspace.
 */
export class WorkspaceSession{
  #id=0;
  /** Invalidate every ticket issued so far. */
  advance(){this.#id++;}
  /** A check that stays true only while the workspace has not been emptied since. */
  ticket(){const id=this.#id;return ()=>id===this.#id;}
}

// Schedules chat and draft checkpoints (ADR 0010: committed chat changes are saved
// promptly; draft changes are coalesced). Start over runs inside `exclusive`: no
// chat or draft checkpoint is scheduled or fired until it settles, pending draft
// timers are cancelled, and the caller resets its chat/draft view before
// checkpointing resumes. The vault also refuses saves from an older epoch.
export class CheckpointScheduler{
  #suspended=false;
  #timer:ReturnType<typeof setTimeout>|null=null;
  constructor(private run:()=>Promise<unknown>,private onError:(error:unknown)=>void,private draftDelay=800){}
  get suspended(){return this.#suspended;}
  get draftPending(){return this.#timer!==null;}
  /** A committed chat change: checkpoint now (the latest draft rides along). */
  now(){if(this.#suspended)return;this.#cancel();this.#fire();}
  /** A draft change: checkpoint after a quiet period. */
  draft(){if(this.#suspended)return;this.#cancel();this.#timer=setTimeout(()=>{this.#timer=null;if(!this.#suspended)this.#fire();},this.draftDelay);}
  /** Run work (Start over) with chat/draft checkpointing suspended throughout. */
  async exclusive<T>(work:()=>Promise<T>):Promise<T>{
    if(this.#suspended)throw new Error('A workspace change is already in progress.');
    this.#suspended=true;this.#cancel();
    try{return await work();}finally{this.#suspended=false;}
  }
  dispose(){this.#cancel();}
  #cancel(){if(this.#timer){clearTimeout(this.#timer);this.#timer=null;}}
  #fire(){
    // Saves belonging to a cleared epoch are dropped by design, not reported.
    void Promise.resolve().then(this.run).catch(error=>{if(!(error instanceof StaleSaveError))this.onError(error);});
  }
}
