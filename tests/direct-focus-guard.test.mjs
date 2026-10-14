import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDirectSubmissionFocus,directFocusReview} from '../publishing/direct-focus.mjs';

const source=(bodyHtml,category='음식')=>({id:'direct-999-focus-test',contentStandard:'SP1',category,bodyHtml});
const h2=title=>`<h2>${title}</h2><p>독자가 필요한 설명입니다.</p>`;
const FOOD_HEADINGS=['소개','영양소·핵심 성분','꾸준 섭취 변화','궁합·시너지','주의사항','고르는 법·보관법'];

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
