/** Owner G1: one named development record, outside every release entry graph.
 * Synthetic development work only. This is deliberately NOT imported by gate.ts,
 * gateway.ts, an app, or a normal build entry. No environment toggle exists.
 * Unknown account disclosures cannot be replaced with synthetic fixture claims.
 */
import {OutboundGate,type Authority,type HostedDisclosureAck,type RecipientDisclosure} from '../src/outbound/gate';

export const openaiDevelopmentRecipient:Readonly<RecipientDisclosure>=Object.freeze({
  recipientId:'openai-development',displayName:'OpenAI — synthetic development only',role:'model_provider',
  legalEntity:'UNKNOWN: the development account contracting entity has not been verified',
  endpoints:['https://api.openai.com/v1/responses'],plaintextRecipients:[],
  regions:['UNKNOWN: development project processing and log locations are not verified'],
  retention:{applicationState:'UNKNOWN: verify Responses store:false and account controls',abuseMonitoring:'UNKNOWN: no account-specific ZDR or MAM approval verified',logs:'UNKNOWN: verify account logging and human access',objects:'No atePDF file upload path is approved',backups:'UNKNOWN: provider backup handling is not verified'},
  training:'UNKNOWN: development organisation and project sharing settings are not verified',
  dataSharing:'UNKNOWN: account opt-in settings are not verified',humanReview:'UNKNOWN: account-specific handling is not verified',
  relayLogging:'No atePDF cloud relay is configured for this development route',
  subprocessors:'UNKNOWN: relevant provider subprocessors must be reviewed before completing this record',
  atepdfStorage:'PDFs and derived contents remain local; this route is H-only',
  deletion:'UNKNOWN: provider retention and deletion commitments require verification',
  retryAndFailover:'Same gate: one identical H retry; no C or automatic failover',providerUserIdentifier:'No provider user identifier is added',
  disclosureVersion:'openai-development/1',verifiedAt:'2026-09-30T00:00:00Z',
  verifiedBy:'Closeout source audit: routing and missing evidence only; not an account attestation',
  sources:['https://developers.openai.com/api/docs/guides/your-data','https://openai.com/policies/services-agreement/','https://openai.com/policies/sub-processor-list/'],
  status:'incomplete',
});

/** Ack is explicit caller state, never minted from a model, env var or pairing code.
 * Even an ack cannot make the incomplete disclosure above sendable.
 */
export function developmentGate(readAck:()=>HostedDisclosureAck|null){
  const record=structuredClone(openaiDevelopmentRecipient);
  const authority=():Authority=>({hostedAiOn:true,ack:readAck(),registry:[record]});
  return new OutboundGate(authority);
}
