import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {childEnvironment,assertEvidence,expectedCommands} from '../../scripts/verification/policy.mjs';
import {runChild} from '../../scripts/verification/process.mjs';

test('S90-01 plain pnpm rejects mismatched engines and packageManager without switching',async()=>{
  const root=await mkdtemp(join(tmpdir(),'shr90-pins-'));
  try{
    const pm=spawnSync('pnpm',['--version'],{encoding:'utf8'});assert.equal(pm.status,0);assert.equal(pm.stdout.trim(),'11.19.0');
    await writeFile(join(root,'pnpm-workspace.yaml'),'engineStrict: true\npmOnFail: error\n');
    await writeFile(join(root,'package.json'),JSON.stringify({private:true,packageManager:'pnpm@11.19.0',engines:{node:'>=99'}}));
    const engine=spawnSync('pnpm',['install','--ignore-scripts'],{cwd:root,encoding:'utf8',timeout:15_000});assert.notEqual(engine.status,0);assert.match(engine.stdout+engine.stderr,/UNSUPPORTED_ENGINE|Unsupported environment/);
    await writeFile(join(root,'package.json'),JSON.stringify({private:true,packageManager:'pnpm@11.18.0',engines:{node:'24.19.0'}}));
    const manager=spawnSync('pnpm',['--version'],{cwd:root,encoding:'utf8',timeout:15_000});assert.notEqual(manager.status,0);assert.match(manager.stdout+manager.stderr,/BAD_PM_VERSION|packageManager|version of pnpm/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('S90-02 evidence rejects a different harness or a missing/failed command in every mode',()=>{
  for(const mode of ['all','core','browser','native','failures']){
    const features={evals:true,permission:true,tls:true};
    const commands=expectedCommands(mode,features).map(name=>({name,exitCode:0,expectFailure:name.startsWith('reject-')})).map(e=>({...e,exitCode:e.expectFailure?1:0}));
    const record={mode,commands};assert.doesNotThrow(()=>assertEvidence(record,Buffer.from('committed'),Buffer.from('committed'),features));
    assert.throws(()=>assertEvidence(record,Buffer.from('uncommitted'),Buffer.from('committed'),features),/differs/);
    assert.throws(()=>assertEvidence({...record,commands:commands.slice(1)},Buffer.from('committed'),Buffer.from('committed'),features),/Missing/);
    assert.throws(()=>assertEvidence({...record,commands:[...commands,{name:commands[0].name,exitCode:1}]},Buffer.from('committed'),Buffer.from('committed'),features),/Missing/);
  }
});

test('S90-03 provider keys, Node injection and shared temp/cache locations never reach children',()=>{
  const env=childEnvironment({HOME:'/home/user',LANG:'en_US.UTF-8',OPENAI_API_KEY:'canary',NODE_OPTIONS:'--import canary',AWS_SECRET_ACCESS_KEY:'canary',TMPDIR:'/shared',XDG_CACHE_HOME:'/shared'},'/tools','/private/run');
  assert.equal(env.OPENAI_API_KEY,undefined);assert.equal(env.NODE_OPTIONS,undefined);assert.equal(env.AWS_SECRET_ACCESS_KEY,undefined);
  assert.equal(env.TMPDIR,'/private/run/tmp');assert.equal(env.XDG_CACHE_HOME,'/private/run/cache');assert.equal(env.LANG,'en_US.UTF-8');
});

for(const cause of ['timeout','cancel'] as const)test(`S90-07 ${cause} escalates an owned TERM-ignoring child and allows scratch cleanup`,async()=>{
  const root=await mkdtemp(join(tmpdir(),'shr90-cancel-')),ready=join(root,'ready');const signal=new AbortController();
  const code="process.on('SIGTERM',()=>{});require('fs').writeFileSync(process.argv[1],'ready');setInterval(()=>{},1000)";
  try{
    const pending=runChild(process.execPath,['-e',code,ready],{stdio:'ignore'},{timeout:cause==='timeout'?200:10_000,signal:signal.signal,grace:100});
    for(let i=0;i<100;i++){try{await readFile(ready);break;}catch{await new Promise(done=>setTimeout(done,5));}}
    if(cause==='cancel')signal.abort();
    const outcome=await pending;assert.equal(outcome.signal,'SIGKILL');assert.match(outcome.error.message,cause==='cancel'?/cancelled/:/timeout/);
  }finally{await rm(root,{recursive:true,force:true});}
});
