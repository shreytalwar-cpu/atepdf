import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';

const digest=(value:string)=>createHash('sha256').update(value).digest();
/** Development-only, process-scoped pairing. No provider key leaves LocalConfig. */
export class NativePairing {
  private pending:{hash:Buffer;expires:number;origin:string}|null=null;
  private sessions=new Map<string,{expires:number;origin:string}>();
  constructor(private now=Date.now){}
  issue(origin:string){
    const code=randomBytes(32).toString('hex'),expires=this.now()+5*60_000;
    this.pending={hash:digest(code),expires,origin};
    return {code:`atepdf-local:${new URL(origin).port}:${code}`,expiresAt:expires};
  }
  exchange(code:string,origin:string){
    const match=/^atepdf-local:(3210|3211|3212):([a-f0-9]{64})$/.exec(code);
    const pending=this.pending;
    if(!match||!pending||pending.expires<=this.now()||pending.origin!==origin||match[1]!==new URL(origin).port||!timingSafeEqual(pending.hash,digest(match[2])))throw new Error('Pairing unavailable.');
    this.pending=null;
    for(const [key,value]of this.sessions)if(value.expires<=this.now())this.sessions.delete(key);
    if(this.sessions.size>=4)throw new Error('Too many local connections.');
    const token=randomBytes(32).toString('hex'),expiresAt=this.now()+8*60*60_000;
    this.sessions.set(digest(token).toString('hex'),{expires:expiresAt,origin});
    return {token,expiresAt};
  }
  accepts(header:string|null,origin:string){
    if(!header||!/^Bearer [a-f0-9]{64}$/.test(header))return false;
    const key=digest(header.slice(7)).toString('hex'),session=this.sessions.get(key);
    if(!session||session.expires<=this.now()){this.sessions.delete(key);return false;}
    return session.origin===origin;
  }
  revoke(header:string|null){if(header?.startsWith('Bearer '))this.sessions.delete(digest(header.slice(7)).toString('hex'));}
}
