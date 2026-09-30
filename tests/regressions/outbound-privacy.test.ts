import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import cases from '../../docs/evidence/SHR-35-2026-09-30/consent-policy-cases.json';
import {buildRequest,quickPlan} from '../../packages/contracts/src/protocol';
import {projectHosted,OUTBOUND_FIELDS,type HostedPayload} from '../../packages/planner/src/outbound/schema';
import {PRIVACY_POLICY,CONTENT_CATEGORIES,sizeBucket} from '../../packages/planner/src/outbound/constants';
import {OutboundGate,OutboundDenied,canonical,hostedAck,type Proposal,type TransferBinding,type Verdict} from '../../packages/planner/src/outbound/gate';
import {validateRelayContract,type RelayContract} from '../../packages/planner/src/outbound/relay-contract';
import {sensitiveInstruction} from '../../packages/planner/src/outbound/sensitive';
import {outboundDiagnostic} from '../../packages/planner/src/outbound/diagnostics';
import {privateInstruction} from '../../packages/planner/src/privacy';
import {planWithOpenAI,MODEL} from '../../packages/planner/src/provider';
import {createGateway} from '../../packages/planner/src/gateway';
import {requestPlan} from '../../packages/planner/src/client';
import {fixture} from '../helpers/outbound-fixture';
import type {Artifact} from '../../packages/core/src/local-file-store';
const ref='file_00000000000000000000000000000001',other='file_00000000000000000000000000000002';
const bytes=(s:string)=>new TextEncoder().encode(s);
const localRequest=()=>buildRequest({revision:4,files:[{ref,kind:'pdf',pageCount:5,sizeBytes:23_456_789,encrypted:false}],selected:[ref],focus:null,originals:[ref]},'Merge these');
const hosted=(payload:HostedPayload=projectHosted(localRequest())):Proposal=>({kind:'hosted',payload,route:['atepdf-relay','provider-a'],endpoint:'https://relay.example.test/transfer',purposeCode:'interpret_instruction',idempotencyKey:'H1',transferId:'H1'});
async function contentFixture(){
  const f=await fixture(['atepdf-relay','provider-a']);
  const binding:TransferBinding={workspaceId:'ws-1',deletionEpoch:1,operation:{kind:'test_operation',planId:'plan-1',planDigest:'LOCAL_PLAN_DIGEST'},purpose:{code:'test_purpose',approvedPurposeVersion:'ap-1'},items:[{category:'ocr_text',sourceRef:ref,sourceRevision:4,sourceBytes:bytes('%PDF-SYNTHETIC-SOURCE'),pages:[3],derivation:{engine:'local-ocr',engineVersion:'1',paramsDigest:'LOCAL_PARAMS_DIGEST',runId:'r1'},itemBytes:bytes('SYNTHETIC OCR CONTENT')}],disclosureDigest:'LOCAL_DISCLOSURE_DIGEST',consentCopyVersion:PRIVACY_POLICY.consentCopyVersion,policyVersion:PRIVACY_POLICY.version};
  f.bindings.set('T',binding);
  const p:Proposal={kind:'content',payload:{items:[{category:'ocr_text',data:'SYNTHETIC OCR CONTENT'}]},route:[...f.route],endpoint:'https://relay.example.test/transfer',purposeCode:'test_purpose',idempotencyKey:'I1',transferId:'T'};
  const ui=f.gate.consentUI();
  const grant=async()=>{const presentation=await ui.present(()=>[p]);p.grantId=await ui.allow(presentation.presentationId,'SYNTHETIC_TRUSTED_GESTURE');return p.grantId;};
  return {...f,binding,p,ui,grant};
}
async function blocked(gate:OutboundGate,p:Proposal,outcome:Verdict['outcome'],reason?:Verdict['reason']){
  let outboundBytes=0,denial:OutboundDenied|undefined;
  try{await gate.write(()=>p,async body=>{outboundBytes+=bytes(body).length;return true;});}catch(e){assert.ok(e instanceof OutboundDenied);denial=e;}
  assert.equal(outboundBytes,0,'blocked payload must produce zero outbound bytes');
  assert.ok(denial);assert.equal(denial.verdict.outcome,outcome);if(reason)assert.equal(denial.verdict.reason,reason);
  assert.deepEqual(Object.keys(outboundDiagnostic(denial)).sort(),['event','reasonCode']);
  assert.doesNotMatch(JSON.stringify(outboundDiagnostic(denial)),/SYNTHETIC OCR|PDF-SYNTHETIC|LOCAL_.*DIGEST/);
}
async function allowed(gate:OutboundGate,p:Proposal){
  let written='';await gate.write(()=>p,async body=>{written=body;return true;});
  assert.equal(written,canonical(p.payload));assert.ok(bytes(written).length>0);
  assert.doesNotMatch(written,/sourceContentDigest|itemDigest|planDigest|workspaceId|deletionEpoch|grantId|disclosureDigest/);
  return JSON.parse(written);
}

test('ADR policy constants agree with the approved 40-case contract',()=>{
  assert.equal(cases.cases.length,40);assert.equal(PRIVACY_POLICY.grantTtlMs,cases.policyConstants.GRANT_TTL_SECONDS*1000);
  assert.deepEqual(PRIVACY_POLICY.sizeBuckets,cases.policyConstants.FILE_SIZE_BUCKETS);
  assert.deepEqual(PRIVACY_POLICY.approvedContentPurposes,cases.policyConstants.APPROVED_CONTENT_PURPOSES_V1);
  assert.deepEqual(PRIVACY_POLICY.autoRetry,cases.policyConstants.AUTO_RETRY_LIMIT);
  assert.equal(PRIVACY_POLICY.overlapWords,cases.policyConstants.DOCUMENT_TEXT_OVERLAP_WINDOW_WORDS);
  assert.equal(PRIVACY_POLICY.longIdentifierDigits,cases.policyConstants.LONG_IDENTIFIER_RUN_MIN_DIGITS);
  assert.equal(PRIVACY_POLICY.logRetentionDays,cases.policyConstants.LOCAL_LOG_RETENTION_DAYS);
  assert.equal(PRIVACY_POLICY.analytics,false);assert.equal(PRIVACY_POLICY.standingPermissions,false);
});
for(const policyCase of cases.cases)test(`ADR ${policyCase.id} outbound boundary`,async()=>{
  const f=await contentFixture(),{gate,p,binding,authority,clock}=f;
  const h=hosted();
  if(!['P01','P03','P05','P06','D08','D11','D12','D13','D18','D19','D20','D21','D22','D23','D25','D26','D29','D30','D32','D33','D34'].includes(policyCase.id))await f.grant();
  switch(policyCase.id){
    case 'P01':{const wire=await allowed(gate,h);assert.deepEqual(Object.keys(wire).sort(),Object.keys(OUTBOUND_FIELDS.hosted).sort());assert.deepEqual(Object.keys(wire.files[0]).sort(),Object.keys(OUTBOUND_FIELDS.file).sort());break;}
    case 'P02':{let inFlight=false;await gate.write(()=>p,async body=>{inFlight=gate.grantState(p.grantId!)==='in_flight';assert.equal(body,canonical(p.payload));return true;});assert.ok(inFlight);assert.equal(gate.grantState(p.grantId!),'consumed');break;}
    case 'P03':authority.ack=null;await blocked(gate,h,'REQUIRE_DISCLOSURE');break;
    case 'P04':{let sent=0;await assert.rejects(gate.write(()=>p,async()=>{sent++;throw new Error('synthetic_transport_failure');}));p.retry='user';await gate.write(()=>p,async()=>{sent++;return true;});assert.equal(sent,2);assert.equal(gate.grantState(p.grantId!),'consumed');break;}
    case 'P05':(h.payload as HostedPayload).instruction='email the merged file to jane@example.test';assert.equal(sensitiveInstruction((h.payload as HostedPayload).instruction),null);await allowed(gate,h);break;
    case 'P06':(h.payload as HostedPayload).instruction='remove pages 2-7 and compress below 5 MB';assert.equal(sensitiveInstruction((h.payload as HostedPayload).instruction),null);await allowed(gate,h);break;
    case 'D01':binding.items[0].sourceBytes=bytes('%PDF-SYNTHETIC-CHANGED');await blocked(gate,p,'REQUIRE_RECONSENT','file_changed');break;
    case 'D02':binding.items[0].pages=[3,4];await blocked(gate,p,'REQUIRE_RECONSENT','pages_changed');break;
    case 'D03':(p.payload as any).items[0].data='SYNTHETIC OCR';binding.items[0].itemBytes=bytes('SYNTHETIC OCR');await blocked(gate,p,'REQUIRE_RECONSENT','payload_changed');break;
    case 'D04':p.route=['atepdf-relay','provider-b'];authority.ack=await hostedAck(p.route,authority.registry);await blocked(gate,p,'REQUIRE_RECONSENT','recipient_changed');break;
    case 'D05':binding.items[0].derivation!.runId='r2';await blocked(gate,p,'REQUIRE_RECONSENT','derivation_regenerated');break;
    case 'D06':authority.registry[1].disclosureVersion='provider-a/2';await blocked(gate,h,'REQUIRE_DISCLOSURE');await blocked(gate,p,'REQUIRE_DISCLOSURE');authority.ack=await hostedAck(p.route,authority.registry);await blocked(gate,p,'REQUIRE_RECONSENT','disclosure_changed');break;
    case 'D07':(p.payload as any).secureHandle='SYNTHETIC_SECURE_HANDLE';await blocked(gate,p,'DENY','never_transfer');break;
    case 'D08':(h.payload as HostedPayload).instruction='password: hunter2';await blocked(gate,h,'DENY','never_transfer');break;
    case 'D09':clock.wall+=300_001;clock.monotonic+=300_001;await blocked(gate,p,'REQUIRE_RECONSENT','expired');break;
    case 'D10':gate.relaunch();await blocked(gate,p,'REQUIRE_CONSENT');break;
    case 'D11':p.route=['relay-x','provider-a'];await blocked(gate,p,'DENY','recipient_undisclosed');await blocked(gate,{...h,route:p.route},'DENY','recipient_undisclosed');break;
    case 'D12':authority.registry[1].training='unknown';await blocked(gate,p,'DENY','disclosure_incomplete');await blocked(gate,h,'DENY','disclosure_incomplete');break;
    case 'D13':authority.registry[1].retention.abuseMonitoring='unknown';await blocked(gate,p,'DENY','disclosure_incomplete');await blocked(gate,h,'DENY','disclosure_incomplete');break;
    case 'D14':gate.cancel(p.grantId!);assert.equal(gate.grantState(p.grantId!),'cancelled');await blocked(gate,p,'REQUIRE_CONSENT');break;
    case 'D15':await assert.rejects(gate.write(()=>p,async()=>{throw new Error('transport');}));p.retry='user';p.route=['atepdf-relay','provider-b'];authority.ack=await hostedAck(p.route,authority.registry);await blocked(gate,p,'REQUIRE_RECONSENT','recipient_changed');break;
    case 'D16':await assert.rejects(gate.write(()=>p,async()=>{throw new Error('transport');}));p.retry='user';(p.payload as any).items.push({category:'ocr_text',data:'SYNTHETIC PAGE FOUR'});binding.items.push({...binding.items[0],pages:[4],itemBytes:bytes('SYNTHETIC PAGE FOUR')});await blocked(gate,p,'REQUIRE_RECONSENT','payload_changed');break;
    case 'D17':await allowed(gate,p);await blocked(gate,p,'REQUIRE_CONSENT');break;
    case 'D18':p.purposeCode='summarise_document';await blocked(gate,p,'DENY','purpose_not_approved');break;
    case 'D19':{const productionPurposeGate=new OutboundGate(()=>authority);await blocked(productionPurposeGate,p,'DENY','purpose_not_approved');break;}
    case 'D20':(h.payload as any).debugContext={nested:'SYNTHETIC_CONTENT'};await blocked(gate,h,'DENY','unclassified_field');break;
    case 'D21':(h.payload as any).fileName='synthetic-client.pdf';await blocked(gate,h,'DENY','unclassified_field');break;
    case 'D22':(h.payload as any).files[0].sizeBytes=23_456_789;await blocked(gate,h,'DENY','unclassified_field');break;
    case 'D23':{const presentation=await f.ui.present(()=>[p]);await assert.rejects(f.ui.allow(presentation.presentationId,{consent:'granted',userGesture:'pointer'}));assert.equal(p.grantId,undefined);await blocked(gate,p,'REQUIRE_CONSENT');break;}
    case 'D24':authority.hostedAiOn=false;await blocked(gate,p,'DENY','hosted_off');assert.equal(gate.grantState(p.grantId!),'revoked');break;
    case 'D25':{const artifact={ref,pageCount:5,sizeBytes:23_456_789,name:'synthetic-invoice.pdf',checksum:'a'.repeat(64),inspection:{pages:[{text:'SYNTHETIC OCR CONTENT MUST STAY LOCAL'}]}} as Artifact;gate.bindLocalWorkspace(()=>({revision:4,artifacts:[artifact]}));(h.payload as HostedPayload).instruction='SYNTHETIC OCR CONTENT MUST STAY LOCAL';await blocked(gate,h,'DENY','purpose_not_approved');break;}
    case 'D26':(h.payload as HostedPayload).instruction='Use 4111 1111 1111 1111';await blocked(gate,h,'DENY','never_transfer');await assert.rejects(f.ui.confirmSensitiveInstruction(h,'SYNTHETIC_TRUSTED_GESTURE'));break;
    case 'D33':case 'D34':{const value=policyCase.id==='D33'?'GB82 WEST 1234 5698 7654 32':'123456789012';(h.payload as HostedPayload).instruction=`Handle reference ${value}`;assert.ok(sensitiveInstruction((h.payload as HostedPayload).instruction));await blocked(gate,h,'DENY','sensitive_instruction');await f.ui.confirmSensitiveInstruction(h,'SYNTHETIC_TRUSTED_GESTURE');await allowed(gate,h);break;}
    case 'D27':clock.wall-=600_000;clock.monotonic+=1;await blocked(gate,p,'REQUIRE_RECONSENT','clock_invalid');break;
    case 'D28':gate.clearWorkspace();binding.deletionEpoch++;await blocked(gate,p,'REQUIRE_RECONSENT','workspace_cleared');break;
    case 'D29':{const old=await f.ui.present(()=>[p]);binding.items[0].pages=[4];await assert.rejects(f.ui.allow(old.presentationId,'SYNTHETIC_TRUSTED_GESTURE'),(e:OutboundDenied)=>e.verdict.outcome==='REQUIRE_RECONSENT');const redraw=await f.ui.present(()=>[p],old.presentationId);assert.equal(redraw.allowAfterMonotonic,clock.monotonic+1000);await assert.rejects(f.ui.allow(redraw.presentationId,'SYNTHETIC_TRUSTED_GESTURE'));await blocked(gate,p,'REQUIRE_CONSENT');break;}
    case 'D30':p.purposeCode='support_bundle';(p.payload as any).items[0].category='support_bundle';await blocked(gate,p,'DENY','purpose_not_approved');assert.deepEqual(outboundDiagnostic({body:'SYNTHETIC_ATTACHED_DOCUMENT'}),{event:'outbound_blocked',reasonCode:'outbound_failed'});break;
    case 'D31':{const second={...p,transferId:'T2'};f.bindings.set('T2',binding);await blocked(gate,second,'REQUIRE_CONSENT');break;}
    case 'D32':p.endpoint='https://unapproved.example.test/transfer';await blocked(gate,p,'DENY','recipient_undisclosed');await blocked(gate,{...h,endpoint:p.endpoint},'DENY','recipient_undisclosed');break;
    default:assert.fail('Unmapped ADR case');
  }
});

test('H projection includes active refs/buckets and bounded clarification, excluding every unrelated history artifact',async()=>{
  const r=localRequest();r.files.push({ref:other,kind:'pdf',pageCount:99,sizeBytes:12_345_678,encrypted:false});
  r.pendingClarification={originalRequestId:'req_'+'b'.repeat(32),workspaceRevision:4,originalInstruction:'Remove a page',question:'Which page?',choices:['Page 1','Page 3'],answers:[{question:'Which file?',answer:'The first'}],selectionRefs:[ref],focusedResultRef:null,originalRefs:[ref]};r.instruction='Page 3';
  const h=projectHosted(r);assert.equal(h.files.length,1);assert.equal(h.files[0].sizeBucket,'10-50MB');assert.doesNotMatch(JSON.stringify(h),new RegExp(other+'|12345678|23456789|sizeBytes'));
  const f=await fixture(['atepdf-relay','provider-a']);await allowed(f.gate,hosted(h));
  h.selectorCapabilities=['invoice','scanned_pages'];h.results=[{ref,status:'created',pageCount:5,outcome:'complete'}];const fresh=await fixture(['atepdf-relay','provider-a']);await allowed(fresh.gate,hosted(h));
  assert.deepEqual([0,999999,1000000,10000000,10000001,50000000,50000001].map(sizeBucket),['<1MB','<1MB','1-10MB','1-10MB','10-50MB','10-50MB','>50MB']);
});
test('content and hidden nested canaries deny with zero writes; all declared C categories require an approved purpose',async()=>{
  const canaries={pdfBytes:'%PDF-SYNTHETIC',fileName:'synthetic-client.pdf',ocrText:'SYNTHETIC OCR',extractedText:'SYNTHETIC EXTRACT',localLabel:'invoice',summary:'SYNTHETIC SUMMARY',contentHash:'b'.repeat(64),sizeBytes:1234567,debugContext:{hidden:'SYNTHETIC NESTED'},selectorResults:{invoice:ref}};
  for(const [key,value]of Object.entries(canaries)){const f=await fixture(['atepdf-relay','provider-a']),p=hosted();(p.payload as any)[key]=value;await blocked(f.gate,p,'DENY','unclassified_field');}
  for(const category of CONTENT_CATEGORIES){const f=await contentFixture();(f.p.payload as any).items[0].category=category;const real=new OutboundGate(()=>f.authority);await blocked(real,f.p,'DENY','purpose_not_approved');}
  for(const mutate of [(h:any)=>h.files[0].debug={secret:'SYNTHETIC'},(h:any)=>h.instruction={hidden:'SYNTHETIC'},(h:any)=>h.selectionRefs=[{debug:'SYNTHETIC'}]]){const f=await fixture(['atepdf-relay','provider-a']),p=hosted();mutate(p.payload);await blocked(f.gate,p,'DENY','unclassified_field');}
});
test('N cannot be overridden by an exact grant, UI confirmation, build configuration or nested placement',async()=>{
  for(const key of Object.keys(OUTBOUND_FIELDS.never)){const f=await contentFixture();await f.grant();(f.p.payload as any)[key]='SYNTHETIC NEVER';await blocked(f.gate,f.p,'DENY','never_transfer');}
  for(const text of ['my password hunter2','AKIAABCDEFGHIJKLMNOP','ghp_syntheticcredentialvalue','eyJsynthetic.eyJsynthetic.signature','Bearer synthetic-token-value','/Users/synthetic/private','C:\\synthetic\\private','password: hunter2']){const f=await fixture(['atepdf-relay','provider-a']),p=hosted();(p.payload as HostedPayload).instruction=text;await blocked(f.gate,p,'DENY','never_transfer');await assert.rejects(f.gate.consentUI().confirmSensitiveInstruction(p,'SYNTHETIC_TRUSTED_GESTURE'));}
  const f=await fixture(['atepdf-relay','provider-a']),p=hosted();(p.payload as any).debugContext={password:'synthetic'};await blocked(f.gate,p,'DENY','unclassified_field');
});
test('grant is recomputed at write; source, selection, payload, workspace and disclosure TOCTOU mutations produce zero bytes',async()=>{
  for(const mutate of [(f:Awaited<ReturnType<typeof contentFixture>>)=>{f.binding.items[0].sourceBytes[0]++;},f=>{f.binding.items[0].pages=[4];},f=>{(f.p.payload as any).items[0].data+='changed';},f=>{f.binding.workspaceId='ws-2';},f=>{f.clock.wall+=300_001;},f=>{f.authority.registry[1].disclosureVersion='provider-a/2';}]){
    const f=await contentFixture();await f.grant();let reads=0,sent=0;
    await assert.rejects(f.gate.write(()=>{if(++reads===2)mutate(f);return f.p;},async body=>{sent+=bytes(body).length;}));assert.equal(sent,0);
  }
});
test('retry identity is exact; H permits one automatic retry, C permits no automatic retry, changed purpose/idempotency/route/bytes do not send',async()=>{
  const f=await fixture(['atepdf-relay','provider-a']),p=hosted();await assert.rejects(f.gate.write(()=>p,async()=>{throw new Error('transport');}));p.retry='automatic';await assert.rejects(f.gate.write(()=>p,async()=>{throw new Error('transport');}));await blocked(f.gate,p,'DENY','retry_limit');
  const c=await contentFixture();await c.grant();await assert.rejects(c.gate.write(()=>c.p,async()=>{throw new Error('transport');}));c.p.retry='automatic';await blocked(c.gate,c.p,'DENY','retry_limit');
  for(const key of ['idempotencyKey','purposeCode']){const t=await fixture(['atepdf-relay','provider-a']),h=hosted();await assert.rejects(t.gate.write(()=>h,async()=>{throw new Error('transport');}));h.retry='user';(h as any)[key]='changed';await blocked(t.gate,h,'REQUIRE_RECONSENT','payload_changed');}
});
test('cancel before write and restore never call a writer or serialize grants',async()=>{
  const f=await contentFixture();await f.grant();const abort=new AbortController();abort.abort();let sent=0;await assert.rejects(f.gate.write(()=>f.p,async()=>{sent++;},abort.signal));assert.equal(sent,0);
  assert.equal(JSON.stringify(f.gate),'{}');f.gate.relaunch();await blocked(f.gate,f.p,'REQUIRE_CONSENT');
});
test('relay contract validates route, class categories, purpose, disclosure versions and idempotency without local digests',async()=>{
  const f=await contentFixture(),contract:RelayContract={schema:'atepdf.relay-permission/1',route:f.route,categories:['ocr_text'],purposeCode:'test_purpose',hostedDisclosureVersion:PRIVACY_POLICY.hostedDisclosureVersion,policyVersion:PRIVACY_POLICY.version,recipientDisclosures:f.route.map(id=>({recipientId:id,disclosureVersion:f.registry.find(r=>r.recipientId===id)!.disclosureVersion})),idempotencyKey:'I1'};
  const check=(c:unknown)=>validateRelayContract(c,f.p.payload,f.registry,f.p.endpoint,undefined,['test_purpose']);
  assert.equal(check(contract).outcome,'ALLOW');assert.equal(check({...contract,route:['unknown']}).outcome,'DENY');assert.equal(check({...contract,categories:['password']}).outcome,'DENY');assert.equal(check({...contract,purposeCode:'unknown'}).outcome,'DENY');assert.equal(check({...contract,policyVersion:'stale'}).outcome,'REQUIRE_DISCLOSURE');
  assert.equal(validateRelayContract({...contract,idempotencyKey:'I2'},f.p.payload,f.registry,f.p.endpoint,{contract,bytes:canonical(f.p.payload)},['test_purpose']).outcome,'REQUIRE_RECONSENT');
  assert.doesNotMatch(canonical(contract),/Digest|checksum|sourceRef|grant/);
  const hidden=structuredClone(contract);Object.defineProperty(hidden.route,'debugContext',{value:'SYNTHETIC HIDDEN',enumerable:false});assert.equal(check(hidden).outcome,'DENY');
  const h={...contract,categories:[]},request=projectHosted(localRequest());request.instruction='synthetic-client.pdf';assert.equal(validateRelayContract(h,request,f.registry,f.p.endpoint).outcome,'DENY');
});
test('known display-title aliases close G2; OCR overlap and ambiguous filenames stay local',()=>{
  const artifact={ref,name:'invoice-acme.pdf',checksum:'a'.repeat(64),inspection:{pages:[{text:'SYNTHETIC OCR CONTENT MUST STAY LOCAL'}]}} as Artifact;
  assert.equal(privateInstruction('Merge invoice-acme with the current result',[artifact]),`Merge ${ref} with the current result`);
  assert.throws(()=>privateInstruction('Merge invoice-acme',[artifact,{...artifact,ref:other}]));assert.throws(()=>privateInstruction('SYNTHETIC OCR CONTENT MUST STAY LOCAL',[artifact]));
});
test('production provider cannot silently inherit OPENAI_BASE_URL or run before disclosure; denied errors/logs are contentless',async()=>{
  let outboundBytes=0;const writer:typeof fetch=async(_u,i)=>{outboundBytes+=bytes(String(i?.body)).length;return Response.json({});};
  await assert.rejects(planWithOpenAI(localRequest(),'sk-synthetic-never-network',new AbortController().signal,writer));assert.equal(outboundBytes,0);
  const previous=process.env.OPENAI_BASE_URL;try{process.env.OPENAI_BASE_URL='https://unapproved.example.test/v1';const f=await fixture();await assert.rejects(planWithOpenAI(localRequest(),'sk-synthetic-never-network',new AbortController().signal,writer,f.boundary));assert.equal(outboundBytes,0);}finally{if(previous===undefined)delete process.env.OPENAI_BASE_URL;else process.env.OPENAI_BASE_URL=previous;}
});
test('real SDK fetch boundary sends a positive H envelope with buckets, pinned route and contentless error receipts',async()=>{
  const f=await fixture(),req=localRequest();let sent=0;
  const response=await planWithOpenAI(req,'sk-synthetic-never-network',new AbortController().signal,async(url,init)=>{
    sent++;assert.equal(String(url),'https://api.openai.com/v1/responses');assert.equal(init!.redirect,'error');const body=JSON.parse(String(init!.body));
    const h=JSON.parse(body.input[1].content[0].text);assert.equal(h.files[0].sizeBucket,'10-50MB');assert.equal(h.files[0].sizeBytes,undefined);assert.doesNotMatch(JSON.stringify(h),/23456789|checksum|name|sourceContentDigest/);
    return Response.json({id:'resp_synthetic',created_at:1,model:MODEL,status:'completed',error:null,incomplete_details:null,output:[{id:'fc_synthetic',type:'function_call',status:'completed',call_id:'call_synthetic',name:'undo_last_change',arguments:'{}'}],usage:{input_tokens:1,output_tokens:1,total_tokens:2,input_tokens_details:{cached_tokens:0},output_tokens_details:{reasoning_tokens:0}}});
  },f.boundary);assert.equal(response.status,'undo');assert.equal(sent,1);
  const g=await fixture();let receipt:unknown;try{await planWithOpenAI(req,'sk-synthetic-never-network',new AbortController().signal,async()=>Response.json({error:{message:'SYNTHETIC_SECRET_PROVIDER_BODY'}},{status:500}),g.boundary);}catch(e){receipt=e;}assert.doesNotMatch(String(receipt),/SYNTHETIC_SECRET_PROVIDER_BODY|sk-synthetic/);assert.equal((receipt as Error).message,'provider_request_failed');
});
test('browser and gateway reject raw DTO canaries before writes/reservations; live evidence writer never stores bodies',async t=>{
  let writes=0;const m=t.mock.method(globalThis,'fetch',async()=>{writes++;return Response.json({});});
  await assert.rejects(requestPlan({...localRequest(),instruction:'password: SYNTHETIC_SECRET'},'synthetic-token',new AbortController().signal));assert.equal(writes,0);m.mock.restore();
  let reserves=0,calls=0;const gateway=createGateway({status:async()=>({connected:true,enabled:true,remaining:1}),reserve:async()=>{reserves++;return {key:'sk-synthetic',release:async()=>{}};}},async r=>{calls++;return quickPlan(r,'remove',1).planner;});
  const status=await(await gateway(new Request('http://localhost:3211/api/planner/status'))).json();const reply=await gateway(new Request('http://localhost:3211/api/planner',{method:'POST',headers:{origin:'http://localhost:3211','content-type':'application/json','x-atepdf-token':status.token},body:JSON.stringify(projectHosted(localRequest()))}));assert.equal(reply.status,403);assert.equal(reserves,0);assert.equal(calls,0);
  const source=await readFile('tests/live/planner.live.ts','utf8');assert.doesNotMatch(source,/postDataJSON|innerText|errors\.push\(e\.message\)|body:unknown/);
});
test('native admission key sets mirror the single outbound field authority; reserved H enums and buckets stay bounded',async()=>{
  const swift=await readFile('apps/universal/modules/atepdf-planner/ios/AtepdfPlannerTransport.swift','utf8');
  for(const [native,table]of [['keys',OUTBOUND_FIELDS.hosted],['optionalKeys',OUTBOUND_FIELDS.optionalHosted],['fileKeys',OUTBOUND_FIELDS.file],['pendingKeys',OUTBOUND_FIELDS.pending]] as const){
    const literal=swift.match(new RegExp(`let ${native}: Set<String> = (\\[[^\\n]+\\])`))![1];
    assert.deepEqual(JSON.parse(literal).sort(),Object.keys(table).sort());
  }
  assert.ok(swift.includes(JSON.stringify(PRIVACY_POLICY.sizeBuckets)));
  assert.match(swift,/guard let expression = try\? NSRegularExpression/);
});
test('invalidated grants cannot revive after a source change is reverted; every binding component is checked',async()=>{
  const changes:Array<[string,(b:TransferBinding)=>void,Verdict['reason']]>=[
    ['source revision',b=>b.items[0].sourceRevision++,'file_changed'],['plan ID',b=>b.operation.planId='new-plan','plan_changed'],['plan digest',b=>b.operation.planDigest='new-local-digest','plan_changed'],['operation',b=>b.operation.kind='new-operation','plan_changed'],['purpose version',b=>b.purpose.approvedPurposeVersion='ap-2','purpose_changed'],['consent copy',b=>b.consentCopyVersion='copy-2','copy_changed'],['policy',b=>b.policyVersion='pol-2','policy_changed'],['disclosure text',b=>b.disclosureDigest='new-local-disclosure','disclosure_changed'],['derivation params',b=>b.items[0].derivation!.paramsDigest='p-2','derivation_regenerated'],['source ref',b=>b.items[0].sourceRef=other,'file_changed'],
  ];
  for(const [_name,change,reason]of changes){const f=await contentFixture();await f.grant();const old=structuredClone(f.binding);change(f.binding);await blocked(f.gate,f.p,'REQUIRE_RECONSENT',reason);f.bindings.set('T',old);await blocked(f.gate,f.p,'REQUIRE_RECONSENT',reason);}
  const f=await contentFixture();await f.grant();f.clock.monotonic+=300_001;await blocked(f.gate,f.p,'REQUIRE_RECONSENT','expired');
});
test('hidden descriptors and prototype data cannot evade classification; never-transfer presence always denies',async()=>{
  for(const hidden of ['password','apiKey']){const f=await fixture(['atepdf-relay','provider-a']),p=hosted();Object.defineProperty(p.payload,hidden,{value:'SYNTHETIC HIDDEN SECRET',enumerable:false});await blocked(f.gate,p,'DENY','never_transfer');}
  const f=await fixture(['atepdf-relay','provider-a']),p=hosted();Object.defineProperty(p.payload,'debugContext',{value:'SYNTHETIC HIDDEN CONTENT',enumerable:false});await blocked(f.gate,p,'DENY','unclassified_field');
  const g=await fixture(['atepdf-relay','provider-a']),q=hosted();Object.setPrototypeOf(q.payload,{debugContext:'SYNTHETIC PROTOTYPE'});await blocked(g.gate,q,'DENY','unclassified_field');
  for(const mutate of [(h:HostedPayload)=>{Object.defineProperty(h.files,'debugContext',{value:'SYNTHETIC HIDDEN',enumerable:false});},h=>{delete h.selectionRefs[0];},h=>{Object.defineProperty(h.files,'0',{get:()=>({debug:'SYNTHETIC'}),enumerable:true});}]){const a=await fixture(['atepdf-relay','provider-a']),p=hosted();mutate(p.payload as HostedPayload);await blocked(a.gate,p,'DENY','unclassified_field');}
});
test('sensitive H confirmation is bound to the recipient route and exact payload, and never acknowledges N',async()=>{
  const f=await fixture(['atepdf-relay','provider-a']),p=hosted();(p.payload as HostedPayload).instruction='Handle reference 123456789012';await f.gate.consentUI().confirmSensitiveInstruction(p,'SYNTHETIC_TRUSTED_GESTURE');
  p.route=['atepdf-relay','provider-b'];f.authority.ack=await hostedAck(p.route,f.registry);await blocked(f.gate,p,'DENY','sensitive_instruction');
  (p.payload as HostedPayload).instruction='Handle reference 123456789013';await blocked(f.gate,p,'DENY','sensitive_instruction');
});
test('cancelled presentations cannot create grants; a late Cancel and raw transport errors remain contentless',async()=>{
  const f=await contentFixture(),view=await f.ui.present(()=>[f.p]);f.ui.cancel(view.presentationId);await assert.rejects(f.ui.allow(view.presentationId,'SYNTHETIC_TRUSTED_GESTURE'));await blocked(f.gate,f.p,'REQUIRE_CONSENT');
  const g=await contentFixture();await g.grant();const signal=new AbortController();let read=0,writes=0;
  await assert.rejects(g.gate.write(()=>{if(++read===2)signal.abort('SYNTHETIC_SECRET_ABORT_REASON');return g.p;},async()=>{writes++;},signal.signal),(e:Error)=>e.name==='AbortError'&&!e.message.includes('SYNTHETIC_SECRET'));
  assert.equal(writes,0);
  const h=await fixture(['atepdf-relay','provider-a']),stable=hosted();await assert.rejects(h.gate.write(()=>stable,async()=>{throw new Error('SYNTHETIC_SECRET_RESPONSE');}),(e:Error)=>e.message==='outbound_transport_failed');
  const malicious=new OutboundDenied({outcome:'DENY',reason:'SYNTHETIC_SECRET_REASON' as any});assert.doesNotMatch(JSON.stringify(outboundDiagnostic(malicious)),/SYNTHETIC_SECRET/);
});
test('grant binds idempotency before first send; malformed disclosure and sensitive clarification deny with zero bytes',async()=>{
  const c=await contentFixture();await c.grant();c.p.idempotencyKey='I2';await blocked(c.gate,c.p,'REQUIRE_RECONSENT','payload_changed');
  const f=await fixture(['atepdf-relay','provider-a']);(f.authority.registry[1] as any).regions=5;await blocked(f.gate,hosted(),'DENY','disclosure_incomplete');
  const p=projectHosted(localRequest());p.pendingClarification={originalRequestId:'req_'+'b'.repeat(32),workspaceRevision:4,originalInstruction:'Handle reference 123456789012',question:'Which page?',choices:['Page 1'],answers:[],selectionRefs:[ref],focusedResultRef:null,originalRefs:[ref]};p.instruction='Page 1';const a=await fixture(['atepdf-relay','provider-a']);await blocked(a.gate,hosted(p),'DENY','sensitive_instruction');
  const invalidClock=await contentFixture();invalidClock.clock.wall=Number.NaN;await assert.rejects(invalidClock.grant(),(e:OutboundDenied)=>e.verdict.reason==='clock_invalid');await blocked(invalidClock.gate,invalidClock.p,'REQUIRE_CONSENT');
  const reversed=await contentFixture(),shown=await reversed.ui.present(()=>[reversed.p]);reversed.clock.wall--;await assert.rejects(reversed.ui.allow(shown.presentationId,'SYNTHETIC_TRUSTED_GESTURE'),(e:OutboundDenied)=>e.verdict.reason==='clock_invalid');await blocked(reversed.gate,reversed.p,'REQUIRE_CONSENT');
});
