export {plannerStatus,requestPlan,savePlannerKey,createNativePairing,type PlannerStatus} from '@planner/client';
export const plannerAvailable=true;
export async function pairNativePlanner(_code:string):Promise<void>{throw new Error('Pair from the native app.');}
export async function disconnectNativePlanner():Promise<void>{}
