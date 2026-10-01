export const TRANSPORT_REASONS=['destination_not_allowed','redirect_not_allowed','response_too_large','response_truncated','provider_response_invalid'] as const;
export type TransportReason=typeof TRANSPORT_REASONS[number];
const messages:Record<TransportReason,string>={destination_not_allowed:'AI destination is not approved. No files changed.',redirect_not_allowed:'AI connection redirected. No files changed.',response_too_large:'AI response exceeded the supported size. No files changed.',response_truncated:'AI response was interrupted. No files changed.',provider_response_invalid:'AI response could not be accepted. No files changed.'};
export class TransportDenied extends Error {
  constructor(readonly code:TransportReason,readonly statusCode?:number){super(messages[code]);this.name='TransportDenied';}
}
