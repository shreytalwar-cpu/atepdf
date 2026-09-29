import type {Inspection} from '@pdf/types';
export type Artifact={ref:string;name:string;sizeBytes:number;pageCount:number;original:boolean;inspection:Inspection;checksum:string;note:string};
export type StoreMark={refs:Set<string>;history:string[];originals:string[];revision:number};
export class LocalFileStore {
  #files=new Map<string,{meta:Artifact;bytes:Uint8Array}>();
  #history:string[]=[];
  #originals:string[]=[];
  revision=0;
  get focus(){return this.#history.at(-1)??null;}
  get originals(){return [...this.#originals];}
  get history(){return [...this.#history];}
  get canUndo(){return this.#history.length>1;}
  get list(){return [...this.#files.values()].map(f=>structuredClone(f.meta));}
  get retainedBytes(){return this.list.reduce((n,f)=>n+f.sizeBytes,0);}
  get(ref:string){const f=this.#files.get(ref);if(!f)throw new Error('File no longer available.');return {meta:structuredClone(f.meta),bytes:f.bytes.slice()};}
  async prepare(bytes:Uint8Array,name:string,inspection:Inspection,original:boolean,ref=`file_${crypto.randomUUID().replaceAll('-','')}`,note=''){
    // Snapshot before the first await: caller-owned buffers/metadata can still change.
    const snapshot=bytes.slice(),checked=structuredClone(inspection);
    const checksum=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(snapshot)))].map(n=>n.toString(16).padStart(2,'0')).join('');
    return {bytes:snapshot,meta:{ref,name,sizeBytes:snapshot.length,pageCount:checked.pages.length,original,inspection:checked,checksum,note}};
  }
  commit(files:Awaited<ReturnType<LocalFileStore['prepare']>>[],expectedRevision:number){
    if(this.revision!==expectedRevision)throw new Error('Files changed. Run the action again.');
    if(files.some(f=>this.#files.has(f.meta.ref))||new Set(files.map(f=>f.meta.ref)).size!==files.length)throw new Error('Output was already committed.');
    // Finish all fallible copies before exposing any part of a batch.
    const snapshots=files.map(f=>({bytes:f.bytes.slice(),meta:structuredClone(f.meta)}));
    for(const f of snapshots){this.#files.set(f.meta.ref,f);if(f.meta.original)this.#originals.push(f.meta.ref);else this.#history.push(f.meta.ref);}
    this.revision++;
  }
  undo(){if(!this.canUndo)throw new Error('No previous result.');this.#history.pop();this.revision++;}
  // A change that could not be made durable is withdrawn. The revision still
  // moves forward so a request built against the withdrawn state stays stale.
  mark():StoreMark{return {refs:new Set(this.#files.keys()),history:[...this.#history],originals:[...this.#originals],revision:this.revision};}
  rollback(mark:StoreMark){
    for(const ref of [...this.#files.keys()])if(!mark.refs.has(ref))this.#files.delete(ref);
    this.#history=[...mark.history];this.#originals=[...mark.originals];this.revision=Math.max(this.revision,mark.revision)+1;
  }
  // Restore a validated checkpoint into an empty store. The revision advances past
  // the saved one, so nothing built before relaunch can match the restored state.
  hydrate(files:{meta:Artifact;bytes:Uint8Array}[],originals:string[],history:string[],revision:number){
    if(this.#files.size||this.#originals.length||this.#history.length)throw new Error('Workspace is not empty.');
    const byRef=new Map(files.map(f=>[f.meta.ref,{bytes:f.bytes.slice(),meta:structuredClone(f.meta)}]));
    if(byRef.size!==files.length||originals.some(r=>byRef.get(r)?.meta.original!==true)||history.some(r=>byRef.get(r)?.meta.original!==false))throw new Error('Saved workspace references are inconsistent.');
    this.#files=byRef;this.#originals=[...originals];this.#history=[...history];this.revision=Math.max(this.revision,revision)+1;
  }
  clear(){this.#files.clear();this.#originals=[];this.#history=[];this.revision++;}
}
