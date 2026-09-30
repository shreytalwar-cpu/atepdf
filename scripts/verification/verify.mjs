import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,openSync,closeSync,rmSync,readdirSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.argv[2]||'all';
if(!['all','core','browser','failures','native'].includes(mode))throw new Error('Usage: node scripts/verification/verify.mjs [all|core|browser|failures|native]');
const git=(...args)=>{
  const result=spawnSync('git',args,{cwd:root,encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr||'Git failed');return result.stdout.trim();
};
if(git('status','--porcelain','--untracked-files=all'))throw new Error('Verification requires a clean committed checkout. Commit changes or use a dedicated worktree. Ignored outputs are never copied.');
const commit=git('rev-parse','HEAD');
if(process.env.VERIFY_EXPECTED_SHA&&process.env.VERIFY_EXPECTED_SHA!==commit)throw new Error('Checkout does not match VERIFY_EXPECTED_SHA');
const manifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
if(process.version!==`v${manifest.engines.node}`)throw new Error(`Use Node ${manifest.engines.node}; got ${process.version}`);
const pm=spawnSync('pnpm',['--version'],{cwd:root,encoding:'utf8'});
if(pm.status!==0||pm.stdout.trim()!==manifest.engines.pnpm)throw new Error(`Use plain pnpm ${manifest.engines.pnpm} on PATH. Disable wrappers that switch versions or install on script invocation.`);
const reportDir=join(root,'.build/verification',`${mode}-${commit.slice(0,12)}-${Date.now()}`);
mkdirSync(reportDir,{recursive:true});
const scratch=mkdtempSync(join(tmpdir(),'atepdf-verify-'));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const record={commit,mode,startedAt:new Date().toISOString(),node:process.version,pnpm:pm.stdout.trim(),
  platform:process.platform,architecture:process.arch,workflow:process.env.GITHUB_WORKFLOW_REF||null,
  workflowCommit:process.env.GITHUB_WORKFLOW_SHA||null,prHead:process.env.VERIFY_PR_HEAD_SHA||null,
  runID:process.env.GITHUB_RUN_ID||null,files:{},commands:[],passed:false};
const env={...process.env,CI:'true',EXPO_NO_TELEMETRY:'1',NEXT_TELEMETRY_DISABLED:'1',
  OPENAI_API_KEY:'',ATEPDF_BASE_URL:'',ATEPDF_CORPUS_PYTHON:'',
  PATH:`${dirname(process.execPath)}:${process.env.PATH}`};
function run(name,command,args,{cwd=scratch,timeout=600_000,expectFailure=false,diagnostic}={}){
  console.log(`Verification: ${name}`);
  const log=join(reportDir,`${record.commands.length+1}-${name}.log`);
  const fd=openSync(log,'w');const started=Date.now();
  const result=spawnSync(command,args,{cwd,env,stdio:['ignore',fd,fd],timeout,killSignal:'SIGTERM'});closeSync(fd);
  const entry={name,command:[command,...args],cwd:cwd===scratch?'isolated committed snapshot':cwd,
    exitCode:result.status,signal:result.signal,error:result.error?.message||null,elapsedMs:Date.now()-started,
    expectFailure,log:log.slice(reportDir.length+1),logSha256:sha256(readFileSync(log))};
  record.commands.push(entry);
  const output=readFileSync(log,'utf8');
  if(result.error||result.signal||result.status===null||(expectFailure?result.status===0:result.status!==0)||diagnostic&&!output.includes(diagnostic)){
    console.error(output.slice(-6000));throw new Error(`${name} did not meet its expected result; see ${log}`);
  }
  console.log(`  ${expectFailure?'Rejected as intended':'Passed'} (${entry.elapsedMs} ms)`);
  if(output.trim())console.log(output.slice(-3000));
}
const node=(name,args,options)=>run(name,process.execPath,args,options);
function typechecks(){
  for(const [name,config]of [['web','apps/web/tsconfig.json'],['universal','apps/universal/tsconfig.json'],['compatibility','tests/compatibility/tsconfig.json']])
    node(`typescript-${name}`,['node_modules/typescript/bin/tsc','--noEmit','--incremental','false','-p',config]);
}
function contracts(){node('generated-contracts',['scripts/contracts.mjs','--check']);node('generated-knowledge',['scripts/embed-product-knowledge.mjs','--check']);node('schemas-catalogue-evals',['--import','tsx','scripts/verification/schemas.mts']);}
try{
  const archive=join(reportDir,'source.tar');const fd=openSync(archive,'w');
  const exported=spawnSync('git',['archive','--format=tar',commit],{cwd:root,stdio:['ignore',fd,'pipe']});closeSync(fd);
  if(exported.status!==0)throw new Error('Cannot export the exact committed source');
  record.archiveSha256=sha256(readFileSync(archive));
  run('export-source','tar',['-xf',archive,'-C',scratch]);rmSync(archive);
  for(const path of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','.node-version','.npmrc',
    'scripts/verification/verify.mjs','scripts/verification/schemas.mts','scripts/verification/browser.mjs',
    'scripts/verification/playwright.config.mts','scripts/contracts.mjs','scripts/embed-product-knowledge.mjs',
    '.github/workflows/verify.yml'])record.files[path]=sha256(readFileSync(join(scratch,path)));
  run('frozen-install','pnpm',['install','--frozen-lockfile']);
  if(mode==='all'||mode==='core'){
    contracts();typechecks();
    const tests=readdirSync(join(scratch,'tests/regressions')).filter(file=>file.endsWith('.test.ts')).sort().map(file=>`tests/regressions/${file}`);
    node('shared-core-regressions',['--import','tsx','--test',...tests]);
    node('beta-unit-tests',['--test','scripts/beta/beta.test.mjs']);
    // Syntax-check all added JavaScript, including code not selected by this mode.
    for(const file of ['verify','browser'])node(`syntax-${file}`,['--check',`scripts/verification/${file}.mjs`]);
  }
  if(mode==='all'||mode==='browser'){
    contracts();
    // Downloads only the locked Playwright browser. Linux OS libraries are runner prerequisites.
    run('playwright-browser','pnpm',['exec','playwright','install','chromium']);
    node('engine-assets',['scripts/assets.mjs']);
    node('expo-web-export',['node_modules/expo/bin/cli','export','--platform','web','--output-dir','dist-web'],{cwd:join(scratch,'apps/universal')});
    node('web-budget',['scripts/check-web-budget.mjs']);
    node('safe-browser-checks',['scripts/verification/browser.mjs'],{timeout:900_000});
    const output=join(scratch,'.build/verification-browser.json');
    record.browser=JSON.parse(readFileSync(output,'utf8'));
  }
  if(mode==='failures'){
    contracts();typechecks();
    async function mutate(name,path,change,args,diagnostic){
      const full=join(scratch,path),before=readFileSync(full);const after=change(before.toString());writeFileSync(full,after);
      record.commands.push({name:`mutation-${name}`,path,beforeSha256:sha256(before),afterSha256:sha256(after)});
      try{node(name,args,{expectFailure:true,diagnostic});}finally{writeFileSync(full,before);}
    }
    await mutate('reject-typescript','packages/core/src/local-file-store.ts',s=>s+'\nconst shr90IntentionalTypeError: string = 90;\n',
      ['node_modules/typescript/bin/tsc','--noEmit','--incremental','false','-p','apps/web/tsconfig.json'],'TS2322');
    await mutate('reject-schema-drift','packages/contracts/schemas/planner-request.schema.json',s=>{const value=JSON.parse(s);value.properties.locale.maxLength=99;return JSON.stringify(value);},
      ['scripts/contracts.mjs','--check'],'Generated contract is stale');
    await mutate('reject-stale-validator','packages/contracts/src/generated/request.js',s=>s+'\n// deliberate stale generated file\n',
      ['scripts/contracts.mjs','--check'],'Generated contract is stale');
    await mutate('reject-stale-knowledge','packages/planner/src/generated/product-knowledge.ts',s=>s+'\n// deliberate drift\n',
      ['scripts/embed-product-knowledge.mjs','--check'],'embedding is stale');
    await mutate('reject-catalogue','packages/contracts/schemas/operation-registry.json',s=>{const value=JSON.parse(s);delete value.operations[0].parameters;return JSON.stringify(value);},
      ['--import','tsx','scripts/verification/schemas.mts'],'Malformed catalogue entry');
    await mutate('reject-manifest','tests/fixtures/corpus/manifest.json',s=>{const value=JSON.parse(s);value.fixtures[0].sha256='invalid';return JSON.stringify(value);},
      ['--import','tsx','scripts/verification/schemas.mts'],'manifest.json');
    await mutate('reject-regression','tests/regressions/commerce.test.ts',s=>s+"\ntest('SHR-90 deliberate failure',()=>assert.fail('SHR90_SENTINEL'));\n",
      ['--import','tsx','--test','tests/regressions/commerce.test.ts'],'SHR90_SENTINEL');
    contracts();typechecks();
    node('restored-regression',['--import','tsx','--test','tests/regressions/commerce.test.ts']);
  }
  if(mode==='native'){
    if(process.platform!=='darwin')throw new Error('Native checks require macOS with selected Xcode; this is not an optional skip.');
    contracts();run('xcode-version','xcodebuild',['-version']);
    node('apple-helper',['tests/native/apple/run.mjs']);
    run('swift-planner-compile','xcrun',['swiftc','-module-cache-path',join(scratch,'.build/swift-cache'),'-parse-as-library',
      'apps/universal/modules/atepdf-planner/ios/AtepdfPlannerTransport.swift','tests/native/planner/main.swift','-o',join(scratch,'.build/native-planner-tests')]);
    // Fixed-port Swift transport execution remains an explicit isolated manual step.
  }
  record.passed=true;
}catch(error){record.error=error.message;process.exitCode=1;console.error(error.message);}
finally{
  record.finishedAt=new Date().toISOString();
  const {browser,...compact}=record;console.log(JSON.stringify({...compact,browserStats:browser?.report?.stats||null},null,2));
  writeFileSync(join(reportDir,'report.json'),JSON.stringify(record,null,2)+'\n');
  if(process.env.GITHUB_STEP_SUMMARY)writeFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## ${mode}: ${record.passed?'passed':'failed'}\n\nVerified commit: \`${commit}\`\n\nWorkflow: \`${record.workflow}\` at \`${record.workflowCommit}\`\n\nCommand: \`node scripts/verification/verify.mjs ${mode}\`\n\n`+
    record.commands.map(entry=>`- ${entry.name}: ${entry.exitCode===undefined?'mutation':`exit ${entry.exitCode}`}`).join('\n')+'\n',{flag:'a'});
  rmSync(scratch,{recursive:true,force:true});console.log(`Source-bound evidence: ${join(reportDir,'report.json')}`);
}
