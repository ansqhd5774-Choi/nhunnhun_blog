import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceIdForEvent,resolveDirectSourceId} from '../authoring/direct-dispatch.mjs';

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

test('push with missing commit file arrays resolves via authenticated compare',async()=>{
  const eventPayload={
    ref:'refs/heads/main',deleted:false,
    before:'a'.repeat(40),after:'b'.repeat(40)
  };
  let calls=0;
  const resolved=await resolveDirectSourceId({eventName:'push',eventPayload,token:'fixture',fetcher:async(url,options)=>{
    calls++;assert.match(url,/\/compare\/a{40}\.\.\.b{40}$/);
    assert.equal(options.headers.Authorization,'Bearer fixture');
    return {ok:true,json:async()=>({files:[{filename:'updates/direct-252-perilla-leaf-20261009.json',status:'modified'},{filename:'docs/note.md',status:'modified'}]})};
  }});
  assert.equal(resolved,'direct-252-perilla-leaf-20261009');
  assert.equal(calls,1);
});

test('compare fallback fails closed when several direct sources changed',async()=>{
  const eventPayload={ref:'refs/heads/main',before:'a'.repeat(40),after:'b'.repeat(40)};
  await assert.rejects(()=>resolveDirectSourceId({eventName:'push',eventPayload,token:'fixture',fetcher:async()=>({
    ok:true,json:async()=>({files:[{filename:'updates/direct-a.json',status:'added'},{filename:'updates/direct-b.json',status:'modified'}]})
  })}),/E_DIRECT_PUSH_SOURCE_COUNT/);
});

test('compare fallback rejects missing range and failed compare response',async()=>{
  await assert.rejects(()=>resolveDirectSourceId({eventName:'push',eventPayload:{ref:'refs/heads/main',before:'0'.repeat(40),after:'b'.repeat(40)}}),/E_DIRECT_PUSH_RANGE/);
  await assert.rejects(()=>resolveDirectSourceId({eventName:'push',eventPayload:{ref:'refs/heads/main',before:'a'.repeat(40),after:'b'.repeat(40)},token:'fixture',fetcher:async()=>({ok:false,status:403})}),/E_DIRECT_PUSH_COMPARE_HTTP/);
});
