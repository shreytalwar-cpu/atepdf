import type {Inspection} from '@pdf/types';

// Durable workspace schema (ADR 0010). This file is the allowlist: only the
// fields named here are ever written, and parsing rejects anything else.
// Nothing executable (requests, envelopes, confirmations, jobs, grants, tokens,
// passwords or secure-field values) has a place in this schema.
export const WORKSPACE_FORMAT='atepdf.workspace';
export const WORKSPACE_SCHEMA_VERSION=1;
export const RETENTION_MODES=['keep','30d','7d','quit'] as const;
export type RetentionMode=typeof RETENTION_MODES[number];
// Display-only record of a question that was asked. Restored questions are
// always closed; the choice kind never re-arms an action after relaunch.
export const CLOSED_CHOICES=['compress','chain','clear','execute','connect','native-link','native-pair','connection-help'] as const;
export type ClosedChoice=typeof CLOSED_CHOICES[number];
export type PersistedEntry={id:number;role:'user'|'assistant';text:string;files?:{name:string;size:number}[];artifactRef?:string;resultTitle?:string;choice?:ClosedChoice};
export type PersistedArtifact={ref:string;name:string;sizeBytes:number;pageCount:number;sha256:string;original:boolean;note:string;inspection:Inspection;blobGeneration:number};
// Reserved for validated result collections (SHR-54). v1 writes none.
export type PersistedCollection={id:string;refs:string[]};
export type WorkspaceCheckpoint={
  format:typeof WORKSPACE_FORMAT;schemaVersion:number;workspaceID:string;generation:number;revision:number;deletionEpoch:number;
  savedAt:string;lastActivityAt:string;retention:{mode:RetentionMode};
  artifacts:PersistedArtifact[];originals:string[];history:string[];focus:string|null;undoPredecessor:string|null;selection:string[];collections:PersistedCollection[];
  conversation:PersistedEntry[];draft:{text:string}|null;
};
export type WorkspaceHead={format:typeof WORKSPACE_FORMAT;schemaVersion:number;workspaceID:string;generation:number;previousGeneration:number|null;deletionEpoch:number};

export const LIMITS={artifacts:200,entries:5000,text:20_000,name:512,files:20,pages:5000,blobBytes:2_000_000_000};
export const REF=/^(file|out)_[A-Za-z0-9_]{1,64}$/;
const ID=/^[a-f0-9-]{36}$/;
const HASH=/^[a-f0-9]{64}$/;
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export type CheckpointErrorKind='invalid'|'unsupported-schema';
export class CheckpointError extends Error{constructor(readonly kind:CheckpointErrorKind,message:string){super(message);this.name='CheckpointError';}}
const invalid=(what:string):never=>{throw new CheckpointError('invalid',`Saved workspace is invalid: ${what}.`);};

type Obj=Record<string,unknown>;
function record(value:unknown,what:string,required:string[],optional:string[]=[]):Obj{
  if(!value||typeof value!=='object'||Array.isArray(value))invalid(what);
  const o=value as Obj,allowed=new Set([...required,...optional]);
  for(const key of Object.keys(o))if(!allowed.has(key))invalid(`${what} has unexpected field`);
  for(const key of required)if(!(key in o))invalid(`${what} is incomplete`);
  return o;
}
const int=(v:unknown,what:string,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max?v:invalid(what);
const num=(v:unknown,what:string)=>typeof v==='number'&&Number.isFinite(v)?v:invalid(what);
const str=(v:unknown,what:string,max=LIMITS.text)=>typeof v==='string'&&v.length<=max?v:invalid(what);
const bool=(v:unknown,what:string)=>typeof v==='boolean'?v:invalid(what);
const ref=(v:unknown,what:string)=>typeof v==='string'&&REF.test(v)?v:invalid(what);
const time=(v:unknown,what:string)=>typeof v==='string'&&ISO.test(v)&&!Number.isNaN(Date.parse(v))?v:invalid(what);
const list=(v:unknown,what:string,max:number)=>Array.isArray(v)&&v.length<=max?v as unknown[]:invalid(what);
const oneOf=<T extends string>(v:unknown,values:readonly T[],what:string)=>values.includes(v as T)?v as T:invalid(what);
const unique=(values:string[],what:string)=>{if(new Set(values).size!==values.length)invalid(`${what} repeats a reference`);return values;};

function schemaVersion(v:unknown){
  const version=int(v,'schema version',1);
  if(version>WORKSPACE_SCHEMA_VERSION)throw new CheckpointError('unsupported-schema','This workspace was saved by a newer version of atePDF.');
  return version;
}
function inspection(v:unknown,what:string):Inspection{
  const o=record(v,what,['pages']);
  return {pages:list(o.pages,what,LIMITS.pages).map(p=>{const page=record(p,what,['text','width','height','rotation']);return {text:str(page.text,what,1_000_000),width:num(page.width,what),height:num(page.height,what),rotation:num(page.rotation,what)};})};
}

export function parseHead(value:unknown):WorkspaceHead{
  const o=record(value,'head',['format','schemaVersion','workspaceID','generation','previousGeneration','deletionEpoch']);
  if(o.format!==WORKSPACE_FORMAT)invalid('head format');
  const version=schemaVersion(o.schemaVersion);
  // Generation 0 is the genesis head: written before any user data exists, it
  // names no manifest. Its presence proves later files were never committed.
  const generation=int(o.generation,'head generation',0);
  let previous:number|null=null;
  if(o.previousGeneration!==null){if(generation===0)invalid('genesis predecessor');previous=int(o.previousGeneration,'previous generation',1,generation-1);}
  return {format:WORKSPACE_FORMAT,schemaVersion:version,workspaceID:typeof o.workspaceID==='string'&&ID.test(o.workspaceID)?o.workspaceID:invalid('workspace ID'),generation,previousGeneration:previous,deletionEpoch:int(o.deletionEpoch,'deletion epoch')};
}

// Strict parse and cross-reference validation. A checkpoint that passes is
// internally consistent; blob contents are verified separately by the vault.
export function parseCheckpoint(value:unknown):WorkspaceCheckpoint{
  const o=record(value,'checkpoint',['format','schemaVersion','workspaceID','generation','revision','deletionEpoch','savedAt','lastActivityAt','retention','artifacts','originals','history','focus','undoPredecessor','selection','collections','conversation','draft']);
  if(o.format!==WORKSPACE_FORMAT)invalid('format');
  const version=schemaVersion(o.schemaVersion);
  const retention=record(o.retention,'retention',['mode']);
  const mode=oneOf(retention.mode,RETENTION_MODES,'retention mode');
  // Delete-when-quit never writes durable state, so a durable copy of it is unsafe.
  if(mode==='quit')invalid('ephemeral workspace was written durably');
  const generation=int(o.generation,'generation',1);
  const artifacts=list(o.artifacts,'artifacts',LIMITS.artifacts).map((a,i):PersistedArtifact=>{
    const x=record(a,`artifact ${i+1}`,['ref','name','sizeBytes','pageCount','sha256','original','note','inspection','blobGeneration']);
    const checked=inspection(x.inspection,'artifact inspection'),pageCount=int(x.pageCount,'page count',1,LIMITS.pages);
    if(checked.pages.length!==pageCount)invalid('artifact page count');
    return {ref:ref(x.ref,'artifact ref'),name:str(x.name,'artifact name',LIMITS.name),sizeBytes:int(x.sizeBytes,'artifact size',1,LIMITS.blobBytes),pageCount,sha256:typeof x.sha256==='string'&&HASH.test(x.sha256)?x.sha256:invalid('artifact hash'),original:bool(x.original,'artifact kind'),note:str(x.note,'artifact note'),inspection:checked,blobGeneration:int(x.blobGeneration,'blob generation',1,generation)};
  });
  const byRef=new Map(artifacts.map(a=>[a.ref,a]));
  if(byRef.size!==artifacts.length)invalid('artifact refs repeat');
  const refs=(v:unknown,what:string,max=LIMITS.artifacts)=>unique(list(v,what,max).map(r=>ref(r,what)),what);
  const originals=refs(o.originals,'originals'),history=refs(o.history,'history');
  if(originals.length>LIMITS.files||originals.some(r=>byRef.get(r)?.original!==true))invalid('original order');
  if(artifacts.some(a=>a.original&&!originals.includes(a.ref)))invalid('unordered original');
  if(history.some(r=>byRef.get(r)?.original!==false))invalid('result history');
  const focus=o.focus===null?null:ref(o.focus,'focus'),predecessor=o.undoPredecessor===null?null:ref(o.undoPredecessor,'Undo predecessor');
  if(focus!==(history.at(-1)??null))invalid('focus is not the current result');
  if(predecessor!==(history.at(-2)??null))invalid('Undo predecessor');
  const selection=refs(o.selection,'selection');
  if(selection.some(r=>!byRef.has(r)))invalid('selection');
  const collections=list(o.collections,'collections',LIMITS.artifacts).map((c,i)=>{
    const x=record(c,`collection ${i+1}`,['id','refs']);const members=refs(x.refs,'collection');
    if(!members.length||members.some(r=>byRef.get(r)?.original!==false))invalid('collection members');
    return {id:str(x.id,'collection ID',80),refs:members};
  });
  const ids=new Set<number>();
  const conversation=list(o.conversation,'conversation',LIMITS.entries).map((e,i):PersistedEntry=>{
    const x=record(e,`conversation entry ${i+1}`,['id','role','text'],['files','artifactRef','resultTitle','choice']);
    const id=int(x.id,'entry ID',1);if(ids.has(id))invalid('entry IDs repeat');ids.add(id);
    const entry:PersistedEntry={id,role:oneOf(x.role,['user','assistant'] as const,'entry role'),text:str(x.text,'entry text')};
    if(x.files!==undefined)entry.files=list(x.files,'entry files',LIMITS.files).map(f=>{const file=record(f,'entry file',['name','size']);return {name:str(file.name,'file name',LIMITS.name),size:int(file.size,'file size')};});
    if(x.artifactRef!==undefined){entry.artifactRef=ref(x.artifactRef,'entry artifact');if(!byRef.has(entry.artifactRef))invalid('entry refers to a missing PDF');}
    if(x.resultTitle!==undefined)entry.resultTitle=str(x.resultTitle,'result title',LIMITS.name);
    if(x.choice!==undefined)entry.choice=oneOf(x.choice,CLOSED_CHOICES,'entry choice');
    return entry;
  });
  const draft=o.draft===null?null:{text:str(record(o.draft,'draft',['text']).text,'draft')};
  const savedAt=time(o.savedAt,'saved time'),lastActivityAt=time(o.lastActivityAt,'activity time');
  return {format:WORKSPACE_FORMAT,schemaVersion:version,workspaceID:typeof o.workspaceID==='string'&&ID.test(o.workspaceID)?o.workspaceID:invalid('workspace ID'),generation,revision:int(o.revision,'revision'),deletionEpoch:int(o.deletionEpoch,'deletion epoch'),
    savedAt,lastActivityAt,retention:{mode},artifacts,originals,history,focus,undoPredecessor:predecessor,selection,collections,conversation,draft};
}

// Associated data binds every sealed file to its format, workspace, role and
// generation, so a file copied to another name or workspace fails to open.
export const aad={
  head:()=>`${WORKSPACE_FORMAT}/v1|head`,
  manifest:(workspaceID:string,generation:number)=>`${WORKSPACE_FORMAT}/v1|manifest|${workspaceID}|${generation}`,
  blob:(workspaceID:string,ref:string,generation:number)=>`${WORKSPACE_FORMAT}/v1|pdf|${workspaceID}|${ref}|${generation}`,
};
export const names={head:'head',manifest:(generation:number)=>`manifests/${generation}.atw`,blob:(ref:string)=>`blobs/${ref}.atw`};
export const NAME=/^(?:head|manifests\/[1-9][0-9]{0,14}\.atw|blobs\/(?:file|out)_[A-Za-z0-9_]{1,64}\.atw)$/;
