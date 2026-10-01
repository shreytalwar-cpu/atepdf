import test from 'node:test';
import assert from 'node:assert/strict';
import {JobController} from '../../packages/core/src/job-controller';
import {LocalFileStore} from '../../packages/core/src/local-file-store';
import {SECRET_CHAT_WARNING} from '../../packages/planner/src/privacy';
import {workspaceHook,deferred} from '../helpers/workspace-hook';
import {syntheticInspection} from '../helpers/synthetic-inspection';

// SHR-106: presentation state the redesigned UI reads from the workspace. It must describe
// what the workspace already decided, never decide anything itself.
const inspection=syntheticInspection(1);
const services={worker:async()=>({pages:1}),inspect:async()=>inspection,recognize:async()=>[]};
const file=(name='a.pdf')=>({name,size:1,arrayBuffer:async()=>new Uint8Array([1]).buffer,release:()=>{}}) as unknown as File;
const enabled={connected:true,enabled:true,remaining:2,token:'csrf-current',model:'synthetic'};
const clarify=(question:string,choices:string[])=>async(request:{requestId:string;workspaceRevision:number})=>({schemaVersion:'1.0',requestId:request.requestId,workspaceRevision:request.workspaceRevision,
  planner:{schemaVersion:'1.0',status:'clarify',reasonCode:'missing_parameter',steps:[],resultRefs:[],clarification:{question,choices}}});

test('Settings ▸ AI connection check sets the token in the current session and never writes to the conversation',async()=>{
  const controller=new JobController(new LocalFileStore(),services);
  const h=await workspaceHook(controller,{plannerStatus:async()=>enabled});
  try{
    assert.equal(await h.view.inspectConnection(),'ready');await h.flush();
    assert.equal(h.view.connectionToken.current,'csrf-current');
    assert.deepEqual({connected:h.view.connection.connected,enabled:h.view.connection.enabled,remaining:h.view.connection.remaining},{connected:true,enabled:true,remaining:2});
    assert.equal('token' in h.view.connection,false,'the token is never part of presentation state');
    assert.deepEqual(h.view.entries,[]);
  }finally{h.dispose();}
});

test('an unreachable planner is reported to Settings as unavailable, with no chat message',async()=>{
  const controller=new JobController(new LocalFileStore(),services);
  const h=await workspaceHook(controller,{plannerStatus:async()=>{throw new Error('offline');}});
  try{assert.equal(await h.view.inspectConnection(),'unavailable');await h.flush();assert.equal(h.view.connectionToken.current,null);assert.deepEqual(h.view.entries,[]);}finally{h.dispose();}
});

test('a clarification carries its choices for display, and answering closes it through the normal request path',async()=>{
  const controller=new JobController(new LocalFileStore(),services);const sent:{instruction:string;pendingClarification?:unknown}[]=[];
  const h=await workspaceHook(controller,{plannerStatus:async()=>enabled,requestPlan:async(request:any)=>{sent.push(request);return clarify('Which page should I remove?',['Page 1','Page 2'])(request);}});
  try{
    await h.view.importFiles([file()]);await h.flush();
    h.view.submit('Remove a page');for(let i=0;i<20&&h.view.busy;i++)await h.flush();
    const question=h.view.entries.at(-1);
    assert.equal(question.text,'Which page should I remove?');assert.deepEqual(question.choices,['Page 1','Page 2']);
    assert.equal(h.view.question,question.id);
    h.view.submit('Page 2');for(let i=0;i<20&&(h.view.busy||sent.length<2);i++)await h.flush();
    assert.equal(sent.length,2);assert.ok(sent[1].pendingClarification,'the answer continues the original task');
    assert.notEqual(h.view.question,question.id,'the answered question is closed');
  }finally{h.dispose();}
});

test('Start over clears an open question with the rest of the workspace',async()=>{
  const controller=new JobController(new LocalFileStore(),services);
  const h=await workspaceHook(controller,{plannerStatus:async()=>enabled,requestPlan:async(request:any)=>clarify('Which file?',['First','Second'])(request)});
  try{
    await h.view.importFiles([file()]);await h.flush();
    h.view.submit('Remove a page');for(let i=0;i<20&&h.view.busy;i++)await h.flush();
    assert.notEqual(h.view.question,null);
    h.view.startOver();for(let i=0;i<40&&(h.view.busy||h.view.entries.length);i++)await h.flush();
    assert.deepEqual(h.view.entries,[]);assert.equal(h.view.question,null);assert.equal(controller.store.list.length,0);
  }finally{h.dispose();}
});

test('outcomes are tagged for presentation without changing their text',async()=>{
  const controller=new JobController(new LocalFileStore(),services);
  const h=await workspaceHook(controller,{plannerStatus:async()=>({...enabled,connected:false,enabled:false})});
  try{
    h.view.submit('password=synthetic-presentation-secret');await h.flush();
    assert.deepEqual([h.view.entries.at(-1).text,h.view.entries.at(-1).notice],[SECRET_CHAT_WARNING,'refused']);
    h.view.submit('Explain these PDFs');for(let i=0;i<20&&h.view.busy;i++)await h.flush();
    const unavailable=h.view.entries.at(-1);
    assert.equal(unavailable.notice,'unavailable');assert.match(unavailable.text,/OpenAI is not connected yet/);
    assert.equal(h.view.entries.some((entry:{text:string})=>entry.text.includes('synthetic-presentation-secret')),false);
  }finally{h.dispose();}
});

test('Keep Current Result answers only the open quality choice, and the result stays current',async()=>{
  const controller=new JobController(new LocalFileStore(),services);
  const h=await workspaceHook(controller,{plannerStatus:async()=>({...enabled,enabled:false})});
  try{
    await h.view.importFiles([file()]);await h.flush();
    h.view.submit('compress');for(let i=0;i<20&&h.view.busy;i++)await h.flush();
    const proposal=h.view.entries.at(-1);assert.equal(proposal.choice,'compress');assert.equal(h.view.choice,proposal.id);
    const before=h.view.entries.length;
    h.view.keepCurrent({...proposal,id:proposal.id+100});await h.flush();
    assert.equal(h.view.entries.length,before,'a stale proposal cannot be answered');
    h.view.keepCurrent(proposal);await h.flush();
    assert.equal(h.view.choice,null);assert.deepEqual(h.view.entries.slice(-2).map((entry:{role:string})=>entry.role),['user','assistant']);
    assert.equal(controller.store.focus,null,'no copy was made');
  }finally{h.dispose();}
});

test('Stop during a local job is reported as stopping until the controller settles',async()=>{
  const gate=deferred<void>();
  const slow={...services,worker:async(_request:unknown,signal:AbortSignal)=>{await new Promise<void>((resolve,reject)=>{gate.promise.then(()=>resolve());signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});});return {pages:1};}};
  const controller=new JobController(new LocalFileStore(),slow);
  const h=await workspaceHook(controller);
  try{
    const importing=h.view.importFiles([file()]);await h.flush();
    assert.equal(controller.state.busy,true);assert.equal(h.view.stopping,false);
    h.view.cancel();
    assert.equal(h.view.stopping,controller.state.busy,'stopping is only claimed while the job is still running');
    gate.resolve();await importing;for(let i=0;i<20&&controller.state.busy;i++)await h.flush();
    assert.equal(h.view.stopping,false);
  }finally{h.dispose();}
});
