import {spawn} from 'node:child_process';
// Only the child process group created by this run can be signalled.
export function runChild(command,args,options,{timeout=600_000,signal,grace=2_000}={}){
  return new Promise(resolve=>{
    const child=spawn(command,args,{...options,detached:process.platform!=='win32'});
    let reason=null,error=null,killTimer;
    const kill=kind=>{try{if(process.platform==='win32')child.kill(kind);else process.kill(-child.pid,kind);}catch(e){if(e.code!=='ESRCH')error=e;}};
    const stop=why=>{if(reason)return;reason=why;kill('SIGTERM');killTimer=setTimeout(()=>kill('SIGKILL'),grace);};
    const abort=()=>stop('cancelled');signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)abort();
    const timer=setTimeout(()=>stop('timeout'),timeout);
    child.on('error',e=>{error=e;});
    child.on('close',(status,termination)=>{clearTimeout(timer);clearTimeout(killTimer);signal?.removeEventListener('abort',abort);resolve({status,signal:termination,error:error??(reason?new Error(reason):null)});});
  });
}
