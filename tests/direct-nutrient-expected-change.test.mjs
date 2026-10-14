import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDirectSubmissionFocus,directFocusReview} from '../publishing/direct-focus.mjs';

const source=bodyHtml=>({id:'direct-nutrient-expected-change-test',contentStandard:'SP1',category:'영양소',bodyHtml});

test('nutrient expected-change section with human evidence requires dose duration and observed change together',()=>{
  const bodyHtml='<h2>2. 어떤 효능이 확인됐고 누가 먹으면 좋을까?</h2><p>성인에서 무릎 통증이 개선되는 방향이 확인됐습니다.</p>';
  assert.throws(()=>assertDirectSubmissionFocus(source(bodyHtml)),/E_DIRECT_NUTRIENT_EXPECTED_CHANGE_INCOMPLETE/);
});

test('reader-first nutrient expected change passes without research-report framing',()=>{
  const bodyHtml='<h2>2. 일정 기간 먹으면 어떤 변화가 생기고 누가 먹으면 좋을까?</h2><p>무릎 골관절염이 있는 성인이 커큐민 500mg을 하루 2회, 8주 섭취했을 때 무릎 통증과 걷기 기능이 개선됐습니다.</p>';
  const review=assertDirectSubmissionFocus(source(bodyHtml));
  assert.equal(review.researchDetailHits,0);
  assert.equal(review.nutrientExpectedChangeSections.length,1);
  assert.deepEqual(review.nutrientExpectedChangeSections[0],{
    heading:'일정 기간 먹으면 어떤 변화가 생기고 누가 먹으면 좋을까?',
    hasHumanEvidence:true,
    hasObservedChange:true,
    hasStudyDuration:true,
    hasIntakeAmount:true,
  });
});

test('study-design words alone do not substitute for a reader-relevant human population',()=>{
  const bodyHtml='<h2>2. 효능과 기대 변화</h2><p>무작위 임상시험에서 커큐민 500mg을 8주 섭취했을 때 통증이 개선됐습니다.</p>';
  const review=directFocusReview(bodyHtml);
  assert.equal(review.nutrientExpectedChangeSections[0].hasHumanEvidence,false);
  assert.doesNotThrow(()=>assertDirectSubmissionFocus(source(bodyHtml)));
});

test('calendar publication year does not count as a study duration',()=>{
  const bodyHtml='<h2>2. 효능과 기대 변화</h2><p>2024년 성인에게 커큐민 500mg을 섭취하게 했을 때 무릎 통증이 개선됐습니다.</p>';
  assert.throws(()=>assertDirectSubmissionFocus(source(bodyHtml)),/E_DIRECT_NUTRIENT_EXPECTED_CHANGE_INCOMPLETE/);
});

test('nutrient submission requires a dedicated expected-change or benefit section',()=>{
  const bodyHtml='<h2>1. 무엇인가?</h2><p>성분 설명입니다.</p><h2>3. 하루 얼마를 언제 먹을까?</h2><p>500mg을 하루 2회 먹습니다.</p>';
  assert.throws(()=>assertDirectSubmissionFocus(source(bodyHtml)),/E_DIRECT_NUTRIENT_EXPECTED_CHANGE_SECTION_MISSING/);
});

test('nutrient TOP ranking blocks estimated values derived from ingredient ratios',()=>{
  const bodyHtml='<h2>2. 일정 기간 먹으면 어떤 변화가 생기고 누가 먹으면 좋을까?</h2><p>성인이 커큐민 500mg을 하루 2회 8주 섭취했을 때 통증이 개선됐습니다.</p><h2>4. 커큐민이 풍부한 식품 TOP3와 실제 함량은?</h2><table><tbody><tr><td>1</td><td>강황가루</td><td>약 580~3140mg/100g</td></tr><tr><td>2</td><td>강황 강화 카레가루</td><td>약 24~132mg/100g 추정</td></tr><tr><td>3</td><td>일반 카레가루</td><td>약 16~88mg/100g 추정</td></tr></tbody></table><p>강황 4.2% 함유 자료를 적용했습니다.</p>';
  assert.throws(()=>assertDirectSubmissionFocus(source(bodyHtml)),/E_DIRECT_NUTRIENT_FOOD_RANKING_ESTIMATED_VALUE/);
});

test('nutrient TOP ranking accepts directly measured comparable values',()=>{
  const bodyHtml='<h2>2. 일정 기간 먹으면 어떤 변화가 생기고 누가 먹으면 좋을까?</h2><p>성인이 커큐민 500mg을 하루 2회 8주 섭취했을 때 통증이 개선됐습니다.</p><h2>4. 성분이 풍부한 식품 TOP3는?</h2><table><tbody><tr><td>1</td><td>식품 A</td><td>120mg/100g</td></tr><tr><td>2</td><td>식품 B</td><td>80mg/100g</td></tr><tr><td>3</td><td>식품 C</td><td>40mg/100g</td></tr></tbody></table><p>세 식품은 같은 기준의 직접 측정값입니다.</p>';
  const review=assertDirectSubmissionFocus(source(bodyHtml));
  assert.deepEqual(review.nutrientFoodRankingSections,[{heading:'성분이 풍부한 식품 TOP3는?',hasEstimatedRankingValue:false}]);
});

test('unranked nutrient food amounts are allowed when comparison basis differs',()=>{
  const bodyHtml='<h2>2. 일정 기간 먹으면 어떤 변화가 생기고 누가 먹으면 좋을까?</h2><p>성인이 커큐민 500mg을 하루 2회 8주 섭취했을 때 통증이 개선됐습니다.</p><h2>4. 커큐민은 어떤 식품에 얼마나 들어 있을까?</h2><table><tbody><tr><td>강황</td><td>1330mg/100g</td><td>생것</td></tr><tr><td>생강</td><td>160mg/100g</td><td>생것</td></tr><tr><td>울금</td><td>별도 기준의 측정값</td><td>건조 원료</td></tr></tbody></table><p>생것과 건조 원료는 기준이 달라 순위를 붙이지 않았습니다.</p>';
  const review=assertDirectSubmissionFocus(source(bodyHtml));
  assert.deepEqual(review.nutrientFoodRankingSections,[]);
});
