import test from 'node:test';
import assert from 'node:assert/strict';
import {stat} from 'node:fs/promises';
import {COMMERCE_ENABLED,commercialActionsAvailable,initialEntitlement,recordPurchaseActivity,reduceVerifiedObservation,evaluateVerifiedAccess,type VerifiedObservation,type PurchaseActivity} from '../../packages/commerce/src/entitlement';
import {capturePendingJob,reviewPendingJob,confirmPendingJob} from '../../packages/commerce/src/pending-job';
import {commercialPolicySources} from '../../packages/commerce/src/policy-sources';
import {buildRequest,quickPlan} from '../../packages/contracts/src/protocol';

const subjectRef=`subject_${'a'.repeat(32)}`,initial=()=>initialEntitlement(subjectRef);
const event=(revision=1,grant:VerifiedObservation['grant']={status:'active',accessUntil:2000,renews:true}):VerifiedObservation=>({subjectRef,eventRef:`event_${revision.toString(16).padStart(32,'0')}`,verificationRevision:revision,verifiedAt:1000+revision,grant});
const request=()=>buildRequest({revision:3,files:[{ref:'file_a',kind:'pdf',pageCount:2,sizeBytes:2000,encrypted:false},{ref:'file_b',kind:'pdf',pageCount:1,sizeBytes:1000,encrypted:false}],selected:['file_a','file_b'],focus:null,originals:['file_a','file_b']},'Merge in the selected order.');

test('M6-01 commerce stays disabled and commercial hypotheses remain unchanged source references',async()=>{
  assert.equal(COMMERCE_ENABLED,false);assert.equal(commercialActionsAvailable(),false);assert.equal(commercialPolicySources.runtimeEnabled,false);
  assert.equal(commercialPolicySources.defaults.livePurchases,false);assert.equal(commercialPolicySources.defaults.customerMigration,false);
  for(const path of commercialPolicySources.handoffSources)assert.ok(await stat(path));
});

test('synthetic entitlement contracts: pending, cancellation, restore and failure never grant access',()=>{
  for(const activity of ['checkout_pending','verification_pending','restore_pending','cancelled','failed'] as PurchaseActivity[]){
    const pending=recordPurchaseActivity(initial(),activity);assert.deepEqual(evaluateVerifiedAccess(pending,1500),{allowed:false,reason:'unknown'});
  }
  const active=reduceVerifiedObservation(initial(),event());const cancelled=recordPurchaseActivity(active,'cancelled');
  assert.deepEqual(evaluateVerifiedAccess(cancelled,1500),{allowed:true,reason:'active'});assert.equal(evaluateVerifiedAccess(cancelled,2000).allowed,false);
  assert.equal(commercialActionsAvailable(),false); // Domain eligibility cannot activate the product.
});

test('synthetic entitlement contracts: active, cancelled renewal, grace, expiry and explicit revocation',()=>{
  let state=reduceVerifiedObservation(initial(),event(1,{status:'active',accessUntil:2000,renews:false}));
  assert.deepEqual(evaluateVerifiedAccess(state,1999),{allowed:true,reason:'active'});assert.deepEqual(evaluateVerifiedAccess(state,2000),{allowed:false,reason:'expired'});
  state=reduceVerifiedObservation(state,event(2,{status:'grace',accessUntil:2500,renews:true}));assert.deepEqual(evaluateVerifiedAccess(state,2200),{allowed:true,reason:'grace'});assert.equal(evaluateVerifiedAccess(state,2500).allowed,false);
  state=reduceVerifiedObservation(state,event(3,{status:'expired',accessUntil:null,renews:false}));assert.deepEqual(evaluateVerifiedAccess(state,1500),{allowed:false,reason:'expired'});
  state=reduceVerifiedObservation(state,event(4,{status:'active',accessUntil:3000,renews:true}));assert.equal(evaluateVerifiedAccess(state,2000).allowed,true);
  state=reduceVerifiedObservation(state,event(5,{status:'revoked',accessUntil:null,renews:false}));assert.deepEqual(evaluateVerifiedAccess(state,2000),{allowed:false,reason:'revoked'});
  assert.deepEqual(evaluateVerifiedAccess(state,999),{allowed:false,reason:'verification_required'});assert.throws(()=>evaluateVerifiedAccess(state,NaN));
});

test('synthetic entitlement contracts: duplicates are idempotent, older revisions cannot revive revoked access',()=>{
  const active=event(),revoked=event(3,{status:'revoked',accessUntil:null,renews:false});let state=reduceVerifiedObservation(initial(),active);
  assert.equal(reduceVerifiedObservation(state,structuredClone(active)),state);state=reduceVerifiedObservation(state,revoked);
  assert.equal(reduceVerifiedObservation(state,event(2)),state);assert.equal(evaluateVerifiedAccess(state,1500).allowed,false);
  assert.throws(()=>reduceVerifiedObservation(state,{...revoked,grant:{status:'active',accessUntil:4000,renews:true}}),/Conflicting/);
  assert.throws(()=>reduceVerifiedObservation(state,{...event(4),eventRef:revoked.eventRef}),/ordering/);
  assert.throws(()=>reduceVerifiedObservation(state,{...event(4),verifiedAt:1000}),/ordering/);
});

test('synthetic entitlement contracts: account collisions, unrecognized evidence and mutable source data fail safely',()=>{
  assert.throws(()=>reduceVerifiedObservation(initial(),{...event(),subjectRef:`subject_${'b'.repeat(32)}`}),/does not match/);
  assert.throws(()=>reduceVerifiedObservation(initial(),{...event(),receipt:'PRIVATE_RECEIPT_CANARY'} as VerifiedObservation),error=>error instanceof Error&&!error.message.includes('CANARY'));
  assert.throws(()=>reduceVerifiedObservation(initial(),{...event(),verificationRevision:1.5}));
  assert.throws(()=>reduceVerifiedObservation(initial(),event(1,{status:'active',accessUntil:1000,renews:true})));
  assert.throws(()=>reduceVerifiedObservation(initial(),{...event(),grant:{status:'paid',accessUntil:3000,renews:true}} as unknown as VerifiedObservation));
  const source=event(),pending=recordPurchaseActivity(initial(),'restore_pending'),state=reduceVerifiedObservation(pending,source);source.grant={status:'revoked',accessUntil:null,renews:false};
  assert.equal(evaluateVerifiedAccess(state,1500).allowed,true);assert.equal(state.activity,'restore_pending');assert.equal(Object.isFrozen(state.observation?.grant),true);
});

test('pending job contract: draft/recipe survive locally and matching context still requires explicit confirmation',()=>{
  const before=request(),recipe=quickPlan(before,'merge'),snapshot=capturePendingJob(before,recipe,'LOCAL_DRAFT_CANARY');
  recipe.planner.steps[0].inputs.reverse();before.selectionRefs.reverse();assert.deepEqual(snapshot.recipe.planner.steps[0].inputs,['file_a','file_b']);assert.equal(snapshot.draft,'LOCAL_DRAFT_CANARY');
  const current=request(),review=reviewPendingJob(snapshot,current);assert.equal(review.status,'confirmation_required');
  assert.throws(()=>confirmPendingJob(review,current,'unconfirmed'),/Review/);if(review.status!=='confirmation_required')throw new Error('Expected review');
  const confirmed=confirmPendingJob(review,current,review.reviewId);assert.equal(confirmed.requestId,current.requestId);assert.notEqual(confirmed.requestId,snapshot.request.requestId);assert.deepEqual(confirmed.planner,snapshot.recipe.planner);
  confirmed.planner.steps[0].inputs.reverse();assert.deepEqual(snapshot.recipe.planner.steps[0].inputs,['file_a','file_b']);assert.equal(commercialActionsAvailable(),false);
});

test('pending job contract: changed revision, file order, facts, focus, capabilities or instruction require replanning',()=>{
  const before=request(),snapshot=capturePendingJob(before,quickPlan(before,'merge'),'Local draft');
  for(const change of [
    (r:ReturnType<typeof request>)=>{r.workspaceRevision++;},(r:ReturnType<typeof request>)=>{r.files.reverse();},
    (r:ReturnType<typeof request>)=>{r.selectionRefs.reverse();},(r:ReturnType<typeof request>)=>{r.files[0].sizeBytes++;},
    (r:ReturnType<typeof request>)=>{r.focusedResultRef='file_a';},(r:ReturnType<typeof request>)=>{r.capabilities=['merge_pdf'];},
    (r:ReturnType<typeof request>)=>{r.instruction='Merge in reverse order.';},
  ]){const current=request();change(current);const review=reviewPendingJob(snapshot,current);assert.deepEqual(review,{status:'replan_required',reason:'workspace_changed'});assert.throws(()=>confirmPendingJob(review,current,'anything'));}
  const current=request(),review=reviewPendingJob(snapshot,current);if(review.status!=='confirmation_required')throw new Error('Expected review');
  current.workspaceRevision++;assert.throws(()=>confirmPendingJob(review,current,review.reviewId),/changed/);
  const invalid=request();invalid.files.pop();assert.throws(()=>reviewPendingJob(snapshot,invalid));
});

test('pending job contract: invalid or partially executed recipes cannot be retained as executable work',()=>{
  const req=request(),recipe=quickPlan(req,'merge');assert.throws(()=>capturePendingJob(req,{...recipe,workspaceRevision:99},'draft'));
  assert.throws(()=>capturePendingJob(req,{...recipe,planner:{...recipe.planner,steps:[]}},'draft'));
  assert.throws(()=>capturePendingJob(req,recipe,'x'.repeat(4001)));
  const snapshot=capturePendingJob(req,recipe,'draft');snapshot.request.files[0].ref='file_missing';assert.throws(()=>reviewPendingJob(snapshot,request()));
});
