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
 for(const paths of [[],['publishing/direct-design.mjs'],['pnpm-lock.yaml'],['.github/workflows/update-posts.yml'],['docs/a.md','publishing/update.mjs']])assert.throws(()=>assertSourceIdentity(a,a,b,paths),/BLOCKED_SOURCE_DRIFT/);
 assert.throws(()=>assertSourceIdentity(a,b,b,['docs/a.md']),/BLOCKED_SOURCE_DRIFT/);
});
test('another source may advance through standard source-owned artifacts',()=>{
 const a='a'.repeat(40),b='b'.repeat(40),id='direct-299-hempseed-oil-20261009',other='direct-baekji-angelica-dahurica-20261014';
 const paths=[
   'posts/'+other+'.json',
   'updates/'+other+'.json',
   'content-reviews/posts/'+other+'.json',
   'content-reviews/updates/'+other+'.json',
   'publishing/state/'+other+'.json',
   'publishing/update-state/'+other+'.json',
   'authoring/target-resolution/'+other+'.json',
   'authoring/target-resolution-results/'+other+'.json',
   'authoring/direct-drafts/gate0-'+other+'.json',
   'authoring/direct-drafts/gate0-'+other+'.meta.json',
   'automation/update-retry/'+other+'.txt'
 ];
 assert.doesNotThrow(()=>assertSourceIdentity(a,a,b,paths,id));
 for(const path of [
   'posts/'+id+'.json','updates/'+id+'.json','content-reviews/posts/'+id+'.json','content-reviews/updates/'+id+'.json',
   'publishing/state/'+id+'.json','publishing/update-state/'+id+'.json','authoring/target-resolution/'+id+'.json',
   'authoring/target-resolution-results/'+id+'.json','authoring/direct-drafts/gate0-'+id+'.json','authoring/direct-drafts/gate0-'+id+'.meta.json',
   'automation/update-retry/'+id+'.txt','publishing/update.mjs','publishing/publish.mjs','package.json'
 ]) assert.throws(()=>assertSourceIdentity(a,a,b,[path],id),/BLOCKED_SOURCE_DRIFT/);
});
test('new publication source ID scopes unrelated article artifacts without weakening its own protection',()=>{
 const a='a'.repeat(40),b='b'.repeat(40),id='direct-mussels-20261009';
 const target=mutationSourceId({PUBLISH_SOURCE_ID:id});
 assert.equal(target,id);
 assert.equal(mutationSourceId({UPDATE_SOURCE_ID:id}),id);
 assert.doesNotThrow(()=>assertSourceIdentity(a,a,b,['updates/direct-272-octopus-20261009.json'],target));
 for(const path of ['posts/'+id+'.json','publishing/state/'+id+'.json','publishing/publish.mjs'])
   assert.throws(()=>assertSourceIdentity(a,a,b,[path],target),/BLOCKED_SOURCE_DRIFT/);
 assert.throws(()=>assertSourceIdentity(a,a,b,['updates/direct-272-octopus-20261009.json'],mutationSourceId({})),/BLOCKED_SOURCE_DRIFT/);
});

test('unknown artifacts stay protected even when their names resemble another source',()=>{
 const a='a'.repeat(40),b='b'.repeat(40),id='direct-taro-nutrition-oxalate-storage-20261010';
 for(const path of [
   'content-reviews/updates/unknown.txt','authoring/direct-drafts/random-direct-other.json',
   'publishing/content-standards.mjs','pnpm-lock.yaml','automation/publish-retry-request.txt'
 ]) assert.throws(()=>assertSourceIdentity(a,a,b,[path],id),/BLOCKED_SOURCE_DRIFT/);
});
