import {readFile,mkdir,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOT,loadInputs,loadKeys,loadRecordings} from './corpus';
import {currentAdapter} from './current-adapter';
import {grade} from './graders';
import {metrics,summarize,compare} from './report';
import {CORPUS_VERSION,CATEGORIES,type Grade,type Scenario,type Observation,type CandidateConfig} from './types';

const args=process.argv.slice(2),allowed=new Set(['set','category','scenario','output-dir','adapter','config','baseline','export-dev','held-out-details','fail-on-regression']);
const options:Record<string,string|boolean>={};
for(let i=0;i<args.length;i++){
  if(!args[i].startsWith('--'))throw new Error(`Unexpected argument ${args[i]}`);
  const key=args[i].slice(2);if(!allowed.has(key)||key in options)throw new Error(`Unknown or repeated option --${key}`);
  if(['held-out-details','fail-on-regression'].includes(key))options[key]=true;
  else {const value=args[++i];if(!value||value.startsWith('--'))throw new Error(`Missing --${key} value`);options[key]=value;}
}
const set=options.set??'full';if(!['dev','held-out','full'].includes(String(set)))throw new Error('Set must be dev, held-out or full');
if(options.category&&!CATEGORIES.includes(options.category as any))throw new Error('Unknown category');
if(options['export-dev']){
  if(options.set&&set!=='dev'||options['held-out-details']||options.adapter||options.config||options.baseline)throw new Error('Dev export cannot include held-out or candidate/scoring options');
  const scenarios=await loadInputs('dev'),keys=await loadKeys('dev',scenarios);
  await writeFile(resolve(String(options['export-dev'])),JSON.stringify({corpusVersion:CORPUS_VERSION,split:'dev',scenarios,keys:[...keys.values()]},null,2)+'\n',{flag:'wx'});
  process.stdout.write('Exported dev tuning data only.\n');process.exit(0);
}
const config:CandidateConfig=options.config?JSON.parse(await readFile(resolve(String(options.config)),'utf8')):{};
const configFields=new Set(['systemPrompt','developerPrompt','toolDescriptions','clarificationPolicy','model','effort','routingPolicy']);
if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).some(k=>!configFields.has(k)))throw new Error('Unknown candidate configuration field');
for(const [k,v] of Object.entries(config))if(k==='toolDescriptions'?(!v||typeof v!=='object'||Array.isArray(v)||Object.values(v).some(x=>typeof x!=='string')):typeof v!=='string')throw new Error(`Invalid candidate configuration ${k}`);
if(!options.adapter&&Object.keys(config).length)throw new Error('Current baseline is fixed; candidate config requires --adapter');
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const hashFiles=async(paths:string[])=>Object.fromEntries(await Promise.all(paths.sort().map(async path=>[path,hash(await readFile(path))])));
const corpusPaths=['split.json','scenario.schema.json','expectation.schema.json','scenarios/inputs.json','scenarios/keys.json','fixtures/recordings.json','held-out/inputs.json','held-out/scoring/keys.json','held-out/scoring/recordings.json'].map(path=>join(ROOT,path));
const corpusHashes=await hashFiles(corpusPaths);
const runtimePaths=['packages/contracts/src/protocol.ts','packages/contracts/schemas/planner-response.schema.json','packages/contracts/schemas/planner-request.schema.json','packages/contracts/schemas/gateway-envelope.schema.json','packages/contracts/schemas/operation-registry.json','packages/planner/src/generated/product-knowledge.ts','pnpm-lock.yaml','packages/contracts/src/generated/request.js','packages/contracts/src/generated/response.js','packages/contracts/src/generated/envelope.js','packages/planner/src/provider.ts','packages/planner/src/request.ts','packages/planner/src/privacy.ts','packages/planner/src/schema.ts','packages/planner/src/clarification.ts','packages/planner/src/gateway.ts','packages/planner/src/reply.ts','packages/core/src/job-controller.ts','packages/core/src/local-file-store.ts'];
const runtimeHashes=await hashFiles(runtimePaths);
const harnessHashes=await hashFiles((await readdir(ROOT)).filter(p=>/\.(ts|mts)$/.test(p)).map(p=>join(ROOT,p)));
function portable(hashes:Record<string,string>){return Object.fromEntries(Object.entries(hashes).map(([path,value])=>[path.startsWith(ROOT)?path.slice(ROOT.length):path,value]));}
const corpusPortable=portable(corpusHashes),harnessPortable=portable(harnessHashes);
const report:any={reportVersion:'1.0',corpusVersion:CORPUS_VERSION,splitVersion:'1.0.0',adapter:options.adapter?`candidate:${String(options.adapter)}`:'current-mocked-v1',configuration:config,provenance:{runtimeHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runtimeBaseHead:execFileSync('git',['merge-base','HEAD','origin/main'],{encoding:'utf8'}).trim(),harnessHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,corpusHash:hash(JSON.stringify(corpusPortable)),corpusHashes:corpusPortable,runtimeHashes,harnessHashes:harnessPortable},sets:{}};
if(options.adapter)report.provenance.adapterHash=hash(await readFile(resolve(String(options.adapter))));
async function candidate(scenario:Scenario):Promise<Observation>{
  return new Promise((done,reject)=>{
    const child=spawn(process.execPath,['--import','tsx',fileURLToPath(new URL('./candidate-worker.mts',import.meta.url)),resolve(String(options.adapter))],{env:{PATH:process.env.PATH,NODE_ENV:'test',TSX_TSCONFIG_PATH:resolve('tsconfig.json')},stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='',settled=false;
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Candidate adapter timed out'));},30_000);
    child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>2_000_000){child.kill();reject(new Error('Oversized candidate observation'));}});
    child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(0,2000);});
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('exit',code=>{clearTimeout(timer);if(settled)return;settled=true;if(code!==0){reject(new Error(`Candidate failed (exit ${code}); details suppressed to avoid leaking prompt data`));return;}try{done(JSON.parse(stdout));}catch{reject(new Error('Candidate must emit exactly one observation JSON'));}});
    child.stdin.end(JSON.stringify({scenario,config}));
  });
}
for(const split of (set==='full'?['dev','held-out']:[set]) as ('dev'|'held-out')[]){
  const all=await loadInputs(split),scenarios=all.filter(s=>(!options.category||s.category===options.category)&&(!options.scenario||s.id===options.scenario));
  if(!scenarios.length)continue;
  const adapter=options.adapter?null:currentAdapter(await loadRecordings(split));
  // Candidate process never receives grading keys or recordings. Collect first, load keys second.
  const observations:Observation[]=[];
  for(const scenario of scenarios){const observed=adapter?await adapter.evaluate(scenario,{}):await candidate(scenario);validateObservation(observed,scenario);observations.push(observed);}
  const keys=await loadKeys(split,scenarios);
  const grades=scenarios.map((scenario,i)=>grade(scenario,keys.get(scenario.id)!,observations[i]));
  const categoryMetrics=Object.fromEntries(CATEGORIES.map(category=>[category,metrics(grades.filter(g=>g.category===category))]).filter(([,m])=>(m as any).scenarios>0));
  report.sets[split]={selectionHash:hash(JSON.stringify(scenarios.map(s=>s.id))),metrics:metrics(grades),categories:categoryMetrics,...(split==='dev'||options['held-out-details']?{details:grades}:{})};
}
if(!Object.keys(report.sets).length)throw new Error('No scenarios matched; this is not a passing eval');
if(options.baseline)report.comparison=compare(report,JSON.parse(await readFile(resolve(String(options.baseline)),'utf8')));
if(options['output-dir']){
  const dir=resolve(String(options['output-dir']));await mkdir(dir,{recursive:true});
  await writeFile(join(dir,'results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  await writeFile(join(dir,'summary.md'),summarize(report),{flag:'wx'});
}
process.stdout.write(JSON.stringify(report,null,2)+'\n');
if(options['fail-on-regression']&&report.comparison&&!report.comparison.accepted)process.exitCode=1;
function validateObservation(value:any,scenario:Scenario):asserts value is Observation{
  if(!value||value.id!==scenario.id||!Array.isArray(value.turns)||value.turns.length!==scenario.turns.length)throw new Error('Invalid candidate observation identity/turn count');
  for(const turn of value.turns){
    if(!turn||typeof turn.status!=='string'||!('rawResponse' in turn)||!('request' in turn)||!('reasonCode' in turn)||!('rejection' in turn)||!('control' in turn)||!('focus' in turn)||!('pendingInstruction' in turn)||typeof turn.accepted!=='boolean'||!Number.isSafeInteger(turn.providerCalls)||turn.providerCalls<0||!Array.isArray(turn.outbound)||!Array.isArray(turn.toolInvocations)||typeof turn.qualityConfirmation!=='boolean'||!Number.isSafeInteger(turn.revision))throw new Error('Malformed candidate observation');
    for(const step of turn.toolInvocations)if(!step||typeof step.operation!=='string'||!Array.isArray(step.inputs))throw new Error('Malformed tool invocation');
    for(const event of turn.outbound)if(!event||!['command','content'].includes(event.kind)||typeof event.recipient!=='string'||!('payload' in event))throw new Error('Malformed outbound trace');
  }
}
