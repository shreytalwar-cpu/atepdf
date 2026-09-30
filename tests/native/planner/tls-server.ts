import {fixture} from '../../helpers/outbound-fixture';
// Isolated loopback TLS harness. No LocalConfig or real provider is constructed.
import {createServer} from 'node:http';
import {createServer as createTLSServer} from 'node:https';
import {mkdtemp,rm,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {X509Certificate,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {createGateway} from '../../../packages/planner/src/gateway';
import {createNativeBetaServer,packBetaPairing} from '../../../packages/planner/src/native-beta';
import {quickPlan} from '../../../packages/contracts/src/protocol';
import {prepareBetaTLS} from '../../../scripts/native/beta-tls.mjs';

// These deliberately invalid leaf certificates must never pass the production
// certificate loader. Create them independently in this synthetic harness only.
async function negativeCertificate(directory:string,kind:'wrong-host'|'expired',port:number){
  await mkdir(directory,{mode:0o700});await mkdir(join(directory,'issued'),{mode:0o700});
  await writeFile(join(directory,'index.txt'),'');await writeFile(join(directory,'serial'),'01\n');
  const host=kind==='wrong-host'?'192.168.254.254':'127.0.0.1';
  await writeFile(join(directory,'test.cnf'),`[req]\nprompt=no\ndistinguished_name=dn\n[dn]\nCN=atepdf synthetic TLS test\n[ca]\ndefault_ca=issuer\n[issuer]\ndatabase=./index.txt\nnew_certs_dir=./issued\nserial=./serial\ncertificate=./ca.pem\nprivate_key=./ca-key.pem\ndefault_md=sha256\ndefault_days=7\npolicy=subject_policy\n[subject_policy]\ncommonName=supplied\n[ca_extensions]\nbasicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\n[server_extensions]\nsubjectAltName=IP:${host}\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n`,{mode:0o600});
  const run=(args:string[])=>assert.equal(spawnSync('/usr/bin/openssl',args,{cwd:directory,stdio:'ignore',timeout:30_000}).status,0,'Synthetic certificate generation');
  run(['req','-x509','-newkey','rsa:2048','-nodes','-sha256','-days','7','-config','test.cnf','-extensions','ca_extensions','-keyout','ca-key.pem','-out','ca.pem']);
  run(['req','-new','-newkey','rsa:2048','-nodes','-sha256','-config','test.cnf','-keyout','key.pem','-out','server.csr']);
  const utc=(date:Date)=>[date.getUTCFullYear()%100,date.getUTCMonth()+1,date.getUTCDate(),date.getUTCHours(),date.getUTCMinutes(),date.getUTCSeconds()].map(value=>String(value).padStart(2,'0')).join('')+'Z';
  const now=Date.now(),day=86_400_000;
  run(['ca','-batch','-notext','-config','test.cnf','-extensions','server_extensions','-startdate',utc(new Date(now-2*day)),'-enddate',utc(new Date(now+(kind==='expired'?-day:7*day))),'-in','server.csr','-out','leaf.pem']);
  const leaf=await readFile(join(directory,'leaf.pem')),ca=await readFile(join(directory,'ca.pem')),certificate=new X509Certificate(leaf),issuer=new X509Certificate(ca);
  assert.equal(certificate.ca,false);assert.equal(issuer.ca,true);assert.equal(certificate.verify(issuer.publicKey),true);
  if(kind==='wrong-host'){assert.equal(certificate.checkIP('127.0.0.1'),undefined);assert.equal(certificate.checkIP(host),host);assert.ok(Date.parse(certificate.validTo)>now);}
  else{assert.equal(certificate.checkIP('127.0.0.1'),'127.0.0.1');assert.ok(Date.parse(certificate.validTo)<now);}
  return {key:await readFile(join(directory,'key.pem')),cert:Buffer.concat([leaf,ca]),endpoint:{origin:`https://127.0.0.1:${port}`,fingerprint:certificate.fingerprint256.replaceAll(':','').toLowerCase()}};
}
async function main(){
  const directory=await mkdtemp(join(tmpdir(),'atepdf-native-tls-')),tls=await prepareBetaTLS(join(directory,'tls'),'127.0.0.1',3444),origin='http://localhost:3212';
  let calls=0;
  const gateway=createGateway({status:async()=>({connected:true,enabled:true,remaining:100}),reserve:async()=>({key:'synthetic-only',release:async()=>{}})},async request=>{calls++;if(/PRIVATE-CANARY|brief\.pdf|appendix\.pdf/.test(JSON.stringify(request)))throw new Error('Canary rejected.');return quickPlan(request,'merge').planner;},{minIntervalMs:0,nativeEndpoint:tls.endpoint,...(await fixture()).gatewayOptions});
  const server=createNativeBetaServer({gateway,origin:tls.endpoint.origin,loopbackOrigin:origin,key:tls.key,cert:tls.cert});
  server.listen(3444,'127.0.0.1');await once(server,'listening');
  const negativeRequests={'wrong-host':0,expired:0};
  const negatives=await Promise.all(([['wrong-host',3446],['expired',3447]] as const).map(async([kind,port])=>{
    const fixture=await negativeCertificate(join(directory,kind),kind,port);
    const listener=createTLSServer({key:fixture.key,cert:fixture.cert,minVersion:'TLSv1.2'},(_req,res)=>{
      // An accepted request gets a structurally valid pairing response, so a
      // rejection cannot pass merely because a fake server returned bad JSON.
      negativeRequests[kind]++;res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end(JSON.stringify({token:'a'.repeat(64),expiresAt:Date.now()+8*60*60_000}));
    });
    listener.on('tlsClientError',()=>{});listener.listen(port,'127.0.0.1');await once(listener,'listening');
    return {kind,fixture,listener};
  }));
  const admin=createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    if(req.url==='/test/evidence'){res.end(JSON.stringify({syntheticOnly:true,calls,negativeRequests}));return;}
    const negative=negatives.find(value=>req.url===`/test/pairing/${value.kind}`);
    if(negative){res.end(JSON.stringify(packBetaPairing({code:`atepdf-local:3212:${randomBytes(32).toString('hex')}`,expiresAt:Date.now()+300_000},negative.fixture.endpoint)));return;}
    if(req.url!=='/test/pairing'){res.writeHead(404);res.end('{}');return;}
    const status=await(await gateway(new Request(origin+'/api/planner/status'))).json();
    const pairing=await gateway(new Request(origin+'/api/planner/pairing',{method:'POST',headers:{origin,'content-type':'application/json','x-atepdf-token':status.token},body:'{}'}));res.end(await pairing.text());
  });
  admin.listen(3445,'127.0.0.1',()=>console.log('Synthetic Swift TLS harness: loopback 3444, test-only issuance 3445, invalid certificates 3446/3447. No paid calls.'));
  const stop=()=>{void Promise.all([server,admin,...negatives.map(value=>value.listener)].map(listener=>{listener.closeAllConnections();return new Promise<void>(resolve=>listener.close(()=>resolve()));})).then(()=>rm(directory,{recursive:true,force:true}));};
  process.once('SIGTERM',stop);process.once('SIGINT',stop);
}
void main();
