import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDirectSubmissionFocus,directFocusReview} from '../publishing/direct-focus.mjs';

const source=bodyHtml=>({id:'direct-999-focus-test',contentStandard:'SP1',bodyHtml});
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

test('focus guard blocks research-report detail overload',()=>{
  const html='<h2>효능</h2><p>연구에서는 무작위 대조군 시험을 설명했습니다. 120명을 대상으로 통계적으로 유의한 차이를 분석했습니다.</p>';
  const review=directFocusReview(html);
  assert.ok(review.researchDetailHits>2);
  assert.throws(()=>assertDirectSubmissionFocus(source(html)),/E_DIRECT_FOCUS_RESEARCH_OVERLOAD/);
});

test('focus guard blocks repeated evidence-limit caveats outside pure safety section',()=>{
  const html='<h2>효능</h2><p>근거가 부족합니다. 자료가 제한적입니다. 효과를 단정하기 어렵습니다.</p>'+
    '<h2>주의사항</h2><p>안전 근거가 부족한 제품은 피합니다.</p>';
  const review=directFocusReview(html);
  assert.equal(review.limitationHits,3);
  assert.throws(()=>assertDirectSubmissionFocus(source(html)),/E_DIRECT_FOCUS_LIMITATION_OVERLOAD/);
});

test('focus guard catches guarantee no-effect no-database and universal-negation variants',()=>{
  const html='<h2>한 달 복용 후 기대 변화</h2><p>기간 효과를 보장할 수 없습니다. 뚜렷한 임상 이득을 확인하지 못했습니다.</p>'+
    '<h2>식품 TOP7</h2><p>비교 가능한 공식 데이터베이스는 없습니다.</p>'+
    '<h2>권장 대상</h2><p>모든 사람이 보충제를 먹어야 하는 것은 아닙니다.</p>';
  const review=directFocusReview(html);
  assert.equal(review.limitationHits,4);
  assert.equal(review.limitationFindings.length,4);
  assert.ok(review.limitationFindings.some(f=>/보장할 수 없습니다/.test(f.match)));
  assert.ok(review.limitationFindings.some(f=>/비교 가능한 공식 데이터베이스는 없습니다/.test(f.match)));
  assert.ok(review.limitationFindings.some(f=>/모든 사람이 보충제를 먹어야 하는 것은 아닙니다/.test(f.match)));
  assert.throws(()=>assertDirectSubmissionFocus(source(html)),/E_DIRECT_FOCUS_LIMITATION_OVERLOAD/);
});

test('focus review recognizes Korean negative-copula wording as one caveat sentence',()=>{
  const review=directFocusReview('<h2>권장 대상</h2><p>모든 사람이 보충제를 먹어야 하는 것은 아닙니다.</p>');
  assert.equal(review.limitationHits,1);
  assert.match(review.limitationFindings[0].match,/아닙니다/);
});

test('mixed risk heading is not treated as a pure safety exemption',()=>{
  const html='<h2>효능</h2><p>근거가 부족합니다. 자료가 제한적입니다.</p>'+
    '<h2>결핍·과다 복용의 위험, 예방 가능한 질병과 추천 제품</h2><p>효과를 보장할 수 없습니다.</p>';
  const review=directFocusReview(html);
  assert.equal(review.limitationHits,3);
  assert.throws(()=>assertDirectSubmissionFocus(source(html)),/E_DIRECT_FOCUS_LIMITATION_OVERLOAD/);
});
