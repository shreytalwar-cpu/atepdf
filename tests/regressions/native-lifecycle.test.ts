import test from 'node:test';
import assert from 'node:assert/strict';
import {withNativeCancellation} from '../../apps/universal/src/platform/native-cancellation';

function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}

test('native cancellation contract: delayed global cancel drains before the job can unlock',async()=>{
  const abort=new AbortController(),work=deferred<string>(),cancellation=deferred<void>(),events:string[]=[];
  let settled=false;
  const pending=withNativeCancellation(abort.signal,async()=>{events.push('cancel requested');await cancellation.promise;events.push('cancel completed');},()=>work.promise);
  const rejected=assert.rejects(pending,error=>error instanceof Error&&error.name==='AbortError');
  void pending.then(()=>{settled=true;},()=>{settled=true;events.push('job unlocked');});
  abort.abort();work.resolve('discard this cancelled result');await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(settled,false);assert.deepEqual(events,['cancel requested']);
  cancellation.resolve();await rejected;assert.equal(settled,true);assert.deepEqual(events,['cancel requested','cancel completed','job unlocked']);
});

test('native cancellation contract: cancellation errors stay private and never replace the work error',async()=>{
  const abort=new AbortController(),work=deferred<void>();
  const pending=withNativeCancellation(abort.signal,()=>{throw new Error('/private/NATIVE_SECRET_CANARY');},async()=>{await work.promise;throw new Error('Independent validation failed.');});
  const rejected=assert.rejects(pending,error=>error instanceof Error&&error.message==='Independent validation failed.');
  abort.abort();work.resolve();await rejected;
});

test('native cancellation contract: an already cancelled request never starts work; success removes its abort listener',async()=>{
  const stopped=new AbortController();stopped.abort();let calls=0;
  await assert.rejects(withNativeCancellation(stopped.signal,()=>{calls++;},async()=>{calls++;return 'unused';}));assert.equal(calls,0);
  const completed=new AbortController();assert.equal(await withNativeCancellation(completed.signal,()=>{calls++;},async()=> 'complete'),'complete');completed.abort();await Promise.resolve();assert.equal(calls,0);
});
