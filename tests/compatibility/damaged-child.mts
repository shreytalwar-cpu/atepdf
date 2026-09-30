// Only launched in a 128 MiB / five-second child. Never execute a transform.
import {readFile} from 'node:fs/promises';
import {preflight} from '../../packages/web-pdf/src/engine';
try{
  await preflight(new Uint8Array(await readFile(process.argv[2])));
  process.stdout.write(JSON.stringify({admitted:true,error:null}));
}catch(error){
  process.stdout.write(JSON.stringify({admitted:false,error:error instanceof Error?error.message:String(error)}));
}
