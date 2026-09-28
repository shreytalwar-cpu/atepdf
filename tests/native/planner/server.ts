// Explicit synthetic-only gateway for native transport/UI tests. No LocalConfig,
// credential file or OpenAI provider is constructed.
import {createServer} from 'node:http';
import {createGateway} from '../../../packages/planner/src/gateway';
import {quickPlan} from '../../../packages/contracts/src/protocol';
let calls=0,cancelled=0;
const gateway=createGateway({status:async()=>({connected:true,enabled:true,remaining:100}),reserve:async()=>({key:'synthetic-native-test-only',release:async()=>{}})},async(request,_key,signal)=>{
  if(/brief\.pdf|appendix\.pdf|PRIVATE-CANARY/.test(JSON.stringify(request)))throw new Error('Privacy canary leaked.');
  calls++;
  if(request.instruction==='Wait for cancellation')await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,10_000);signal.addEventListener('abort',()=>{cancelled++;clearTimeout(timer);reject(new Error('cancelled'));},{once:true});});
  if(/what can atepdf do/i.test(request.instruction))return {schemaVersion:'1.0',status:'answer',reasonCode:'product_information',steps:[],resultRefs:[],clarification:{question:'I can merge PDFs and remove pages on your device. Your originals stay unchanged.',choices:[]}};
  if(/^undo/i.test(request.instruction))return {schemaVersion:'1.0',status:'undo',reasonCode:'undo_last_change',steps:[],resultRefs:[],clarification:null};
  return quickPlan(request,/remove/i.test(request.instruction)?'remove':'merge',2).planner;
},{minIntervalMs:0});
createServer(async(req,res)=>{
  const abort=new AbortController();res.on('close',()=>{if(!res.writableEnded)abort.abort();});
  try{
    if(req.url==='/test/evidence'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({provider:'synthetic-only',calls,cancelled}));return;}
    const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers as HeadersInit,signal:abort.signal,...(req.method==='POST'?{body:req as never,duplex:'half'}:{})} as RequestInit);
    if(req.url==='/api/native/planner'){
      const body=await request.clone().json();
      if(body.instruction==='Synthetic redirect'){res.writeHead(302,{Location:'http://localhost:3212/test/forbidden'});res.end();return;}
      if(body.instruction==='Synthetic oversized response'){res.writeHead(200,{'Content-Type':'application/json'});res.end(' '.repeat(256001));return;}
    }
    if(req.url==='/test/forbidden')throw new Error('Redirect followed.');
    const response=await gateway(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
  }catch{res.writeHead(500);res.end('{"error":"Synthetic test failure"}');}
}).listen(3212,'localhost',()=>console.log('Synthetic native test gateway only: localhost:3212; no OpenAI calls.'));
