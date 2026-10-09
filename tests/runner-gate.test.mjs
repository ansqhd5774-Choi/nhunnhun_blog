import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSourceIdentity,classifyRunners,RUNNER_LABELS,mutationSourceId} from '../publishing/runner-gate.mjs';
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
test('only documentation-only forward drift is accepted with known changed paths',()=>{
 const a='a'.repeat(40),b='b'.repeat(40);
 assert.doesNotThrow(()=>assertSourceIdentity(a,a,b,['AGENTS.md','docs/content/DIRECT_AUTHORING_R1.md']));
 for(const paths of [[],['publishing/direct-design.mjs'],['updates/direct-299-test.json'],['pnpm-lock.yaml'],['.github/workflows/update-posts.yml'],['docs/a.md','publishing/update.mjs']])assert.throws(()=>assertSourceIdentity(a,a,b,paths),/BLOCKED_SOURCE_DRIFT/);
 assert.throws(()=>assertSourceIdentity(a,b,b,['docs/a.md']),/BLOCKED_SOURCE_DRIFT/);
});
test('selected source is protected while another article and its checkpoint may advance',()=>{
 const a='a'.repeat(40),b='b'.repeat(40),id='direct-299-hempseed-oil-20261009';
 assert.doesNotThrow(()=>assertSourceIdentity(a,a,b,['updates/direct-333-other.json','publishing/update-state/direct-333-other.json'],id));
 for(const p of ['updates/'+id+'.json','publishing/update-state/'+id+'.json','publishing/update.mjs'])assert.throws(()=>assertSourceIdentity(a,a,b,[p],id),/BLOCKED_SOURCE_DRIFT/);
 assert.throws(()=>assertSourceIdentity(a,a,b,['updates/direct-333-other.json']),/BLOCKED_SOURCE_DRIFT/);
});
test('new publication source ID scopes unrelated updates without weakening its own protection',()=>{
 const a='a'.repeat(40),b='b'.repeat(40),id='direct-mussels-20261009';
 const target=mutationSourceId({PUBLISH_SOURCE_ID:id});
 assert.equal(target,id);
 assert.equal(mutationSourceId({UPDATE_SOURCE_ID:id}),id);
 assert.doesNotThrow(()=>assertSourceIdentity(a,a,b,['updates/direct-272-octopus-20261009.json'],target));
 for(const path of ['posts/'+id+'.json','publishing/state/'+id+'.json','publishing/publish.mjs'])
   assert.throws(()=>assertSourceIdentity(a,a,b,[path],target),/BLOCKED_SOURCE_DRIFT/);
 assert.throws(()=>assertSourceIdentity(a,a,b,['updates/direct-272-octopus-20261009.json'],mutationSourceId({})),/BLOCKED_SOURCE_DRIFT/);
});
