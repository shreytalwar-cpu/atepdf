import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import {CORPUS_VERSION,type Scenario,type AnswerKey,type Recording} from './types';
export const ROOT=fileURLToPath(new URL('.',import.meta.url));
const json=async(path:string)=>JSON.parse(await readFile(join(ROOT,path),'utf8'));
export async function loadInputs(split:'dev'|'held-out'):Promise<Scenario[]>{
  const manifest=await json('split.json');
  if(manifest.corpusVersion!==CORPUS_VERSION||manifest.splitVersion!=='1.0.0'||manifest.algorithm!=='explicit-family-manifest-v1')throw new Error('Unknown corpus/split version');
  const all=[...manifest.dev,...manifest.heldOut];if(new Set(all).size!==all.length)throw new Error('Split overlaps or contains duplicate IDs');
  const input=await json(split==='dev'?'scenarios/inputs.json':'held-out/inputs.json');
  const validator=new Ajv2020({strict:true,allErrors:true}).compile<{corpusVersion:string;scenarios:Scenario[]}>(await json('scenario.schema.json'));
  if(!validator(input))throw new Error(`Invalid ${split} inputs: ${JSON.stringify(validator.errors)}`);
  const expectedIDs=split==='dev'?manifest.dev:manifest.heldOut;
  if(JSON.stringify(input.scenarios.map((s:Scenario)=>s.id))!==JSON.stringify(expectedIDs))throw new Error('Split manifest does not match input IDs/order');
  for(const scenario of input.scenarios as Scenario[]){
    if(scenario.family!==scenario.id)throw new Error('v1 independent family manifest expects unique family IDs');
    for(const context of [scenario.context,...scenario.turns.flatMap(t=>t.context?[t.context]:[])]){
      const refs=context.files.map(f=>f.ref);
      if(new Set(refs).size!==refs.length||[...context.selectionRefs,...context.originalRefs,...context.history].some(ref=>!refs.includes(ref)))throw new Error(`Invalid local refs in ${scenario.id}`);
    }
    for(const turn of scenario.turns)if(turn.event!=='submit'&&!turn.action)throw new Error(`Missing action in ${scenario.id}`);
  }
  return input.scenarios;
}
/** Only the scoring runner calls this after observations have been collected. */
export async function loadKeys(split:'dev'|'held-out',scenarios:Scenario[]):Promise<Map<string,AnswerKey>>{
  const input=await json(split==='dev'?'scenarios/keys.json':'held-out/scoring/keys.json');
  const validator=new Ajv2020({strict:true,allErrors:true}).compile<{corpusVersion:string;keys:AnswerKey[]}>(await json('expectation.schema.json'));
  if(!validator(input))throw new Error(`Invalid ${split} answer-key file`);
  const map=new Map<string,AnswerKey>(input.keys.map((key:AnswerKey)=>[key.id,key]));
  if(map.size!==input.keys.length)throw new Error('Duplicate answer key');
  for(const scenario of scenarios){
    const key=map.get(scenario.id);
    if(!key||key.turns.length!==scenario.turns.length)throw new Error(`Missing or mismatched answer key ${scenario.id}`);
    for(const turn of key.turns){
      if(turn.clarify!==(turn.status==='clarify'))throw new Error('Inconsistent clarification expectation');
      const plan=turn.plan as any;
      if(plan&&(!Array.isArray(plan.steps)||!plan.steps.length||!Array.isArray(plan.resultRefs)||plan.steps.some((step:any)=>!step||typeof step.operation!=='string'||!Array.isArray(step.inputs)||step.inputs.some((ref:any)=>typeof ref!=='string')||typeof step.outputRef!=='string'||!step.params||typeof step.params!=='object')))throw new Error('Malformed expected plan graph');
    }
  }
  return map;
}
export async function loadRecordings(split:'dev'|'held-out'):Promise<Record<string,Recording>>{
  return (await json(split==='dev'?'fixtures/recordings.json':'held-out/scoring/recordings.json')).responses;
}
