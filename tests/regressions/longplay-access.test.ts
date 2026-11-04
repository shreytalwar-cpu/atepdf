import test from 'node:test';
import assert from 'node:assert/strict';
import {probeLongplayAccess, type LongplayCustomerAccessClient} from '../../packages/commerce/src/longplay-access';
import {COMMERCE_ENABLED, commercialActionsAvailable, initialEntitlement, reduceVerifiedObservation, type VerifiedObservation} from '../../packages/commerce/src/entitlement';

const feature = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const client = (allowed = true): LongplayCustomerAccessClient => ({checkEntitlement: async input => {
  assert.deepEqual(input, {requirement: {internal_feature_id: feature, quantity: '1', properties: {}}});
  return {requestId, check: {internal_feature_id: feature, kind: 'access', allowed}};
}});

test('probe sends only the configured Feature and returns fresh access without enabling commerce', async () => {
  const result = await probeLongplayAccess(client(), feature);
  assert.deepEqual(result, {source: 'longplay-online-access', allowed: true, requestRef: requestId});
  assert.equal(COMMERCE_ENABLED, false);
  assert.equal(commercialActionsAvailable(), false);
  assert.equal(Object.isFrozen(result), true);
});

test('a previous positive observation cannot grant the next call after revocation', async () => {
  assert.equal((await probeLongplayAccess(client(true), feature)).allowed, true);
  assert.equal((await probeLongplayAccess(client(false), feature)).allowed, false);
});

test('a bare allowed check cannot become a verified offline entitlement lease', async () => {
  const result = await probeLongplayAccess(client(), feature);
  const state = initialEntitlement(`subject_${'a'.repeat(32)}`);
  assert.throws(() => reduceVerifiedObservation(state, result as unknown as VerifiedObservation));
  assert.equal(state.observation, null);
});

test('wrong Feature, credit kind and malformed allowed values fail closed', async () => {
  for (const check of [
    {internal_feature_id: 'other', kind: 'access', allowed: true},
    {internal_feature_id: feature, kind: 'credit', allowed: true},
    {internal_feature_id: feature, kind: 'access', allowed: 'true'},
  ]) {
    const invalid = {checkEntitlement: async () => ({requestId, check})} as LongplayCustomerAccessClient;
    await assert.rejects(probeLongplayAccess(invalid, feature), /Could not verify/);
  }
});

test('misconfiguration makes no call; service errors do not expose provider details', async () => {
  let calls = 0;
  const unavailable: LongplayCustomerAccessClient = {checkEntitlement: async () => {
    calls++; throw new Error('PRIVATE_PROVIDER_CANARY');
  }};
  await assert.rejects(probeLongplayAccess(unavailable, 'unset'), /configured access Feature/);
  assert.equal(calls, 0);
  await assert.rejects(probeLongplayAccess(unavailable, feature), error => error instanceof Error &&
    error.message === 'Could not verify online access.' && !error.message.includes('CANARY'));
});
