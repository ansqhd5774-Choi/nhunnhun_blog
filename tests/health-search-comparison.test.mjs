import test from 'node:test';
import assert from 'node:assert/strict';
import {comparePerformance} from '../scripts/compare-health-search-performance.mjs';
const input={current:['2026-09-09','2026-10-06'],previous:['2026-08-12','2026-09-08'],rows:[
  {url:'https://nhunnhun.tistory.com/268',currentClicks:0,previousClicks:0,currentImpressions:48,previousImpressions:62},
  {url:'https://nhunnhun.tistory.com/199#section-2',currentClicks:0,previousClicks:0,currentImpressions:31,previousImpressions:23},
  {url:'https://nhunnhun.tistory.com/1',currentClicks:0,previousClicks:0,currentImpressions:0,previousImpressions:0}]};
test('separates fragments and distinguishes no impressions from zero CTR',()=>{
 const result=comparePerformance(input);assert.equal(result.excludedRows,1);assert.equal(result.rows[0].currentCtr,0);
 assert.equal(result.rows[1].currentCtr,null);assert.equal(result.rows[0].action,'REVIEW_SEARCH_INTENT');
 assert.equal(result.rows[0].implementationEffect,'NOT_ESTABLISHED');
});
test('rejects unequal or overlapping comparison periods',()=>{
 assert.throws(()=>comparePerformance({...input,current:['2026-09-10','2026-10-06']}),/UNEQUAL/);
 assert.throws(()=>comparePerformance({...input,previous:input.current}),/OVERLAPPING/);
});
