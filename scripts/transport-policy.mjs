import {readFile,writeFile} from 'node:fs/promises';
const policy=JSON.parse(await readFile('packages/contracts/transport-policy.json','utf8'));
const path='apps/universal/modules/atepdf-planner/ios/AtepdfPlannerTransport.swift';
const source=await readFile(path,'utf8');
const block=`// BEGIN GENERATED TRANSPORT POLICY
// From packages/contracts/transport-policy.json; node scripts/contracts.mjs.
private enum PlannerTransportPolicy {
  static let plannerResponseBytes = ${policy.plannerResponseBytes}
  static let controlResponseBytes = ${policy.controlResponseBytes}
}
// END GENERATED TRANSPORT POLICY`;
const generated=source.replace(/\/\/ BEGIN GENERATED TRANSPORT POLICY[\s\S]*?\/\/ END GENERATED TRANSPORT POLICY/,block);
if(!source.includes('// BEGIN GENERATED TRANSPORT POLICY'))throw new Error('Missing native transport policy marker');
if(process.argv.includes('--check')){if(source!==generated)throw new Error('Generated transport policy is stale');}
else await writeFile(path,generated);
