import policy from '../../../packages/contracts/transport-policy.json';
import {fixture} from '../../helpers/outbound-fixture';
// Explicit synthetic-only gateway for native transport/UI tests. No LocalConfig,
// credential file or OpenAI provider is constructed.
import {createServer} from 'node:http';
import {createGateway} from '../../../packages/planner/src/gateway';
import {quickPlan} from '../../../packages/contracts/src/protocol';
async function main(){
let calls=0,cancelled=0,plannerBytes=0,pairingBytes=0,redirectBytes=0,redirectRequests=0;
const gateway=createGateway({status:async()=>({connected:true,enabled:true,remaining:100}),reserve:async()=>({key:'synthetic-native-test-only',release:async()=>{}})},async(request,_key,signal)=>{
  if(/brief\.pdf|appendix\.pdf|PRIVATE-CANARY/.test(JSON.stringify(request)))throw new Error('Privacy canary leaked.');
  calls++;
  if(request.instruction==='Wait for cancellation'||request.instruction==='Wait for interruption')await new Promise<void>((resolve,reject)=>{
    let settled=false;
    const onAbort=()=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',onAbort);cancelled++;reject(new Error('cancelled'));};
    const timer=setTimeout(()=>{if(settled)return;settled=true;signal.removeEventListener('abort',onAbort);resolve();},request.instruction==='Wait for interruption'?25_000:10_000);
    signal.addEventListener('abort',onAbort,{once:true});
    if(signal.aborted)onAbort();
  });
  if(/what can atepdf do/i.test(request.instruction))return {schemaVersion:'1.0',status:'answer',reasonCode:'product_information',steps:[],resultRefs:[],clarification:{question:'I can merge PDFs and remove pages on your device. Your originals stay unchanged.',choices:[]}};
  if(/^undo/i.test(request.instruction))return {schemaVersion:'1.0',status:'undo',reasonCode:'undo_last_change',steps:[],resultRefs:[],clarification:null};
  return quickPlan(request,/remove/i.test(request.instruction)?'remove':'merge',2).planner;
},{minIntervalMs:0,...(await fixture()).gatewayOptions});
createServer(async(req,res)=>{
  const abort=new AbortController();res.on('close',()=>{if(!res.writableEnded)abort.abort();});
  try{
    if(req.url==='/test/evidence'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({provider:'synthetic-only',calls,cancelled,plannerBytes,pairingBytes,redirectBytes,redirectRequests}));return;}
    const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers as HeadersInit,signal:abort.signal,...(req.method==='POST'?{body:req as never,duplex:'half'}:{})} as RequestInit);
    if(req.url==='/api/native/pair')pairingBytes+=Buffer.byteLength(await request.clone().text());
    if(req.url==='/api/native/planner'){
      plannerBytes+=Buffer.byteLength(await request.clone().text());
      const body=await request.clone().json();
      if(body.instruction.startsWith('SHR70 ')){
        const variant=body.instruction.slice(6),limit=policy.plannerResponseBytes;
        if(variant.startsWith('redirect')){res.writeHead(307,{Location:variant==='redirect same'?'http://localhost:3212/test/forbidden':'http://127.0.0.1:3212/test/forbidden'});res.end();return;}
        const tiny='{"synthetic":true}',size=variant==='exact'?limit:limit+1;
        if(variant==='truncated'){res.writeHead(200,{'Content-Type':'application/json','Content-Length':'100','Connection':'close'});res.end('{');return;}
        const headers:Record<string,string>={'Content-Type':'application/json'};
        if(variant==='over length')headers['Content-Length']=String(size);
        res.writeHead(variant==='over error'?500:200,headers);
        if(variant==='over chunked'){
          for(let sent=0;sent<size;sent+=8192){if(res.destroyed)break;res.write(' '.repeat(Math.min(8192,size-sent)));await new Promise(resolve=>setTimeout(resolve,1));}res.end();return;
        }
        res.end(tiny+' '.repeat(size-tiny.length));return;
      }
      if(body.instruction==='Synthetic privacy denial'){res.writeHead(403,{'Content-Type':'application/json'});res.end('{"reasonCode":"disclosure_required"}');return;}
      if(body.instruction==='Synthetic redirect'){res.writeHead(302,{Location:'http://localhost:3212/test/forbidden'});res.end();return;}
      if(body.instruction==='Synthetic oversized response'){res.writeHead(200,{'Content-Type':'application/json'});res.end(' '.repeat(policy.plannerResponseBytes+1));return;}
    }
    if(req.url==='/test/forbidden'){redirectRequests++;redirectBytes+=String(req.headers.authorization??'').length+Buffer.byteLength(await request.text());throw new Error('Redirect followed.');}
    const response=await gateway(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
  }catch{res.writeHead(500);res.end('{"error":"Synthetic test failure"}');}
}).listen(3212,'localhost',()=>console.log('Synthetic native test gateway only: localhost:3212; no OpenAI calls.'));

}
void main();
