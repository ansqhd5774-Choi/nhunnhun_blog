import test from 'node:test';import assert from 'node:assert/strict';
import {analyzeBacklog,mutationGroup,ledgerLimits} from './remote-snapshot.mjs';
import {updateFingerprint} from '../publishing/update-core.mjs';
test('snapshot distinguishes pending NEW from uncertain submissions and completed updates',()=>{
  const a={id:'new-food',status:'ready',approved:true},b={...a,id:'uncertain-food'},c={id:'existing-food',status:'ready',approved:true,targetUrl:'https://nhunnhun.tistory.com/123'};
  const r=analyzeBacklog([a,b],[c],{'uncertain-food':{phase:'submitting'}},{'existing-food':{phase:'updated',fingerprint:updateFingerprint(c),url:c.targetUrl}});
  assert.deepEqual(r.pending_sources,[{id:'new-food',kind:'NEW'}]);assert.deepEqual(r.uncertain_sources,[{id:'uncertain-food',kind:'NEW',status:'RECONCILIATION_REQUIRED'}]);
});
test('shared mutation lock is read from the correct job rather than workflow validation group',()=>{
  const y='concurrency:\n  group: validation\njobs:\n  validate:\n    runs-on: ubuntu-latest\n  publish:\n    concurrency:\n      group: nhunnhun-tistory-mutation\n      cancel-in-progress: false\n    runs-on: windows\n';
  assert.equal(mutationGroup(y,'publish'),'nhunnhun-tistory-mutation');assert.equal(mutationGroup(y,'update'),null);assert.equal(mutationGroup(y.replace('cancel-in-progress: false','cancel-in-progress: true'),'publish'),null);
});

test('remote ledger limits preserve publication time and explicit human/rate holds',()=>{const result=ledgerLimits({a:{phase:'published',timestamp:'2026-10-04T00:00:00Z'},b:{phase:'failed',failureCode:'E_TISTORY_DAILY_PUBLISH_LIMIT'}},{c:{phase:'updated',timestamp:'2026-10-04T01:00:00Z'}});assert.equal(result.last_published_at,Date.parse('2026-10-04T01:00:00Z'));assert.equal(result.publication_holds.length,1);assert.throws(()=>ledgerLimits({a:{phase:'published'}},{}),/E_REMOTE_LEDGER_TIME/);});
