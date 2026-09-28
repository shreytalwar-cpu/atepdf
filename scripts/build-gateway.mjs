import {build} from 'esbuild';
await build({entryPoints:['packages/planner/src/gateway.ts','packages/planner/src/local-config.ts'],outdir:'.build/planner',bundle:true,platform:'node',format:'esm',banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},outExtension:{'.js':'.mjs'},packages:'external',tsconfig:'apps/web/tsconfig.json'});
