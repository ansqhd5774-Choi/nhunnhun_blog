import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceIdForEvent} from '../authoring/direct-dispatch.mjs';

const push=(commits,ref='refs/heads/main')=>({ref,deleted:false,commits});

test('manual dispatch keeps exact direct source ID',()=>{
  assert.equal(sourceIdForEvent({eventName:'workflow_dispatch',sourceId:'direct-252-perilla-leaf-20261009'}),'direct-252-perilla-leaf-20261009');
  assert.throws(()=>sourceIdForEvent({eventName:'workflow_dispatch',sourceId:'auto-252'}),/E_DIRECT_SOURCE_ID/);
});

test('push resolves one direct update, ignoring ledger and unrelated files',()=>{
  const eventPayload=push([{added:['updates/direct-252-perilla-leaf-20261009.json'],modified:['publishing/update-state/example.json','docs/README.md']}]);
  assert.equal(sourceIdForEvent({eventName:'push',eventPayload}),'direct-252-perilla-leaf-20261009');
});

test('push rejects multiple mutations and no eligible direct source',()=>{
  assert.throws(()=>sourceIdForEvent({eventName:'push',eventPayload:push([{added:['updates/direct-one.json','updates/direct-two.json']}])}),/E_DIRECT_PUSH_SOURCE_COUNT/);
  assert.throws(()=>sourceIdForEvent({eventName:'push',eventPayload:push([{modified:['updates/normal.json']}])}),/E_DIRECT_PUSH_SOURCE_COUNT/);
});

test('push requires main and disallows deleted event',()=>{
  assert.throws(()=>sourceIdForEvent({eventName:'push',eventPayload:push([{added:['updates/direct-test.json']}],'refs/heads/feature')}),/E_DIRECT_PUSH_REF/);
  assert.throws(()=>sourceIdForEvent({eventName:'push',eventPayload:{...push([{added:['updates/direct-test.json']}]),deleted:true}}),/E_DIRECT_PUSH_REF/);
});

test('multiple commits modifying same direct update resolve once',()=>{
  const eventPayload=push([{added:['updates/direct-252-perilla-leaf-20261009.json']},{modified:['updates/direct-252-perilla-leaf-20261009.json']}]);
  assert.equal(sourceIdForEvent({eventName:'push',eventPayload}),'direct-252-perilla-leaf-20261009');
});
