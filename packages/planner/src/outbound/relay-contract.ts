import {CONTENT_CATEGORIES,PRIVACY_POLICY,type ContentCategory} from './constants';
import {exactKeys,isClassifiedArray,assertClassified,validateHosted,assertHostedText,hasNeverTransfer,type HostedPayload,type ContentPayload} from './schema';
import {canonical,routeVerdict,routeVersions,type RecipientDisclosure,type Verdict} from './gate';

/** Future relay boundary: no source/payload digests, secrets or grant objects cross the Mac boundary. */
export type RelayContract = {
  schema:'atepdf.relay-permission/1';route:string[];categories:ContentCategory[];purposeCode:string;
  hostedDisclosureVersion:string;policyVersion:string;
  recipientDisclosures:Array<{recipientId:string;disclosureVersion:string}>;idempotencyKey:string;
};
export function validateRelayContract(value:unknown,payload:HostedPayload|ContentPayload,registry:readonly RecipientDisclosure[],endpoint:string,previous?:{contract:RelayContract;bytes:string},approvedPurposes:readonly string[]=PRIVACY_POLICY.approvedContentPurposes):Verdict {
  const deny=(reason:Verdict['reason']):Verdict=>({outcome:'DENY',reason});
  try{
    exactKeys(value,['schema','route','categories','purposeCode','hostedDisclosureVersion','policyVersion','recipientDisclosures','idempotencyKey']);
    const c=value as unknown as RelayContract;
    if(c.schema!=='atepdf.relay-permission/1'||!isClassifiedArray(c.route)||!c.route.every(x=>typeof x==='string')||!isClassifiedArray(c.categories)||!c.categories.every(x=>CONTENT_CATEGORIES.includes(x))||!isClassifiedArray(c.recipientDisclosures)||!['purposeCode','hostedDisclosureVersion','policyVersion','idempotencyKey'].every(k=>typeof value[k]==='string'))return deny('unclassified_field');
    for(const r of c.recipientDisclosures){exactKeys(r,['recipientId','disclosureVersion']);if(typeof r.recipientId!=='string'||typeof r.disclosureVersion!=='string')return deny('unclassified_field');}
    const content=c.categories.length>0;assertClassified(payload,content?'content':'hosted');
    if(hasNeverTransfer(value)||hasNeverTransfer(payload))return deny('never_transfer');
    if(!content){validateHosted(payload);assertHostedText(payload as HostedPayload);}
    const route=routeVerdict({route:c.route,endpoint},{registry});if(route)return route;
    if(c.hostedDisclosureVersion!==PRIVACY_POLICY.hostedDisclosureVersion||c.policyVersion!==PRIVACY_POLICY.version||canonical(c.recipientDisclosures)!==canonical(routeVersions(c.route,registry)))return {outcome:'REQUIRE_DISCLOSURE',reason:'disclosure_required'};
    if(content&&!approvedPurposes.includes(c.purposeCode))return deny('purpose_not_approved');
    if(content&&canonical(c.categories)!==canonical((payload as ContentPayload).items.map(i=>i.category)))return deny('unclassified_field');
    if(!/^[a-zA-Z0-9_-]{1,128}$/.test(c.idempotencyKey))return deny('unclassified_field');
    if(previous&&(canonical(previous.contract)!==canonical(c)||previous.bytes!==canonical(payload)))return {outcome:'REQUIRE_RECONSENT',reason:canonical(previous.contract.route)!==canonical(c.route)?'recipient_changed':'payload_changed'};
    return {outcome:'ALLOW',reason:null};
  }catch{return deny('unclassified_field');}
}
