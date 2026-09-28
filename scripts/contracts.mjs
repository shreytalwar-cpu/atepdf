import {readFile,mkdir,writeFile} from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import standaloneCode from 'ajv/dist/standalone/index.js';
const ajv=new Ajv2020({strict:false,allErrors:false,code:{source:true}});
await mkdir('packages/contracts/src/generated',{recursive:true});
for(const [name,schema]of [['request','planner-request'],['envelope','gateway-envelope'],['response','planner-response']]){
  const validate=ajv.compile(JSON.parse(await readFile(`packages/contracts/schemas/${schema}.schema.json`,'utf8')));
  await writeFile(`packages/contracts/src/generated/${name}.js`,standaloneCode(ajv,validate));
  await writeFile(`packages/contracts/src/generated/${name}.d.ts`,'declare function validate(value: unknown): boolean;\nexport = validate;\n');
}
console.log('Canonical contract validators compiled ahead of time; no runtime eval.');
