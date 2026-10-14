import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDirectSubmissionFocus,directFocusReview} from '../publishing/direct-focus.mjs';

const source=bodyHtml=>({id:'direct-nutrient-expected-change-test',contentStandard:'SP1',category:'영양소',bodyHtml});

test('nutrient expected-change section with human evidence requires dose duration and observed change together',()=>{
  const bodyHtml='<h2>2. 어떤 효능이 확인됐고 누가 먹으면 좋을까?</h2><p>성인 사람 연구에서 무릎 통증이 개선되는 방향이 확인됐습니다.</p>';
  assert.throws(()=>assertDirectSubmissionFocus(source(bodyHtml)),/E_DIRECT_NUTRIENT_EXPECTED_CHANGE_INCOMPLETE/);
});

test('nutrient expected-change section passes when target dose duration and observed change are connected',()=>{
  const bodyHtml='<h2>2. 일정 기간 먹으면 어떤 변화가 생기고 누가 먹으면 좋을까?</h2><p>무릎 골관절염 성인 101명이 표준화 커큐민 추출물 500mg을 하루 2회, 8주 섭취한 시험에서 무릎 통증 점수와 보행 기능이 위약보다 더 개선됐습니다.</p>';
  const review=assertDirectSubmissionFocus(source(bodyHtml));
  assert.equal(review.nutrientExpectedChangeSections.length,1);
  assert.deepEqual(review.nutrientExpectedChangeSections[0],{
    heading:'일정 기간 먹으면 어떤 변화가 생기고 누가 먹으면 좋을까?',
    hasHumanEvidence:true,
    hasObservedChange:true,
    hasStudyDuration:true,
    hasIntakeAmount:true,
  });
});

test('calendar publication year does not count as a study duration',()=>{
  const bodyHtml='<h2>2. 효능과 기대 변화</h2><p>2024년 성인 연구에서 커큐민 500mg 섭취 후 무릎 통증이 개선됐습니다.</p>';
  assert.throws(()=>assertDirectSubmissionFocus(source(bodyHtml)),/E_DIRECT_NUTRIENT_EXPECTED_CHANGE_INCOMPLETE/);
});

test('nutrient submission requires a dedicated expected-change or benefit section',()=>{
  const bodyHtml='<h2>1. 무엇인가?</h2><p>성분 설명입니다.</p><h2>3. 하루 얼마를 언제 먹을까?</h2><p>500mg을 하루 2회 먹습니다.</p>';
  assert.throws(()=>assertDirectSubmissionFocus(source(bodyHtml)),/E_DIRECT_NUTRIENT_EXPECTED_CHANGE_SECTION_MISSING/);
});
