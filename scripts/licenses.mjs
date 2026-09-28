import {readdir,readFile,mkdir,cp,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const rows=[];
for(const dir of await readdir('node_modules/.pnpm')){
  const root=join('node_modules/.pnpm',dir,'node_modules');
  let names;try{names=await readdir(root);}catch{continue;}
  for(const group of names){
    const packages=group.startsWith('@')?(await readdir(join(root,group))).map(n=>join(group,n)):[group];
    for(const name of packages){try{const p=JSON.parse(await readFile(join(root,name,'package.json'),'utf8'));if(rows.some(r=>r.name===p.name&&r.version===p.version))continue;rows.push({name:p.name,version:p.version,license:p.license??'REVIEW_REQUIRED',repository:p.repository??null});}catch{}}
  }
}
rows.sort((a,b)=>a.name.localeCompare(b.name)||a.version.localeCompare(b.version));
await writeFile('docs/dependency-sbom.json',JSON.stringify(rows,null,2)+'\n');
console.log(`${rows.length} installed package licences inventoried; ${rows.filter(r=>r.license==='REVIEW_REQUIRED').length} missing declarations.`);
