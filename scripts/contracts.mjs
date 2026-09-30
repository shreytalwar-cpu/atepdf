import {readFile,mkdir,writeFile} from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import standaloneCode from 'ajv/dist/standalone/index.js';
const ajv=new Ajv2020({strict:false,allErrors:false,code:{source:true}});
const check=process.argv.includes('--check');
if(!check)await mkdir('packages/contracts/src/generated',{recursive:true});
for(const [name,schema]of [['request','planner-request'],['envelope','gateway-envelope'],['response','planner-response']]){
  const validate=ajv.compile(JSON.parse(await readFile(`packages/contracts/schemas/${schema}.schema.json`,'utf8')));
  for(const [extension,content]of [['js',standaloneCode(ajv,validate)],['d.ts','declare function validate(value: unknown): boolean;\nexport = validate;\n']]){
    const path=`packages/contracts/src/generated/${name}.${extension}`;
    if(check){
      if(await readFile(path,'utf8').catch(()=>null)!==content)throw new Error(`Generated contract is stale: ${path}. Run node scripts/contracts.mjs.`);
    }else await writeFile(path,content);
  }
}
console.log('Canonical contract validators compiled ahead of time; no runtime eval.');
