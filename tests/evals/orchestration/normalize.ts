/** Alpha-renaming only: step order, input order and collection result order remain semantic. */
export function normalizePlan(value:any,aliases:Record<string,string>={}):unknown {
  if (!value || !Array.isArray(value.steps) || !Array.isArray(value.resultRefs) || value.steps.some((step:any)=>!step||typeof step.outputRef!=='string'||!Array.isArray(step.inputs))) return value;
  const refs = new Map<string,string>(Object.entries(aliases));
  value.steps.forEach((step:any,i:number)=>refs.set(step.outputRef,`@step:${i}`));
  const ref=(value:string)=>refs.get(value)??value;
  return canonical({steps:value.steps.map((step:any)=>({operation:step.operation,inputs:step.inputs.map(ref),params:normalizeParams(step.params)})),resultRefs:value.resultRefs.map(ref)});
}
function normalizeParams(params:any) {
  const copy=structuredClone(params);
  // Physical removal is a set. Reorder selectors and other arrays remain ordered.
  if(copy?.action==='remove'&&copy.pages?.mode==='explicit'&&Array.isArray(copy.pages.indices))copy.pages.indices.sort((a:number,b:number)=>a-b);
  return copy;
}
export function canonical(value:any):any {
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
export const equal=(a:unknown,b:unknown)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
