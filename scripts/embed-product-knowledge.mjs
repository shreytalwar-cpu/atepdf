import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';

const source=resolve('docs/AI_PRODUCT_KNOWLEDGE.md');
const target=resolve('packages/planner/src/generated/product-knowledge.ts');
const knowledge=(await readFile(source,'utf8')).trim();
if(knowledge.length<100||knowledge.length>20_000)throw new Error('Product knowledge must be complete and bounded.');
const generated=`// Generated from docs/AI_PRODUCT_KNOWLEDGE.md. Edit the Markdown source.\nexport const PRODUCT_KNOWLEDGE = ${JSON.stringify(knowledge)};\n`;
if(process.argv.includes('--check')){
  if(await readFile(target,'utf8').catch(()=>null)!==generated)throw new Error('Product knowledge embedding is stale. Run node scripts/embed-product-knowledge.mjs.');
}else{
  await mkdir(dirname(target),{recursive:true});
  await writeFile(target,generated);
}
