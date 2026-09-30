import type {Request, Step} from '../../../packages/contracts/src/protocol';

export const CORPUS_VERSION = '1.0.0';
export const CATEGORIES = ['single_tool','multi_step','follow_up','ambiguity','clarification','stale_revision','safe_controls','unsupported','local_selectors','collections','protect_last','quality_permission','entitlement','no_work'] as const;
export type Category = typeof CATEGORIES[number];
export type LocalFile = {ref:string; name:string; pageCount:number; text?:string; sourceRevision:number; sizeBytes?:number};
export type Context = {revision:number;files:LocalFile[];selectionRefs:string[];originalRefs:string[];history:string[];capabilities:string[];selectors:{kind:string;refs:string[];pages:number[];revision:number;certain:boolean;evidence?:string}[]};
export type Scope = {operation:string;purpose:string;recipients:string[];refs:string[];pages:number[];revision:number;categories:string[]};
/** Eval-only receipt, not the still-open SHR-35 production contract. */
export type Consent = {hostedCommands:boolean;receipt: (Scope & {revoked:boolean}) | null};
export type Turn = {message:string;event:'submit'|'quick'|'control';action?:string;page?:number;context?:Context;afterPlanningRevision?:number;requestExtras?:Record<string,unknown>;qualityApproved?:boolean};
export type Scenario = {schemaVersion:'1.0';id:string;family:string;category:Category;description:string;priorConversation?:{role:'user'|'assistant';message:string}[];context:Context;turns:Turn[];consent:Consent;entitlement:{mode:'not_integrated'|'gateway_allowance';remaining:number};canaries:{value:string;kind:'document'|'derived'|'filename'|'path'|'secret'}[];metadata:{requirements:string[];basis:'current_contract'|'approved_target';notes:string}};
export type ExpectedTurn = {status:string;reasonCodes:string[];clarify:boolean;providerCalls:number;accepted:boolean;tools:string[];plan?:unknown;rejection?:string;control?:string;qualityConfirmation?:boolean;forbiddenTools:string[];ordering:{before:string;after:string}[];clarificationChoices?:string[];clarificationTopic?:'file'|'page'|'order';allowContentTransfer?:boolean};
export type AnswerKey = {schemaVersion:'1.0';id:string;turns:ExpectedTurn[]};
export type Recording = {toolName:string;input:unknown};
export type Outbound = {kind:'command'|'content';recipient:string;payload:unknown;scope?:Scope};
export type TurnObservation = {status:string;reasonCode:string|null;rawResponse:unknown;request:Request|null;accepted:boolean;rejection:string|null;providerCalls:number;outbound:Outbound[];toolInvocations:Step[];control:string|null;qualityConfirmation:boolean;focus:string|null;revision:number;pendingInstruction:string|null};
export type Observation = {id:string;turns:TurnObservation[]};
export type CandidateConfig = {systemPrompt?:string;developerPrompt?:string;toolDescriptions?:Record<string,string>;clarificationPolicy?:string;model?:string;effort?:string;routingPolicy?:string};
/** Adapter receives inputs and parameters only. No expectations or baseline recordings. */
export type Adapter = {name:string;evaluate:(scenario:Scenario,config:CandidateConfig)=>Promise<Observation>};
export type FailureGroup = 'tool_selection'|'ordering'|'references'|'pages'|'clarification'|'stale_revision'|'privacy'|'schema'|'unsupported_tool'|'provider_calls'|'entitlement_safety'|'refusal';
export type Failure = {turn:number;group:FailureGroup;message:string};
export type Grade = {id:string;category:Category;passed:boolean;failures:Failure[];turns:number;planCorrect:number;planTotal:number;toolCorrect:number;invocationCorrect:number;clarification:{false:number;missed:number;correct:number;direct:number};invalidPlans:number;privacyViolations:number;hallucinations:number;unnecessaryProviderCalls:number;missingProviderCalls:number;unnecessaryToolCalls:number;staleAcceptances:number;entitlementBypasses:number};
