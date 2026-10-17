import test from 'node:test';
import assert from 'node:assert/strict';
import {assertFoodHighlightPhrases} from '../publishing/food-highlight-phrase.mjs';

const source=(marks,title='단호박 칼로리·영양｜베타카로틴·다이어트')=>({
  id:'direct-food-highlight-guard-test',category:'음식',contentStandard:'SP1',title,
  bodyHtml:marks.map(text=>`<mark data-tone="positive"><strong>${text}</strong></mark>`).join('')
});

const fullFood=({
  title='두부 칼로리·단백질｜효능·보관법',
  definition='두부 · 콩 단백질을 굳혀 만든 콩 식품',
  season='연중 유통 · 원료 콩은 주로 가을 수확',
  nutrition='100g · 76kcal · 단백질 8.1g',
  change='콩 단백질 · LDL 콜레스테롤 감소',
  pairing='비타민C 채소 · 철 흡수 보완',
  caution='콩 알레르기 · 섭취 피하기',
  select='포장·영양표 · 구매 전 확인',
  storage='개봉 뒤 · 밀폐 냉장',
  extraNutrition='',
}={})=>({
  id:'direct-food-highlight-coverage-test',category:'음식',contentStandard:'SP1',title,
  bodyHtml:[
    '<h2>1. 소개</h2>',
    `<p>두부는 콩 단백질을 굳혀 만드는 대표적인 콩 식품으로 종류와 용도에 따라 식감이 달라집니다. <mark data-tone="info"><strong>${definition}</strong></mark></p>`,
    `<p>가공식품이라 계절과 상관없이 살 수 있고 원료 콩의 수확 시기는 따로 확인합니다. <mark data-tone="info"><strong>${season}</strong></mark></p>`,
    '<h2>2. 영양소·핵심 성분</h2>',
    `<p>기본 영양값을 먼저 보면 열량과 단백질 밀도를 빠르게 비교할 수 있고 제품에 따라 실제 수치는 달라질 수 있습니다. <mark data-tone="positive"><strong>${nutrition}</strong></mark></p>`,
    extraNutrition,
    '<h2>3. 꾸준 섭취 변화</h2>',
    `<p>꾸준히 먹을 때는 식물성 단백질을 식단에 넣기 쉬워지고 일부 지질 지표 관리에도 연결할 수 있습니다. <mark data-tone="positive"><strong>${change}</strong></mark></p>`,
    '<h2>4. 궁합·시너지</h2>',
    `<p>같이 먹는 음식은 영양 보완뿐 아니라 실제 조리와 식감까지 고려해야 일상에서 활용하기 쉽습니다. <mark data-tone="positive"><strong>${pairing}</strong></mark></p>`,
    '<h2>5. 주의사항</h2>',
    `<p>알레르기처럼 실제 행동을 바꿔야 하는 상황은 일반적인 제한 설명보다 우선해서 확인해야 합니다. <mark data-tone="caution"><strong>${caution}</strong></mark></p>`,
    '<h2>6. 고르는 법·보관법</h2>',
    `<p>구매할 때는 제품 상태와 표시를 보고 개봉한 뒤에는 식품 안전을 위해 적절한 온도와 용기에 보관합니다. <mark data-tone="info"><strong>${select}</strong></mark> <mark data-tone="caution"><strong>${storage}</strong></mark></p>`,
    '<h2>자료 출처</h2><p>출처</p>'
  ].join('')
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

test('full food article requires the food definition itself to be highlighted in the introduction',()=>{
  assert.throws(()=>assertFoodHighlightPhrases(fullFood({definition:'종류 차이 · 수분·단단함·용도 차이'})),/E_DIRECT_FOOD_HIGHLIGHT_DEFINITION_MISSING/);
});

test('full food article requires season, nutrition, change, caution, selection and storage highlight axes',()=>{
  assert.throws(()=>assertFoodHighlightPhrases(fullFood({season:'종류 차이 · 식감·용도'})),/E_DIRECT_FOOD_HIGHLIGHT_AXIS_COVERAGE/);
  assert.throws(()=>assertFoodHighlightPhrases(fullFood({nutrition:'핵심 영양 · 기본값 확인'})),/E_DIRECT_FOOD_HIGHLIGHT_AXIS_COVERAGE/);
  assert.throws(()=>assertFoodHighlightPhrases(fullFood({caution:'담백한 맛 · 다양한 조리'})),/E_DIRECT_FOOD_HIGHLIGHT_AXIS_COVERAGE/);
  assert.throws(()=>assertFoodHighlightPhrases(fullFood({storage:'조리 형태 · 용도별 선택'})),/E_DIRECT_FOOD_HIGHLIGHT_AXIS_COVERAGE/);
});

test('every substantive paragraph or list item in six food sections needs a scan highlight',()=>{
  const extraNutrition='<p>칼슘은 어떤 응고제를 사용했는지에 따라 제품별 차이가 크게 날 수 있으므로 라벨의 실제 수치를 확인하는 것이 가장 정확합니다.</p>';
  assert.throws(()=>assertFoodHighlightPhrases(fullFood({extraNutrition})),/E_DIRECT_FOOD_HIGHLIGHT_BLOCK_COVERAGE/);
});

test('coverage is semantic and has no global highlight cap',()=>{
  const article=fullFood();
  article.bodyHtml=article.bodyHtml.replace('<h2>자료 출처</h2>',Array.from({length:24},(_,i)=>`<mark data-tone="info"><strong>추가 핵심 ${i+1} · 확인 항목</strong></mark>`).join('')+'<h2>자료 출처</h2>');
  assert.doesNotThrow(()=>assertFoodHighlightPhrases(article));
});

test('complete six-axis scan coverage passes',()=>{
  assert.doesNotThrow(()=>assertFoodHighlightPhrases(fullFood()));
});
