import {createRequire,syncBuiltinESMExports} from 'node:module';
import {pathToFileURL} from 'node:url';
// Trusted local adapters only. Stops accidental live calls; not an OS security sandbox.
const require=createRequire(import.meta.url);
const denied=()=>{throw new Error('Live network is prohibited in the orchestration eval worker');};
globalThis.fetch=denied as any;
for(const name of ['node:http','node:https','node:net','node:tls','node:http2','node:dgram']){
  const module=require(name);
  for(const key of ['request','get','connect','createConnection','createSocket'])if(typeof module[key]==='function')module[key]=denied;
}
syncBuiltinESMExports();
const chunks:Buffer[]=[];for await(const chunk of process.stdin)chunks.push(Buffer.from(chunk));
const {scenario,config}=JSON.parse(Buffer.concat(chunks).toString());
const {default:adapter}=await import(pathToFileURL(process.argv[2]).href);
if(!adapter||typeof adapter.evaluate!=='function')throw new Error('Candidate adapter must default-export an Adapter');
const observation=await adapter.evaluate(scenario,config);
process.stdout.write(JSON.stringify(observation));
