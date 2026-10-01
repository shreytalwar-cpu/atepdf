import type * as Client from '@planner/client';
export type {PlannerStatus} from '@planner/client';
// Load transport validation and bounded receiving before making a request.
// Local files and engines do not need the hosted planner's transport at startup.
export async function plannerStatus(...args:Parameters<typeof Client.plannerStatus>){const client=await import('@planner/client');return client.plannerStatus(...args);}
export async function requestPlan(...args:Parameters<typeof Client.requestPlan>){const client=await import('@planner/client');return client.requestPlan(...args);}
export async function savePlannerKey(...args:Parameters<typeof Client.savePlannerKey>){const client=await import('@planner/client');return client.savePlannerKey(...args);}
export async function createNativePairing(...args:Parameters<typeof Client.createNativePairing>){const client=await import('@planner/client');return client.createNativePairing(...args);}
export const plannerAvailable=true;
export async function pairNativePlanner(_code:string):Promise<void>{throw new Error('Pair from the native app.');}
export async function disconnectNativePlanner():Promise<void>{}
