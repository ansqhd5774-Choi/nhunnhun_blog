import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDirectSubmissionFocus,directFocusReview} from '../publishing/direct-focus.mjs';

const source=(bodyHtml,category='음식',extra={})=>({id:'direct-999-focus-test',contentStandard:'SP1',category,bodyHtml,...extra});
const h2=title=>`<h2>${title}</h2><p>독자가 필요한 설명입니다.</p>`;
const FOOD_HEADINGS=['소개','영양소·핵심 성분','꾸준 섭취 변화','궁합·시너지','주의사항','고르는 법·보관법'];
const nutrientChange='<h2>2. 한 달 복용 후 기대되는 신체 변화는 무엇인가?</h2><p>한 달 동안 하루 4g 섭취 시 혈압 감소가 관찰됐습니다.</p>';

test('focus review separates six core questions from utility sections',()=>{
  const html=FOOD_HEADINGS.map(h2).join('')+h2('자주 묻는 질문')+h2('핵심 정리')+h2('자료 출처');
  const review=directFocusReview(html);
  assert.equal(review.coreHeadings.length,6);
  assert.deepEqual(review.utilityHeadings,['자주 묻는 질문','핵심 정리','자료 출처']);
  assert.doesNotThrow(()=>assertDirectSubmissionFocus(source(html)));
});

test('focus guard blocks more than six core reader questions',()=>{
  const html=[...FOOD_HEADINGS,'추가 핵심 질문'].map(h2).join('')+h2('자료 출처');
  assert.throws(()=>assertDirectSubmissionFocus(source(html)),/E_DIRECT_FOCUS_SECTION_OVERLOAD/);
});

test('focus review exposes no research or limitation editorial counters',()=>{
  const html='<h2>꾸준 섭취 변화</h2><p>일반 독자가 필요한 실제 설명입니다.</p>';
  const review=directFocusReview(html);
  assert.equal('researchDetailHits' in review,false);
  assert.equal('limitationHits' in review,false);
  assert.equal('limitationFindings' in review,false);
});

test('food publication focus guard checks structure rather than expert-review wording',()=>{
  const html='<h2>꾸준 섭취 변화</h2><p>일반 독자가 바로 활용할 수 있는 설명입니다.</p>';
  const review=directFocusReview(html);
  assert.deepEqual(Object.keys(review).sort(),['coreHeadings','nutrientChangeSections','nutrientFoodRankingSections','utilityHeadings'].sort());
  assert.doesNotThrow(()=>assertDirectSubmissionFocus(source(html)));
});

test('non-nutrient direct posts are checked only for shared structure',()=>{
  const html='<h2>효능</h2><p>독자에게 필요한 설명입니다.</p>';
  assert.doesNotThrow(()=>assertDirectSubmissionFocus(source(html,'약학')));
});

test('nutrient TOP food section must keep a table instead of flattening to highlighted prose',()=>{
  const html=nutrientChange+'<h2>4. 풍부한 식품 TOP7과 각 식품의 평균 함유량은 얼마인가?</h2><p><mark><strong>호박씨 5.35g</strong></mark></p>';
  assert.throws(()=>assertDirectSubmissionFocus(source(html,'영양소')),/E_DIRECT_NUTRIENT_FOOD_TABLE_MISSING/);
});

test('nutrient pairing section must keep list or table card structure',()=>{
  const html=nutrientChange+'<h2>5. 함께 섭취하면 좋은 영양소와 주의할 상호작용은 무엇인가?</h2><p><mark><strong>시트룰린과 함께</strong></mark> 섭취합니다.</p><p><strong>혈압약 주의</strong></p>';
  assert.throws(()=>assertDirectSubmissionFocus(source(html,'영양소')),/E_DIRECT_NUTRIENT_PAIRING_STRUCTURE_MISSING/);
});

test('nutrient pairing section accepts existing list card structure',()=>{
  const html=nutrientChange+'<h2>5. 함께 섭취하면 좋은 영양소와 주의할 상호작용은 무엇인가?</h2><ul><li><strong>시트룰린과 함께</strong> 혈중 아르기닌 증가</li><li><strong>혈압약 주의</strong> 저혈압 확인</li></ul>';
  assert.doesNotThrow(()=>assertDirectSubmissionFocus(source(html,'영양소')));
});

test('nutrient deficiency and excess section must keep itemized structure',()=>{
  const html=nutrientChange+'<h2>6. 결핍 및 과다 복용의 위험, 예방 가능한 질병과 추천 제품은 무엇인가?</h2><p><strong>결핍</strong> 설명</p><p><strong>과다</strong> 설명</p>';
  assert.throws(()=>assertDirectSubmissionFocus(source(html,'영양소')),/E_DIRECT_NUTRIENT_SAFETY_PRODUCT_STRUCTURE_MISSING/);
});

test('emphasis-only nutrient maintenance cannot reduce locked HTML structure counts',()=>{
  const html=nutrientChange+'<ul><li><strong>기존 카드 1개</strong></li></ul>';
  const locked=source(html,'영양소',{changeScope:'emphasis-only',structureBaseline:{h2:1,h3:0,ul:1,ol:0,li:2,table:0,tr:0,img:0,blockquote:0}});
  assert.throws(()=>assertDirectSubmissionFocus(locked),/E_DIRECT_STRUCTURE_PRESERVATION/);
});

test('emphasis-only nutrient maintenance passes when locked HTML structure is preserved',()=>{
  const html=nutrientChange+'<ul><li><strong>기존 카드 1</strong></li><li><strong>기존 카드 2</strong></li></ul>';
  const locked=source(html,'영양소',{changeScope:'emphasis-only',structureBaseline:{h2:1,h3:0,ul:1,ol:0,li:2,table:0,tr:0,img:0,blockquote:0}});
  assert.doesNotThrow(()=>assertDirectSubmissionFocus(locked));
});
