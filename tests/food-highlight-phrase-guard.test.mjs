import test from 'node:test';
import assert from 'node:assert/strict';
import {assertFoodHighlightPhrases} from '../publishing/food-highlight-phrase.mjs';

const source=(marks,title='단호박 칼로리·영양｜베타카로틴·다이어트')=>({
  id:'direct-food-highlight-guard-test',category:'음식',contentStandard:'SP1',title,
  bodyHtml:marks.map(text=>`<mark data-tone="positive"><strong>${text}</strong></mark>`).join('')
});

test('food rejects narrative sentence highlight',()=>{
  assert.throws(()=>assertFoodHighlightPhrases(source(['달걀을 곁들이면 부족한 단백질·지방을 보완할 수 있습니다'])),/E_DIRECT_FOOD_HIGHLIGHT_NARRATIVE/);
});

test('food rejects long explanatory highlight even without sentence punctuation',()=>{
  assert.throws(()=>assertFoodHighlightPhrases(source(['칼륨 507mg/100g은 나트륨이 많은 식단의 균형 보완에 활용할 수 있음'])),/E_DIRECT_FOOD_HIGHLIGHT_NARRATIVE/);
});

test('food accepts short scan phrases',()=>{
  const marks=['7~9월 · 국내산 유통 활발','베타카로틴 4,018㎍ · 비타민A 전구체','식이섬유 4.6g · 포만감·배변 관리','달걀 · 단백질·지방 보완','칼륨 제한 중 · 1회 섭취량 조절','자른 뒤 · 밀폐 냉장 · 빠른 섭취'];
  assert.doesNotThrow(()=>assertFoodHighlightPhrases(source(marks)));
});

test('food rejects mechanical repetition of food name across highlights',()=>{
  const marks=['단호박 · 비타민A 전구체','단호박 · 포만감 관리','단호박 · 면역 기능','단호박 · 단백질 보완','단호박 · 칼륨 공급','보관 · 밀폐 냉장'];
  assert.throws(()=>assertFoodHighlightPhrases(source(marks)),/E_DIRECT_FOOD_HIGHLIGHT_SUBJECT_REPEAT/);
});

test('food name remains allowed when genuinely useful and not mechanically repeated',()=>{
  const marks=['미니단호박 · 한두 끼 용량','베타카로틴 · 비타민A 전구체','식이섬유 · 포만감 관리','달걀 · 단백질 보완','칼륨 제한 중 · 섭취량 조절','자른 뒤 · 밀폐 냉장'];
  assert.doesNotThrow(()=>assertFoodHighlightPhrases(source(marks)));
});
