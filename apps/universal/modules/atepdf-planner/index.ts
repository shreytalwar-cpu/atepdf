import {requireOptionalNativeModule} from 'expo';
export type NativePlannerModule={
  available:boolean;
  statusAsync(id:string):Promise<string>;
  pairAsync(id:string,code:string):Promise<void>;
  planAsync(id:string,body:string):Promise<string>;
  disconnectAsync(id:string):Promise<void>;
  cancelAsync(id:string):Promise<void>;
};
export default requireOptionalNativeModule<NativePlannerModule>('AtepdfPlanner');
