import test from 'node:test';
import assert from 'node:assert/strict';
import {assertFoodNoStockLead} from '../publishing/direct-preflight.mjs';
import {assertVerifiedFoodStockLeadRemoval,removeFoodStockLead} from '../publishing/food-stock-lead-removal.mjs';
import {readFileSync} from 'node:fs';

test('food direct sources reject both historical stock lead labels',()=>{
  for(const phrase of ['핵심 먼저','핵심만 먼저:']){
    assert.throws(()=>assertFoodNoStockLead({
      id:'direct-123-example-r1',category:'음식',bodyHtml:`<p>소개</p><blockquote><strong>${phrase}</strong> 예시</blockquote>`
    }),{message:'E_DIRECT_FOOD_STOCK_LEAD'});
  }
});

test('food direct sources permit an ordinary reader-first introduction',()=>{
  assert.doesNotThrow(()=>assertFoodNoStockLead({
    id:'direct-123-example-r2',category:'음식',bodyHtml:'<p>제철 식품을 맛있게 고르는 방법부터 살펴봅니다.</p>'
  }));
});

test('other categories remain outside the food rule',()=>{
  assert.doesNotThrow(()=>assertFoodNoStockLead({
    id:'direct-123-other-r1',category:'영양소',bodyHtml:'<p>핵심 먼저: 다른 분야</p>'
  }));
});

test('stock lead removal preserves all text outside one intro block',()=>{
  const start='<p>소재의 특징</p>\n';
  const summary='<blockquote><strong>핵심 먼저</strong> 중복 요약</blockquote>';
  const rest='\n<h2>1. 소개</h2><p>자세한 본문</p>';
  assert.equal(removeFoodStockLead(start+summary+rest),start+rest);
});

test('verified scoped correction rejects any additional editorial changes',()=>{
  const src=JSON.parse(readFileSync('updates/direct-393-summary-cleanup-20261022.json','utf8'));
  assert.doesNotThrow(()=>assertVerifiedFoodStockLeadRemoval({...src,changeScope:'stock-lead-removal',stockLeadBaselineId:'direct-393-shiitake-food-r2-20261022'}));
  const drift={...src,changeScope:'stock-lead-removal',stockLeadBaselineId:'direct-393-shiitake-food-r2-20261022',title:'다른 제목'};
  assert.throws(()=>assertVerifiedFoodStockLeadRemoval(drift),{message:'E_STOCK_LEAD_SCOPE_DRIFT'});
});
