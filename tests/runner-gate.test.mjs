import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSourceIdentity,classifyRunners,RUNNER_LABELS} from '../publishing/runner-gate.mjs';
test('queued stale workflow cannot mutate even when checkout uses new main',()=>{
  const a='a'.repeat(40), b='b'.repeat(40);
  assert.doesNotThrow(()=>assertSourceIdentity(a,a,a));
  for(const args of [[a,b,b],[a,a,b],['',a,a]]) assert.throws(()=>assertSourceIdentity(...args),/BLOCKED_SOURCE_DRIFT/);
});
test('runner diagnostics distinguish matching idle busy offline and unavailable',()=>{
  const r={labels:RUNNER_LABELS.map(name=>({name})),status:'online',busy:false};
  assert.equal(classifyRunners([r]),'RUNNER_READY');
  assert.equal(classifyRunners([{...r,busy:true}]),'RUNNER_BUSY');
  assert.equal(classifyRunners([{...r,status:'offline'}]),'RUNNER_OFFLINE');
  assert.equal(classifyRunners([]),'RUNNER_LABEL_MISMATCH');
  assert.equal(classifyRunners(null),'RUNNER_UNREACHABLE');
});
