const fs=require('fs'),path=require('path'),parser=require(path.resolve('node_modules/.pnpm/node_modules/@babel/parser'));
const files=['apps/universal/App.tsx','apps/universal/src/components/assistant-ui/elements/thread.aui.tsx','apps/universal/src/components/JobActivity.tsx','apps/universal/src/platform/Preview.web.tsx','apps/universal/src/platform/Preview.native.tsx','apps/universal/src/platform/DropSurface.web.tsx'];
const packages=new Map();
for(const pkg of ['lucide-react-native']){
 const manifest=JSON.parse(fs.readFileSync(`node_modules/${pkg}/package.json`,'utf8'));if(!manifest.exports['./icons/*'])throw new Error(`No public icon subpaths in ${pkg}`);
 const source=fs.readFileSync(`node_modules/${pkg}/dist/esm/${pkg}.mjs`,'utf8'),ast=parser.parse(source,{sourceType:'module'}),names=new Map();
 for(const s of ast.program.body)if(s.type==='ExportNamedDeclaration'&&s.source?.value.startsWith('./icons/'))for(const e of s.specifiers)if(e.local.name==='default')names.set(e.exported.name,`${pkg}/${s.source.value.slice(2,-4)}`);
 packages.set(pkg,names);
}
const iconData=pkg=>fs.readFileSync(`node_modules/${pkg}/dist/esm/icons/file-plus-corner.mjs`,'utf8').match(/const __iconData = ([\s\S]*?);/)[1];
if(iconData('lucide-react')!==iconData('lucide-react-native'))throw new Error('FilePlus2 vector data differs between web and native packages');
packages.set('lucide-react',packages.get('lucide-react-native'));
const changes=[];
for(const file of files){const source=fs.readFileSync(file,'utf8'),ast=parser.parse(source,{sourceType:'module',plugins:['typescript','jsx']}),edits=[];
 for(const d of ast.program.body){if(d.type!=='ImportDeclaration'||d.importKind==='type'||!packages.has(d.source.value))continue;const lines=[],types=[];
  for(const s of d.specifiers){if(s.type!=='ImportSpecifier')throw new Error(`Unexpected import in ${file}`);const imported=s.imported.name,local=s.local.name;
   if(s.importKind==='type'){types.push(imported===local?imported:`${imported} as ${local}`);continue;}
   const target=packages.get(d.source.value).get(imported);if(!target)throw new Error(`Unmapped ${imported} in ${file}`);
   lines.push(`import ${local} from '${target}';`);changes.push({file,imported,local,target});
  }
  if(types.length)lines.push(`import type {${types.join(', ')}} from '${d.source.value}';`);edits.push({start:d.start,end:d.end,text:lines.join('\n')});
 }
 let updated=source;for(const e of edits.reverse())updated=updated.slice(0,e.start)+e.text+updated.slice(e.end);fs.writeFileSync(file,updated);
}
fs.writeFileSync('.build/ux-20260929/performance/import-changes.json',JSON.stringify(changes,null,2));console.log(JSON.stringify({files:files.length,valueImports:changes.length,uniqueImports:new Set(changes.map(c=>c.target)).size,allAliasesMappedThroughInstalledPackageExports:true},null,2));
