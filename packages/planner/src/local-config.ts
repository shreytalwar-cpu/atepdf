import {constants} from 'node:fs';
import {lstat,open,mkdir,rmdir} from 'node:fs/promises';
import {join} from 'node:path';
import {MODEL} from './provider';
export type Settings={enabled:boolean;model:string;approvedRequests:number};
// Single-user development gateway only. Key never crosses into the web/native bundle.
export class LocalConfig {
  constructor(readonly directory:string){}
  async secureRead(name:string){
    const parent=await lstat(this.directory);
    if(!parent.isDirectory()||parent.isSymbolicLink()||(parent.mode&0o077)!==0||parent.uid!==process.getuid?.())throw new Error('Unsafe local configuration.');
    const handle=await open(join(this.directory,name),constants.O_RDONLY|constants.O_NOFOLLOW);
    try{const info=await handle.stat();if(!info.isFile()||(info.mode&0o077)!==0||info.uid!==process.getuid?.()||info.size>8192)throw new Error('Unsafe local configuration.');return await handle.readFile('utf8');}finally{await handle.close();}
  }
  async saveKey(key:string){
    if(!/^sk-[A-Za-z0-9_-]{17,500}$/.test(key))throw new Error('Invalid key format.');
    await mkdir(this.directory,{mode:0o700,recursive:true});
    const parent=await lstat(this.directory);if(!parent.isDirectory()||parent.isSymbolicLink()||(parent.mode&0o077)!==0||parent.uid!==process.getuid?.())throw new Error('Unsafe local configuration.');
    // Never overwrite an existing credential or test allowance.
    const settings=await open(join(this.directory,'planner-settings.json'),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600).catch((error:NodeJS.ErrnoException)=>{if(error.code==='EEXIST')return null;throw error;});
    if(settings)try{await settings.writeFile(JSON.stringify({enabled:false,model:MODEL,approvedRequests:0}));await settings.sync();}finally{await settings.close();}
    const handle=await open(join(this.directory,'openai-key'),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
    try{await handle.writeFile(key);await handle.sync();}finally{await handle.close();}
  }
  async status(){
    try {const key=await this.secureRead('openai-key');const settings=JSON.parse(await this.secureRead('planner-settings.json')) as Settings;
      const connected=/^sk-[A-Za-z0-9_-]{17,500}$/.test(key),remaining=Number.isSafeInteger(settings.approvedRequests)&&settings.approvedRequests>=0&&settings.approvedRequests<=20?settings.approvedRequests:0;
      return {connected,enabled:connected&&settings.enabled===true&&settings.model===MODEL&&remaining>0,remaining};
    }catch{return {connected:false,enabled:false,remaining:0};}
  }
  async reserve(){
    // mkdir is an atomic lock shared by both local hosts. Stale lock fails closed.
    const lock=join(this.directory,'planner.lock');await mkdir(lock,{mode:0o700});
    try{
      const status=await this.status();if(!status.enabled)throw new Error('No approved requests remain.');
      const key=await this.secureRead('openai-key');
      const handle=await open(join(this.directory,'planner-settings.json'),constants.O_WRONLY|constants.O_NOFOLLOW);
      try{const info=await handle.stat();if(!info.isFile()||(info.mode&0o077)!==0||info.uid!==process.getuid?.())throw new Error('Unsafe settings.');await handle.truncate(0);await handle.writeFile(JSON.stringify({enabled:status.remaining>1,model:MODEL,approvedRequests:status.remaining-1}));await handle.sync();}finally{await handle.close();}
      return {key,release:async()=>{await rmdir(lock);}};
    }catch(e){await rmdir(lock);throw e;}
  }
}
