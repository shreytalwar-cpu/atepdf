// Synthetic authority only. Never imported by application code; all writers in tests are mocked/loopback.
import {OutboundGate,hostedAck,type Authority,type RecipientDisclosure,type TransferBinding} from '../../packages/planner/src/outbound/gate';
import {projectHosted} from '../../packages/planner/src/outbound/schema';
import type {Request} from '../../packages/contracts/src/protocol';
export function recipient(id:string,endpoints:string[]):RecipientDisclosure{return {
  recipientId:id,legalEntity:'Synthetic Test Entity',displayName:'Synthetic Test Recipient',role:id==='atepdf-relay'?'relay':'model_provider',endpoints,plaintextRecipients:[],regions:['synthetic'],
  retention:{applicationState:'not stored',abuseMonitoring:'synthetic 30 days',logs:'synthetic 7 days',objects:'not stored',backups:'not stored'},
  training:'disabled',dataSharing:'disabled',humanReview:'synthetic policy',relayLogging:'contentless',subprocessors:'synthetic/1',atepdfStorage:'not stored',deletion:'synthetic deletion',retryAndFailover:'no automatic failover',providerUserIdentifier:'none',disclosureVersion:id+'/1',verifiedAt:'2026-09-30T10:00:00Z',verifiedBy:'synthetic fixture',sources:['https://docs.example.test/synthetic'],status:'complete',
};}
export async function fixture(route=['provider-a']){
  const registry=[recipient('atepdf-relay',['https://relay.example.test/transfer']),recipient('provider-a',['https://api.openai.com/v1/responses','https://provider-a.example.test/transfer']),recipient('provider-b',['https://provider-b.example.test/transfer']),recipient('openai-development',['https://api.openai.com/v1/responses'])];
  const authority:Authority={hostedAiOn:true,registry,ack:await hostedAck(route,registry)};
  const clock={wall:Date.parse('2026-09-30T10:01:00Z'),monotonic:1000};
  const bindings=new Map<string,TransferBinding>();
  const gate=new OutboundGate(()=>authority,{approvedPurposes:['test_purpose'],clock:()=>clock,gesture:event=>event==='SYNTHETIC_TRUSTED_GESTURE',resolveBinding:id=>bindings.get(id)??null});
  return {gate,authority,registry,clock,bindings,route,boundary:{gate,route},gatewayOptions:{outbound:gate,recipientRoute:route}};
}
export function wireRequest(value:unknown):unknown{try{return projectHosted(value as Request);}catch{return value;}}
