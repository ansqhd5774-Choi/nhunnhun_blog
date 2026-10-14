import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDirectSubmissionFocus,directFocusReview} from '../publishing/direct-focus.mjs';

const source=(bodyHtml,category='음식')=>({id:'direct-999-focus-test',contentStandard:'SP1',category,bodyHtml});
const h2=title=>`<h2>${title}</h2><p>독자가 필요한 설명입니다.</p>`;

test('focus review separates six core questions from utility sections',()=>{
  const html=['소개','핵심 성분','몸의 작용','섭취 기준','주의사항','선택과 보관'].map(h2).join('')+
    h2('자주 묻는 질문')+h2('핵심 정리')+h2('자료 출처');
  const review=directFocusReview(html);
  assert.equal(review.coreHeadings.length,6);
  assert.deepEqual(review.utilityHeadings,['자주 묻는 질문','핵심 정리','자료 출처']);
  assert.doesNotThrow(()=>assertDirectSubmissionFocus(source(html)));
});

test('focus guard blocks more than six core reader questions',()=>{
  const html=['소개','핵심 성분','몸의 작용','섭취 기준','궁합','주의사항','보관법'].map(h2).join('')+h2('자료 출처');
  assert.throws(()=>assertDirectSubmissionFocus(source(html)),/E_DIRECT_FOCUS_SECTION_OVERLOAD/);
});

test('focus review exposes no research or limitation editorial counters',()=>{
  const html='<h2>효능</h2><p>일반 독자가 필요한 실제 설명입니다.</p>';
  const review=directFocusReview(html);
  assert.equal('researchDetailHits' in review,false);
  assert.equal('limitationHits' in review,false);
  assert.equal('limitationFindings' in review,false);
});

test('food publication is not evaluated by research or caveat wording',()=>{
  const html='<h2>효능</h2><p>연구에서는 무작위 대조군 시험을 설명했습니다. 근거가 부족합니다. 자료가 제한적입니다.</p>';
  const review=directFocusReview(html);
  assert.deepEqual(Object.keys(review).sort(),['coreHeadings','nutrientChangeSections','nutrientFoodRankingSections','utilityHeadings'].sort());
  assert.doesNotThrow(()=>assertDirectSubmissionFocus(source(html)));
});

test('non-nutrient direct posts are checked only for shared structure',()=>{
  const html='<h2>효능</h2><p>독자에게 필요한 설명입니다.</p>';
  assert.doesNotThrow(()=>assertDirectSubmissionFocus(source(html,'약학')));
});
