// Load the unchanged engine from the investigated checkout with existing dependencies.
const [root,out,deps]=process.argv.slice(2);
const path=require('node:path'),fs=require('node:fs');
const requireDeps=require('node:module').createRequire(path.resolve(deps,'package.json'));
requireDeps('esbuild').buildSync({entryPoints:[path.resolve(root,'packages/web-pdf/src/engine.ts')],outfile:path.resolve(out,'guard-engine.cjs'),bundle:true,platform:'node',format:'cjs',nodePaths:[path.resolve(deps,'node_modules')]});
const {preflight}=require(path.resolve(out,'guard-engine.cjs'));
(async()=>{const rows=[];for(const id of ['interactive','tagged']){try{await preflight(new Uint8Array(fs.readFileSync(path.resolve(root,'tests/fixtures/corpus',id+'.pdf'))));rows.push({id,admitted:true});}catch(e){rows.push({id,admitted:false,error:e.message});}}fs.writeFileSync(path.resolve(out,'current-guard.json'),JSON.stringify({source:process.env.SHR49_SOURCE,rows},null,2)+'\n');console.log(rows);})();
