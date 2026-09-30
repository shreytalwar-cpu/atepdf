import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,openSync,closeSync,rmSync,readdirSync,existsSync,realpathSync,statSync,accessSync,constants} from 'node:fs';
import {dirname,join,resolve,delimiter,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';

import {childEnvironment,assertEvidence} from './policy.mjs';
import {runChild} from './process.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.argv[2]||'all';
// Supported verification hosts are macOS and Ubuntu. Use fixed system tools,
// resolve the explicitly provisioned pnpm once, and give children a bounded PATH.
const gitBin='/usr/bin/git',tarBin='/usr/bin/tar';
function packageManagerExecutable(){
  for(const directory of (process.env.PATH||'').split(delimiter)){
    if(!isAbsolute(directory)||directory===root)continue;
    const candidate=join(directory,'pnpm');
    try{
      if(statSync(directory).mode&0o022)continue;
      accessSync(candidate,constants.X_OK);const path=realpathSync(candidate);
      if(!statSync(path).isFile()||statSync(path).mode&0o022)continue;
      if(/^#![^\n]*\b(?:ba|z|da)?sh\b/.test(readFileSync(path,'utf8').slice(0,200)))continue;
      return {path,directory};
    }catch{ /* Try the next explicitly provisioned runtime directory. */ }
  }
  throw new Error('Provision pnpm 11.19.0 in a trusted absolute directory on PATH (not group/world writable).');
}
const pnpmTool=packageManagerExecutable(),pnpmBin=pnpmTool.path;
const toolPath=[dirname(process.execPath),pnpmTool.directory,dirname(pnpmBin),'/usr/bin','/bin','/usr/sbin','/sbin'].join(delimiter);
const toolEnv=childEnvironment(process.env,toolPath);
if(!['all','core','browser','failures','native'].includes(mode))throw new Error('Usage: node scripts/verification/verify.mjs [all|core|browser|failures|native]');
const git=(...args)=>{
  const result=spawnSync(gitBin,args,{cwd:root,env:toolEnv,encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr||'Git failed');return result.stdout.trim();
};
if(git('status','--porcelain','--untracked-files=all'))throw new Error('Verification requires a clean committed checkout. Commit changes or use a dedicated worktree. Ignored outputs are never copied.');
const commit=git('rev-parse','HEAD');
if(process.env.VERIFY_EXPECTED_SHA&&process.env.VERIFY_EXPECTED_SHA!==commit)throw new Error('Checkout does not match VERIFY_EXPECTED_SHA');
const manifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
if(process.version!==`v${manifest.engines.node}`)throw new Error(`Use Node ${manifest.engines.node}; got ${process.version}`);
if(readFileSync(join(root,'.node-version'),'utf8').trim()!==manifest.engines.node||manifest.packageManager!==`pnpm@${manifest.engines.pnpm}`)throw new Error('Runtime pins disagree');
const pm=spawnSync(pnpmBin,['--version'],{cwd:root,env:toolEnv,encoding:'utf8'});
if(pm.status!==0||pm.stdout.trim()!==manifest.engines.pnpm)throw new Error(`Use plain pnpm ${manifest.engines.pnpm} on PATH. Disable wrappers that switch versions or install on script invocation.`);
const reportDir=join(root,'.build/verification',`${mode}-${commit.slice(0,12)}-${Date.now()}`);
mkdirSync(reportDir,{recursive:true});
const scratch=mkdtempSync(join(tmpdir(),'atepdf-verify-'));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
mkdirSync(join(scratch,'tmp'));mkdirSync(join(scratch,'cache'));writeFileSync(join(scratch,'empty.npmrc'),'');
const cancellation=new AbortController();
const onSignal=()=>{cancellation.abort();process.exitCode=1;};
process.once('SIGTERM',onSignal);process.once('SIGINT',onSignal);
const parents=git('rev-list','--parents','-n','1',commit).split(' ').slice(1);
const record={commit,parents,mode,startedAt:new Date().toISOString(),node:process.version,pnpm:pm.stdout.trim(),
  platform:process.platform,architecture:process.arch,workflow:process.env.GITHUB_WORKFLOW_REF||null,
  workflowCommit:process.env.GITHUB_WORKFLOW_SHA||null,prHead:process.env.VERIFY_PR_HEAD_SHA||null,
  runID:process.env.GITHUB_RUN_ID||null,executables:{node:process.execPath,git:gitBin,pnpm:pnpmBin,tar:tarBin},files:{},commands:[],passed:false};
const env=childEnvironment(process.env,toolPath,scratch);
const features={evals:false,permission:false,tls:false};
async function run(name,command,args,{cwd=scratch,timeout=600_000,expectFailure=false,diagnostic}={}){
  console.log(`Verification: ${name}`);
  const log=join(reportDir,`${record.commands.length+1}-${name}.log`);
  const fd=openSync(log,'w');const started=Date.now();
  let result;try{result=await runChild(command,args,{cwd,env,stdio:['ignore',fd,fd]},{timeout,signal:cancellation.signal});}finally{closeSync(fd);}
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
async function typechecks(){
  for(const [name,config]of [['web','apps/web/tsconfig.json'],['universal','apps/universal/tsconfig.json'],['compatibility','tests/compatibility/tsconfig.json']])
    await node(`typescript-${name}`,['node_modules/typescript/bin/tsc','--noEmit','--incremental','false','-p',config]);
  if(features.evals){await node('typescript-orchestration',['node_modules/typescript/bin/tsc','--noEmit','--incremental','false','-p','tests/evals/orchestration/tsconfig.json']);await node('orchestration-cli-smoke',['--import','tsx','tests/evals/orchestration/run.mts','--set','full','--output-dir','.build/orchestration-smoke']);}
}
async function contracts(){await node('generated-contracts',['scripts/contracts.mjs','--check']);await node('generated-knowledge',['scripts/embed-product-knowledge.mjs','--check']);await node('schemas-catalogue-evals',['--import','tsx','scripts/verification/schemas.mts']);}
try{
  const archive=join(reportDir,'source.tar');const fd=openSync(archive,'w');
  const exported=spawnSync(gitBin,['archive','--format=tar',commit],{cwd:root,stdio:['ignore',fd,'pipe']});closeSync(fd);
  if(exported.status!==0)throw new Error('Cannot export the exact committed source');
  record.archiveSha256=sha256(readFileSync(archive));
  await run('export-source',tarBin,['-xf',archive,'-C',scratch]);rmSync(archive);
  for(const path of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','.node-version',
    'scripts/verification/verify.mjs','scripts/verification/policy.mjs','scripts/verification/process.mjs','scripts/verification/schemas.mts','scripts/verification/browser.mjs',
    'scripts/verification/playwright.config.mts','scripts/contracts.mjs','scripts/embed-product-knowledge.mjs',
    '.github/workflows/verify.yml'])record.files[path]=sha256(readFileSync(join(scratch,path)));
  if(sha256(readFileSync(fileURLToPath(import.meta.url)))!==record.files['scripts/verification/verify.mjs'])throw new Error('Running verification harness differs from committed archive');
  features.evals=existsSync(join(scratch,'tests/evals/orchestration/tsconfig.json'));
  features.permission=existsSync(join(scratch,'tests/native/planner/permission-main.swift'));
  features.tls=existsSync(join(scratch,'tests/native/planner/tls-main.swift'));
  await run('frozen-install',pnpmBin,['install','--frozen-lockfile','--store-dir',join(scratch,'pnpm-store')]);
  if(mode==='all'||mode==='core'){
    await contracts();await typechecks();
    const tests=readdirSync(join(scratch,'tests/regressions')).filter(file=>file.endsWith('.test.ts')).sort().map(file=>`tests/regressions/${file}`);
    await node('shared-core-regressions',['--import','tsx','--test',...tests]);
    await node('beta-test-gateway-build',['scripts/build-gateway.mjs']);
    await node('beta-unit-tests',['--test','scripts/beta/beta.test.mjs']);
    // Syntax-check all added JavaScript, including code not selected by this mode.
    for(const file of ['verify','browser'])await node(`syntax-${file}`,['--check',`scripts/verification/${file}.mjs`]);
  }
  if(mode==='all'||mode==='browser'){
    await contracts();
    // Downloads only the locked Playwright browser. Linux OS libraries are runner prerequisites.
    await run('playwright-browser',pnpmBin,['exec','playwright','install','chromium']);
    await node('engine-assets',['scripts/assets.mjs']);
    await node('expo-web-export',['../../node_modules/expo/bin/cli','export','--platform','web','--output-dir','dist-web'],{cwd:join(scratch,'apps/universal')});
    await node('web-budget',['scripts/check-web-budget.mjs']);
    await node('safe-browser-checks',['scripts/verification/browser.mjs'],{timeout:900_000});
    const output=join(scratch,'.build/verification-browser.json');
    record.browser=JSON.parse(readFileSync(output,'utf8'));
  }
  if(mode==='failures'){
    await contracts();await typechecks();
    async function mutate(name,path,change,args,diagnostic){
      const full=join(scratch,path),before=readFileSync(full);const after=change(before.toString());writeFileSync(full,after);
      record.commands.push({name:`mutation-${name}`,path,beforeSha256:sha256(before),afterSha256:sha256(after)});
      try{await node(name,args,{expectFailure:true,diagnostic});}finally{writeFileSync(full,before);}
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
    await contracts();await typechecks();
    await node('restored-regression',['--import','tsx','--test','tests/regressions/commerce.test.ts']);
  }
  if(mode==='native'||mode==='all'){
    if(process.platform!=='darwin')throw new Error('Native checks require macOS with selected Xcode; this is not an optional skip.');
    await contracts();await run('xcode-version','/usr/bin/xcodebuild',['-version']);
    await run('native-js-export',pnpmBin,['expo:bundles']);
    await node('swift-workspace-interop',['--import','tsx','tests/native/apple/workspace/run.ts']);
    await node('apple-helper',['tests/native/apple/run.mjs']);
    record.native={scope:'Host engine/workspace helpers, native bundle and synthetic transport execution; Mac UI and production signing are separate',
      engine:JSON.parse(readFileSync(join(scratch,'docs/evidence/native/apple-engine-tests.json'),'utf8')),
      shared:JSON.parse(readFileSync(join(scratch,'docs/evidence/native/apple-shared-writer-tests.json'),'utf8'))};
    await run('swift-planner-compile','/usr/bin/xcrun',['swiftc','-module-cache-path',join(scratch,'.build/swift-cache'),'-parse-as-library',
      'apps/universal/modules/atepdf-planner/ios/AtepdfPlannerTransport.swift','tests/native/planner/main.swift','-o',join(scratch,'.build/native-planner-tests')]);
    if(features.permission)for(const release of [false,true])await run(`swift-permission-${release?'release':'debug'}-compile`,'/usr/bin/xcrun',['swiftc',...(!release?['-D','DEBUG']:[]),'-module-cache-path',join(scratch,'.build/swift-cache'),'-parse-as-library','apps/universal/modules/atepdf-planner/ios/AtepdfPlannerTransport.swift','tests/native/planner/permission-main.swift','-o',join(scratch,`.build/permission-${release?'release':'debug'}`)]);
    if(features.tls)await run('swift-tls-debug-compile','/usr/bin/xcrun',['swiftc','-D','DEBUG','-module-cache-path',join(scratch,'.build/swift-cache'),'-parse-as-library','apps/universal/modules/atepdf-planner/ios/AtepdfPlannerTransport.swift','tests/native/planner/tls-main.swift','-o',join(scratch,'.build/tls-debug')]);
    await node('swift-transport-canaries',['tests/native/planner/run.mjs']);
  }
  assertEvidence(record,readFileSync(fileURLToPath(import.meta.url)),readFileSync(join(scratch,'scripts/verification/verify.mjs')),features);
  record.passed=true;
}catch(error){record.error=error.message;process.exitCode=1;console.error(error.message);}
finally{
  process.removeListener('SIGTERM',onSignal);process.removeListener('SIGINT',onSignal);
  const browserReport=join(scratch,'.build/verification-browser.json');
  if(existsSync(browserReport))record.browser=JSON.parse(readFileSync(browserReport,'utf8'));
  record.finishedAt=new Date().toISOString();
  const {browser,...compact}=record;console.log(JSON.stringify({...compact,browserStats:browser?.report?.stats||null},null,2));
  writeFileSync(join(reportDir,'report.json'),JSON.stringify(record,null,2)+'\n');
  if(process.env.GITHUB_STEP_SUMMARY)writeFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## ${mode}: ${record.passed?'passed':'failed'}\n\nVerified commit: \`${commit}\`\n\nWorkflow: \`${record.workflow}\` at \`${record.workflowCommit}\`\n\nCommand: \`node scripts/verification/verify.mjs ${mode}\`\n\n`+
    record.commands.map(entry=>`- ${entry.name}: ${entry.exitCode===undefined?'mutation':`exit ${entry.exitCode}`}`).join('\n')+'\n',{flag:'a'});
  rmSync(scratch,{recursive:true,force:true});console.log(`Source-bound evidence: ${join(reportDir,'report.json')}`);
}
