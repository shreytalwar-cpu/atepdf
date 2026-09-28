import type {Inspection} from '@pdf/types';
export type Artifact={ref:string;name:string;sizeBytes:number;pageCount:number;original:boolean;inspection:Inspection;checksum:string;note:string};
export class LocalFileStore {
  #files=new Map<string,{meta:Artifact;bytes:Uint8Array}>();
  #history:string[]=[];
  #originals:string[]=[];
  revision=0;
  get focus(){return this.#history.at(-1)??null;}
  get originals(){return [...this.#originals];}
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
  clear(){this.#files.clear();this.#originals=[];this.#history=[];this.revision++;}
}
