import test from 'node:test';
import assert from 'node:assert/strict';
import {JobController,type JobState} from '../../packages/core/src/job-controller';
import {LocalFileStore} from '../../packages/core/src/local-file-store';
import {IDLE,REPLY_GRACE,describeActivity,outcomeOf,stepLabel,stepPresence,type ActivityInput,type Presence,type PresenceInput} from '../../apps/universal/src/ui/progress';
import {syntheticInspection as inspection} from '../helpers/synthetic-inspection';

// SHR-106 polish: the activity row's words and bar come only from real state, and very fast work
// resolves straight into its result: replies are never held for animation or a minimum duration.
type Step=NonNullable<JobState['progress']>['steps'][number];
const busy=(steps:Step[],currentStep:number|null,message='',stage:JobState['stage']='executing'):ActivityInput=>({state:{busy:true,stage,message,progress:{kind:'transform',currentStep,steps}},planning:false,loading:false,stopping:false,slow:false});
const step=(operation:Step['operation'],status:Step['status'],units?:number):Step=>({label:'x',operation,status,...(units===undefined?{}:{units})});

test('labels describe the operation in the user’s terms, with known counts only',()=>{
  assert.equal(describeActivity(busy([step('merge_pdf','active',3)],0))!.label,'Combining 3 PDFs…');
  assert.equal(describeActivity(busy([step('select_pages','active',1)],0))!.label,'Removing 1 page…');
  assert.equal(describeActivity(busy([{...step('select_pages','active',2),pages:[4,8]}],0))!.label,'Removing pages 4 and 8…');
  assert.equal(stepLabel('select_pages',1,[2]),'Removing page 2…');
  assert.equal(stepLabel('select_pages',3,[2,5,9]),'Removing pages 2, 5 and 9…');
  assert.equal(stepLabel('select_pages',6,[1,2,3,4,5,6]),'Removing 6 pages…');
  assert.equal(describeActivity(busy([step('ocr_pdf','active',12)],0))!.label,'Making 12 scanned pages searchable…');
  assert.equal(describeActivity(busy([step('ocr_pdf','active',0)],0))!.label,'Checking for scanned pages…');
  assert.equal(describeActivity(busy([step('ocr_pdf','active')],0))!.label,'Making scanned pages searchable…');
  assert.equal(describeActivity(busy([step('compress_pdf','active')],0))!.label,'Compressing images…');
  const verifying=describeActivity(busy([step('merge_pdf','validating',2)],0,'Checking the PDF with an independent reader…','validating'))!;
  assert.equal(verifying.label,'Checking the result…');assert.equal(verifying.mode,'verifying');assert.equal(verifying.value,undefined);
});

test('a bar is determinate only from a real count; otherwise it is indeterminate',()=>{
  const counted=describeActivity(busy([step('merge_pdf','active',3)],0,'Merged 1 of 3 files'))!;
  assert.equal(counted.mode,'determinate');assert.equal(counted.value,1/3);assert.equal(counted.count,'1 of 3');
  const ocr=describeActivity(busy([step('ocr_pdf','active',12)],0,'Recognising English · 42%'))!;
  assert.equal(ocr.mode,'indeterminate');assert.equal(ocr.value,undefined);assert.equal(ocr.detail,'Recognising text · 42%');
  assert.equal(describeActivity(busy([step('ocr_pdf','active',2)],0,'Recognised page 3 of 18'))!.detail,'Page 3 of 18 recognised');
  assert.equal(describeActivity(busy([step('compress_pdf','active')],0,'Image and object optimisation complete'))!.mode,'indeterminate');
  // Multi-step: completed steps (plus the engine's own count within the current one).
  const chain=describeActivity(busy([step('merge_pdf','complete',2),step('ocr_pdf','active',4),step('compress_pdf','pending')],1))!;
  assert.equal(chain.mode,'determinate');assert.equal(chain.value,1/3);assert.equal(chain.count,'Step 2 of 3');
  const merging=describeActivity(busy([step('merge_pdf','active',2),step('ocr_pdf','pending'),step('compress_pdf','pending')],0,'Merged 1 of 2 files'))!;
  assert.equal(merging.value,(0+1/2)/3);
  const imported=describeActivity({state:{busy:true,stage:'importing',message:'',progress:{kind:'import',currentStep:1,steps:[{label:'a',status:'complete'},{label:'b',status:'active'}]}},planning:false,loading:false,stopping:false,slow:false})!;
  assert.equal(imported.label,'Adding 2 PDFs…');assert.equal(imported.value,0.5);assert.equal(imported.count,'1 of 2 checked');
  const single=describeActivity({state:{busy:true,stage:'importing',message:'',progress:{kind:'import',currentStep:0,steps:[{label:'a',status:'active'}]}},planning:false,loading:false,stopping:false,slow:false})!;
  assert.equal(single.mode,'indeterminate');assert.equal(single.value,undefined);
});

test('no visible activity names the planner, a plan or an execution stage',()=>{
  const idle={busy:false,stage:'idle' as const,message:'',progress:undefined};
  const states:ActivityInput[]=[
    {state:idle,planning:true,loading:false,stopping:false,slow:false},
    {state:idle,planning:true,loading:false,stopping:false,slow:true},
    {state:idle,planning:false,loading:true,stopping:false,slow:false},
    {...busy([step('merge_pdf','active',2)],0),stopping:true},
    busy([step('merge_pdf','active',2)],0,'Starting local processing…'),
    busy([step('compress_pdf','complete')],null,'Ready. Your originals are unchanged.','complete'),
  ];
  for(const input of states){
    const activity=describeActivity(input)!;
    assert.ok(activity,'every working state is described');
    assert.doesNotMatch(`${activity.label} ${activity.detail??''} ${activity.count??''}`,/plan|orchestrat|execut|stage/i);
  }
  const planning=describeActivity(states[0])!;
  assert.equal(planning.label,'Working…');assert.equal(planning.where,'ai');
  assert.equal(planning.detail,'Sending your instruction to atePDF AI.','the outbound request is still disclosed while it is sent');
  assert.equal(describeActivity(states[1])!.label,'Still working…');
  assert.equal(describeActivity(states[3])!.mode,'cancelling');assert.equal(describeActivity(states[3])!.label,'Cancelling…');
  assert.equal(describeActivity({state:idle,planning:false,loading:false,stopping:false,slow:false}),null);
});

const run=(start:Presence,steps:Partial<PresenceInput>[])=>steps.reduce((presence,input)=>stepPresence(presence,{working:false,count:2,now:0,newest:null,userAfter:false,...input}),start);

test('a task that finishes immediately shows its reply at once: nothing is held',()=>{
  const active=run(IDLE,[{working:true,count:2,now:1000}]);
  assert.equal(active.phase,'active');
  // Work and reply land in the same commit: the result is shown immediately.
  assert.equal(run(active,[{now:1030,count:3,newest:'complete'}]).phase,'idle');
});

test('a reply landing a tick after the work only bridges that tick, and is shown as soon as it lands',()=>{
  const ended=run(IDLE,[{working:true,now:0},{now:40}]);
  assert.equal(ended.phase,'settling');assert.equal(ended.cut,2);assert.equal(ended.until,40+REPLY_GRACE);
  assert.equal(run(ended,[{now:45,count:3,newest:'complete'}]).phase,'idle','no completion animation to wait for');
  assert.equal(run(ended,[{now:40+REPLY_GRACE}]).phase,'idle','a reply that never comes is not waited for');
});

test('late progress after completion, cancellation, reset and new requests never hold anything',()=>{
  assert.equal(run(IDLE,[{working:true,now:0},{now:30,newest:'cancelled'}]).phase,'idle');
  const settling=run(IDLE,[{working:true,now:0},{now:30}]);
  assert.equal(run(settling,[{now:40,newest:'cancelled'}]).phase,'idle');
  assert.equal(run(settling,[{now:40,userAfter:true}]).phase,'idle','a new request is never delayed');
  assert.equal(run(settling,[{now:40,count:0}]).phase,'idle','Start Over or expiry resets the conversation');
});

test('work that resumes while waiting for a reply is one activity; repeated fast work never queues',()=>{
  const settling=run(IDLE,[{working:true,now:0},{now:30}]);
  const resumed=run(settling,[{working:true,count:2,now:60}]);
  assert.equal(resumed.phase,'active');assert.equal(resumed.shownAt,0);
  let presence=IDLE;
  for(let i=0;i<5;i++){presence=run(presence,[{working:true,count:2+i,now:i*100},{now:i*100+10,count:3+i,newest:'complete'}]);assert.equal(presence.phase,'idle');}
});

test('outcomes come from how the reply ends',()=>{
  assert.equal(outcomeOf(undefined),null);
  assert.equal(outcomeOf({artifact:{}}),'complete');
  assert.equal(outcomeOf({notice:'cancelled'}),'cancelled');
  assert.equal(outcomeOf({notice:'error'}),'failed');
  assert.equal(outcomeOf({notice:'refused'}),'failed');
  assert.equal(outcomeOf({}),'other');
});

test('job progress carries display units from the accepted recipe and stored inspections',async()=>{
  const store=new LocalFileStore();
  for(const ref of ['file_a','file_b']){const file=await store.prepare(new Uint8Array([1]),'PRIVATE.pdf',inspection(ref==='file_a'?2:1),true,ref);store.commit([file],store.revision);}
  const seen:JobState[]=[];
  const controller=new JobController(store,{worker:async request=>request.kind==='transform'?{bytes:new Uint8Array([request.inputs.reduce((n,input)=>n+input.inspection.pages.length,0)]),note:''}:{pages:1},inspect:async bytes=>inspection(bytes[0]),recognize:async()=>[]});
  controller.subscribe(()=>seen.push(controller.snapshot()));
  const units=()=>seen.find(state=>state.progress?.kind==='transform'&&state.progress.currentStep===0)?.progress?.steps.map(item=>item.units);
  await controller.quick('merge');assert.deepEqual(units(),[2]);
  seen.length=0;await controller.quick('remove',2);assert.deepEqual(units(),[1]);
  const scanned=store.get(store.focus!).meta.inspection.pages.filter(page=>!page.text.trim()).length;
  seen.length=0;await controller.quick('ocr');assert.deepEqual(units(),[scanned],'scanned pages of the current result');
  seen.length=0;await controller.quick('compress');assert.deepEqual(units(),[undefined]);
});
