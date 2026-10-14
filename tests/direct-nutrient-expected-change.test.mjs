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

test('nutrient TOP ranking blocks estimated values derived from ingredient ratios',()=>{
  const bodyHtml='<h2>2. 일정 기간 먹으면 어떤 변화가 생기고 누가 먹으면 좋을까?</h2><p>성인 사람이 커큐민 500mg을 하루 2회 8주 섭취했을 때 통증이 개선됐습니다.</p><h2>4. 커큐민이 풍부한 식품 TOP3와 실제 함량은?</h2><table><tbody><tr><td>1</td><td>강황가루</td><td>약 580~3140mg/100g</td></tr><tr><td>2</td><td>강황 강화 카레가루</td><td>약 24~132mg/100g 추정</td></tr><tr><td>3</td><td>일반 카레가루</td><td>약 16~88mg/100g 추정</td></tr></tbody></table><p>강황 4.2% 함유 자료를 적용했습니다.</p>';
  assert.throws(()=>assertDirectSubmissionFocus(source(bodyHtml)),/E_DIRECT_NUTRIENT_FOOD_RANKING_ESTIMATED_VALUE/);
});

test('nutrient TOP ranking accepts directly measured comparable values',()=>{
  const bodyHtml='<h2>2. 일정 기간 먹으면 어떤 변화가 생기고 누가 먹으면 좋을까?</h2><p>성인 사람이 커큐민 500mg을 하루 2회 8주 섭취했을 때 통증이 개선됐습니다.</p><h2>4. 성분이 풍부한 식품 TOP3는?</h2><table><tbody><tr><td>1</td><td>식품 A</td><td>120mg/100g</td></tr><tr><td>2</td><td>식품 B</td><td>80mg/100g</td></tr><tr><td>3</td><td>식품 C</td><td>40mg/100g</td></tr></tbody></table><p>세 식품은 같은 분석 자료의 직접 측정값입니다.</p>';
  const review=assertDirectSubmissionFocus(source(bodyHtml));
  assert.deepEqual(review.nutrientFoodRankingSections,[{heading:'성분이 풍부한 식품 TOP3는?',hasEstimatedRankingValue:false}]);
});
