import type {Grade} from './types';
export function metrics(grades:Grade[]){
  const sum=(key:keyof Grade)=>grades.reduce((n,g)=>n+Number(g[key]),0);
  const clarification=grades.reduce((out,g)=>({false:out.false+g.clarification.false,missed:out.missed+g.clarification.missed,correct:out.correct+g.clarification.correct,direct:out.direct+g.clarification.direct}),{false:0,missed:0,correct:0,direct:0});
  const ratio=(n:number,d:number)=>d?n/d:null;
  const failuresByGroup:Record<string,number>={};for(const grade of grades)for(const failure of grade.failures)failuresByGroup[failure.group]=(failuresByGroup[failure.group]??0)+1;
  return {scenarios:grades.length,passed:grades.filter(g=>g.passed).length,score:ratio(grades.filter(g=>g.passed).length,grades.length),turns:sum('turns'),planCorrect:sum('planCorrect'),planTotal:sum('planTotal'),planAccuracy:ratio(sum('planCorrect'),sum('planTotal')),toolAccuracy:ratio(sum('toolCorrect'),sum('turns')),toolInvocationAccuracy:ratio(sum('invocationCorrect'),sum('turns')),clarification:{...clarification,precision:ratio(clarification.correct,clarification.correct+clarification.false),recall:ratio(clarification.correct,clarification.correct+clarification.missed)},invalidPlans:sum('invalidPlans'),privacyViolations:sum('privacyViolations'),unsupportedToolHallucinations:sum('hallucinations'),unnecessaryProviderCalls:sum('unnecessaryProviderCalls'),missingProviderCalls:sum('missingProviderCalls'),unnecessaryToolCalls:sum('unnecessaryToolCalls'),staleAcceptances:sum('staleAcceptances'),entitlementBypasses:sum('entitlementBypasses'),failuresByGroup,modelTokens:null,providerLatencyMs:null,cost:null,measurementNote:'No live provider. Scripted token/latency/cost values are not model measurements.'};
}
export function summarize(report:any):string{
  const pct=(n:number|null)=>n===null?'N/A':`${(100*n).toFixed(1)}%`;
  const lines=['# atePDF orchestration eval baseline','',`Corpus ${report.corpusVersion}; split ${report.splitVersion}; adapter ${report.adapter}.`, '', '**Evidence:** current local boundaries with scripted provider responses and synthetic engines. This is not live-model language understanding, PDF fidelity, Mac UI acceptance or production readiness.', '', '| Set | Scenarios | Pass | Score | Plan accuracy | Tool accuracy |', '| --- | ---: | ---: | ---: | ---: | ---: |'];
  for(const [set,value] of Object.entries(report.sets) as [string,any][]){const m=value.metrics;lines.push(`| ${set} | ${m.scenarios} | ${m.passed} | ${pct(m.score)} | ${pct(m.planAccuracy)} | ${pct(m.toolAccuracy)} |`);}
  lines.push('', '## Diagnostics', '');
  for(const [set,value] of Object.entries(report.sets) as [string,any][]){
    const m=value.metrics;lines.push(`**${set}:** clarification false=${m.clarification.false}, missed=${m.clarification.missed}, correct=${m.clarification.correct}, direct=${m.clarification.direct}; invalid=${m.invalidPlans}; privacy=${m.privacyViolations}; unsupported=${m.unsupportedToolHallucinations}; unnecessary provider=${m.unnecessaryProviderCalls}; missing provider=${m.missingProviderCalls}; unnecessary tool=${m.unnecessaryToolCalls}; stale admissions=${m.staleAcceptances}; entitlement bypasses=${m.entitlementBypasses}.`, '', `Failure groups: ${JSON.stringify(m.failuresByGroup)}.`, '');
    if(value.details)for(const grade of value.details.filter((g:Grade)=>!g.passed)){lines.push(`- ${grade.id} (${grade.category}): ${grade.failures.map((f:any)=>`turn ${f.turn+1}: ${f.message}`).join('; ')}`);}
  }
  lines.push('', 'Held-out details and answer keys are omitted by default. Tokens, provider latency and cost are unavailable in mocked mode.', '', `Runtime source: ${report.provenance.runtimeHead}; harness source: ${report.provenance.harnessHead}; content hashes are in the JSON report.`, '');return lines.join('\n');
}
/** Hard gates compare counts; quality compares scores and exact plan/tool accuracy independently. */
export function compare(candidate:any,baseline:any){
  if(candidate.corpusVersion!==baseline.corpusVersion||candidate.splitVersion!==baseline.splitVersion||candidate.provenance.corpusHash!==baseline.provenance.corpusHash)throw new Error('Cannot compare different corpus/split versions or contents');
  const regressions:string[]=[];
  for(const set of Object.keys(candidate.sets)){
    const c=candidate.sets[set].metrics,b=baseline.sets[set]?.metrics;if(!b||candidate.sets[set].selectionHash!==baseline.sets[set].selectionHash||c.scenarios!==b.scenarios||c.turns!==b.turns)throw new Error('Cannot compare different scenario selections');
    for(const key of ['invalidPlans','privacyViolations','unsupportedToolHallucinations','staleAcceptances','unnecessaryProviderCalls','entitlementBypasses','missingProviderCalls'])if(c[key]>b[key])regressions.push(`${set}: ${key} increased ${b[key]} -> ${c[key]}`);
    for(const key of ['score','planAccuracy','toolAccuracy'])if(b[key]!==null&&(c[key]===null||c[key]<b[key]))regressions.push(`${set}: ${key} regressed`);
  }
  return {accepted:regressions.length===0,regressions,note:'Comparison only; no optimization loop, production configuration change or deployment.'};
}
