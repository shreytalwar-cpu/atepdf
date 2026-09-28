/** Drain a requested native cancellation before the caller can unlock and start another job. */
export async function withNativeCancellation<T>(signal:AbortSignal,cancel:()=>unknown|Promise<unknown>,work:()=>Promise<T>):Promise<T>{
  signal.throwIfAborted();
  let pendingCancellation:Promise<void>|undefined;
  const onAbort=()=>{pendingCancellation=(async()=>{try{await cancel();}catch{/* Cancellation errors must not expose native paths or replace the job outcome. */}})();};
  signal.addEventListener('abort',onAbort,{once:true});
  try{
    signal.throwIfAborted();
    const result=await work();signal.throwIfAborted();return result;
  }finally{
    signal.removeEventListener('abort',onAbort);
    await pendingCancellation;
  }
}
