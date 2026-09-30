import {spawn} from 'node:child_process';
// Only the child process group created by this run can be signalled.
export function runChild(command,args,options,{timeout=600_000,signal,grace=2_000}={}){
  return new Promise(resolve=>{
    const child=spawn(command,args,{...options,detached:process.platform!=='win32'});
    let reason=null,error=null,killTimer,closed;
    const kill=kind=>{try{if(process.platform==='win32')child.kill(kind);else process.kill(-child.pid,kind);}catch(e){if(e.code!=='ESRCH')error=e;}};
    const finish=()=>{clearTimeout(timer);clearTimeout(killTimer);signal?.removeEventListener('abort',abort);resolve({...closed,error:error??(reason?new Error(reason):null)});};
    const stop=why=>{if(reason)return;reason=why;kill('SIGTERM');killTimer=setTimeout(()=>{kill('SIGKILL');killTimer=undefined;if(closed)finish();},grace);};
    const abort=()=>stop('cancelled');signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)abort();
    const timer=setTimeout(()=>stop('timeout'),timeout);
    child.on('error',e=>{error=e;});
    child.on('close',(status,termination)=>{closed={status,signal:termination};clearTimeout(timer);if(!reason||!killTimer)finish();});
  });
}
