import {createHash} from 'node:crypto';
import {join} from 'node:path';
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function childEnvironment(source,path,scratch){
  const env={PATH:path,CI:'true',EXPO_NO_TELEMETRY:'1',NEXT_TELEMETRY_DISABLED:'1'};
  for(const key of ['HOME','USER','LOGNAME','LANG','LC_ALL','TZ','DEVELOPER_DIR'])if(source[key])env[key]=source[key];
  if(scratch)Object.assign(env,{TMPDIR:join(scratch,'tmp'),TMP:join(scratch,'tmp'),TEMP:join(scratch,'tmp'),XDG_CACHE_HOME:join(scratch,'cache'),PLAYWRIGHT_BROWSERS_PATH:join(scratch,'browsers'),NPM_CONFIG_USERCONFIG:join(scratch,'empty.npmrc')});
  return env;
}
export function expectedCommands(mode,{evals=false,permission=false,tls=false}={}){
  const contracts=['generated-contracts','generated-knowledge','schemas-catalogue-evals'];
  const types=['typescript-web','typescript-universal','typescript-compatibility',...(evals?['typescript-orchestration','orchestration-cli-smoke']:[])];
  const core=[...contracts,...types,'shared-core-regressions','beta-test-gateway-build','beta-unit-tests','syntax-verify','syntax-browser'];
  const browser=[...contracts,'playwright-browser','engine-assets','expo-web-export','web-budget','safe-browser-checks'];
  const failures=[...contracts,...types,...['typescript','schema-drift','stale-validator','stale-knowledge','catalogue','manifest','regression'].map(n=>'reject-'+n),'restored-regression'];
  const native=[...contracts,'xcode-version','native-js-export','swift-workspace-interop','apple-helper','swift-planner-compile',...(permission?['swift-permission-debug-compile','swift-permission-release-compile']:[]),...(tls?['swift-tls-debug-compile']:[]),'swift-transport-canaries'];
  return [...new Set(['export-source','frozen-install',...({all:[...core,...browser,...native],core,browser,failures,native}[mode]??[])])];
}
export function assertEvidence(record,running,archived,features){
  if(hash(running)!==hash(archived))throw new Error('Running verification harness differs from committed archive');
  for(const name of expectedCommands(record.mode,features)){
    const rows=record.commands.filter(entry=>entry.name===name);
    if(!rows.length||rows.some(entry=>entry.signal||entry.error||entry.exitCode===null||(entry.expectFailure?entry.exitCode===0:entry.exitCode!==0)))throw new Error('Missing successful required command: '+name);
  }
}
