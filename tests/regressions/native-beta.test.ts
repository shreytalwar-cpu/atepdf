import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,symlink,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {request as httpsRequest} from 'node:https';
import {checkServerIdentity} from 'node:tls';
import {once} from 'node:events';
import {createGateway} from '../../packages/planner/src/gateway';
import {createNativeBetaServer,validateNativeEndpoint,isPrivateIPv4} from '../../packages/planner/src/native-beta';
import {buildRequest,quickPlan} from '../../packages/contracts/src/protocol';
import {prepareBetaTLS,loadBetaTLS} from '../../scripts/native/beta-tls.mjs';

test('private beta endpoints reject public addresses, DNS names, credentials and alternate URL forms',()=>{
  for(const host of ['192.168.1.2','172.16.2.1','172.31.2.1','10.1.2.3','127.0.0.1'])assert.equal(isPrivateIPv4(host),true);
  for(const host of ['8.8.8.8','172.32.0.1','169.254.169.254','0.0.0.0','127.0.0.2','example.com','192.168.01.2','::1'])assert.equal(isPrivateIPv4(host),false);
  const fingerprint='a'.repeat(64);
  for(const origin of ['http://192.168.1.2:3443','https://example.com:3443','https://8.8.8.8:3443','https://192.168.1.2','https://192.168.1.2:3443/','https://u:p@192.168.1.2:3443','https://192.168.1.2:3443/path'])assert.throws(()=>validateNativeEndpoint({origin,fingerprint}));
});

test('actual private TLS gateway pairs and plans, refuses browser/key/file routes and preserves certificate validation',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'atepdf-tls-test-'));await chmod(dir,0o700);
  let server:ReturnType<typeof createNativeBetaServer>|undefined;
  try{
    const tls=await prepareBetaTLS(join(dir,'tls'),'127.0.0.1',3444);
    const authority=Buffer.from(tls.cert.toString().match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)![1]);
    let calls=0;
    const origin='http://localhost:3212';
    const gateway=createGateway({status:async()=>({connected:true,enabled:true,remaining:2}),reserve:async()=>({key:'synthetic-only',release:async()=>{}})},async request=>{calls++;assert.doesNotMatch(JSON.stringify(request),/PRIVATE-CANARY|brief\.pdf|appendix\.pdf/);return quickPlan(request,'merge').planner;},{minIntervalMs:0,nativeEndpoint:tls.endpoint});
    server=createNativeBetaServer({gateway,origin:tls.endpoint.origin,loopbackOrigin:origin,key:tls.key,cert:tls.cert});
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const address=server.address();assert.ok(address&&typeof address==='object');
    const testOrigin=`https://127.0.0.1:${address.port}`;
    function send(path:string,body?:unknown,headers:Record<string,string>={},trust:Buffer|undefined=authority,tlsHost?:string){return new Promise<{status:number;body:any}>((resolve,reject)=>{
      const data=body===undefined?undefined:JSON.stringify(body),req=httpsRequest(testOrigin+path,{method:data?'POST':'GET',ca:trust,agent:false,checkServerIdentity:tlsHost?(_hostname,certificate)=>checkServerIdentity(tlsHost,certificate):checkServerIdentity,headers:{host:new URL(tls.endpoint.origin).host,...(data?{'content-type':'application/json','content-length':String(Buffer.byteLength(data))}:{}),...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode!,body:JSON.parse(text)}));});req.on('error',reject);req.end(data);
    });}
    // No trusted certificate => TLS must fail. This is not rejectUnauthorized:false.
    await assert.rejects(send('/api/native/planner/status',undefined,{},Buffer.from('')));
    for(const path of ['/','/api/planner/status','/api/planner/key','/api/planner/pairing','/assets/brief.pdf','/api/native/planner/status?extra=1'])assert.equal((await send(path)).status,403);
    assert.equal((await send('/api/native/planner/status',undefined,{origin:origin})).status,403);
    assert.equal((await send('/api/native/planner/status',undefined,{'sec-fetch-site':'same-origin'})).status,403);
    await assert.rejects(send('/api/native/planner/status',undefined,{host:'evil.example'}),{code:'ERR_TLS_CERT_ALTNAME_INVALID'});
    // Validate the real TLS endpoint independently of the injected HTTP Host,
    // so this request reaches the listener's Host guard. CA validation remains on.
    await assert.rejects(send('/api/native/planner/status',undefined,{host:'evil.example'},Buffer.from(''),'127.0.0.1'));
    assert.equal((await send('/api/native/planner/status',undefined,{host:'evil.example'},authority,'127.0.0.1')).status,403);
    assert.equal((await send('/api/native/planner/status')).status,401);
    const status=await(await gateway(new Request(origin+'/api/planner/status'))).json();
    const issued=await(await gateway(new Request(origin+'/api/planner/pairing',{method:'POST',headers:{origin,'content-type':'application/json','x-atepdf-token':status.token},body:'{}'}))).json();
    assert.ok(issued.code.startsWith('atepdf-beta:'));
    const payload=JSON.parse(Buffer.from(issued.code.slice('atepdf-beta:'.length),'base64url').toString());
    assert.equal(payload.origin,tls.endpoint.origin);assert.equal(payload.fingerprint,tls.endpoint.fingerprint);
    const paired=await send('/api/native/pair',{code:payload.code});assert.equal(paired.status,200);
    assert.equal((await send('/api/native/pair',{code:payload.code})).status,401);
    const auth={authorization:`Bearer ${paired.body.token}`};
    assert.equal((await send('/api/native/planner/status',undefined,auth)).body.token,undefined);
    const files=[{ref:'file_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',kind:'pdf' as const,pageCount:2,sizeBytes:3000,encrypted:false as const},{ref:'file_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',kind:'pdf' as const,pageCount:1,sizeBytes:2000,encrypted:false as const}];
    const request=buildRequest({revision:2,files,selected:files.map(f=>f.ref),focus:null,originals:files.map(f=>f.ref)},'Merge in the order added.');
    assert.equal((await send('/api/native/planner',{...request,filename:'PRIVATE-CANARY'},auth)).status,400);assert.equal(calls,0);
    const plan=await send('/api/native/planner',request,auth);assert.equal(plan.status,200);assert.equal(plan.body.planner.steps[0].operation,'merge_pdf');assert.equal(calls,1);
    assert.equal((await send('/api/native/disconnect',{},auth)).status,200);assert.equal((await send('/api/native/planner/status',undefined,auth)).status,401);
    const reused=await prepareBetaTLS(join(dir,'tls'),'127.0.0.1',3444);assert.equal(reused.endpoint.fingerprint,tls.endpoint.fingerprint);
    await assert.rejects(loadBetaTLS(join(dir,'tls'),'192.168.1.2'));
    await symlink(join(dir,'tls'),join(dir,'symlink'));await assert.rejects(loadBetaTLS(join(dir,'symlink'),'127.0.0.1'));
    await chmod(join(dir,'tls','key.pem'),0o644);await assert.rejects(loadBetaTLS(join(dir,'tls'),'127.0.0.1'));
  }finally{if(server){server.closeAllConnections();await new Promise<void>(r=>server!.close(()=>r()));}await rm(dir,{recursive:true,force:true});}
});
