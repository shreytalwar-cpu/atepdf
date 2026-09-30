import {OutboundDenied,REASON_CODES} from './gate';
/** The only privacy error receipt. Inputs/provider bodies are never copied or serialized. */
export function outboundDiagnostic(error:unknown){return {event:'outbound_blocked' as const,reasonCode:error instanceof OutboundDenied&&error.verdict.reason&&REASON_CODES.includes(error.verdict.reason)?error.verdict.reason:'outbound_failed'};}
