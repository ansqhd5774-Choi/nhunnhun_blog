import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDirectSubmissionFocus,directFocusReview} from '../publishing/direct-focus.mjs';

const source=bodyHtml=>({id:'direct-nutrient-expected-change-test',contentStandard:'SP1',category:'영양소',bodyHtml});
const h2='한 달 복용 후 기대되는 신체 변화와 권장 대상은 누구인가?';

test('nutrient change section with a target group requires amount period and change together',()=>{
  const bodyHtml=`<h2>${h2}</h2><p>성인은 무릎 통증이 줄어들 수 있습니다.</p>`;
  assert.throws(()=>assertDirectSubmissionFocus(source(bodyHtml)),/E_DIRECT_NUTRIENT_EXPECTED_CHANGE_INCOMPLETE/);
});

test('general-reader nutrient change passes without research-report wording',()=>{
  const bodyHtml=`<h2>${h2}</h2><p>무릎 골관절염이 있는 성인이 커큐민 500mg을 하루 2회, 8주 섭취했을 때 무릎 통증과 걷기 기능이 개선됐습니다.</p>`;
  const review=assertDirectSubmissionFocus(source(bodyHtml));
  assert.equal(review.nutrientChangeSections.length,1);
  assert.deepEqual(review.nutrientChangeSections[0],{
    heading:h2,
    hasTargetGroup:true,
    hasChange:true,
    hasTimePeriod:true,
    hasAmount:true,
  });
  assert.equal('researchDetailHits' in review,false);
  assert.equal('limitationHits' in review,false);
});

test('study-design wording is not a target-group signal',()=>{
  const bodyHtml=`<h2>${h2}</h2><p>무작위 임상시험에서 커큐민 500mg을 8주 섭취했을 때 통증이 개선됐습니다.</p>`;
  const review=directFocusReview(bodyHtml);
  assert.equal(review.nutrientChangeSections[0].hasTargetGroup,false);
  assert.doesNotThrow(()=>assertDirectSubmissionFocus(source(bodyHtml)));
});

test('calendar publication year does not count as a time period',()=>{
  const bodyHtml=`<h2>${h2}</h2><p>2024년 성인에게 커큐민 500mg을 섭취하게 했을 때 무릎 통증이 개선됐습니다.</p>`;
  assert.throws(()=>assertDirectSubmissionFocus(source(bodyHtml)),/E_DIRECT_NUTRIENT_EXPECTED_CHANGE_INCOMPLETE/);
});

test('nutrient submission requires the change or benefit section',()=>{
  const bodyHtml='<h2>정의와 주요 성분 및 작용은 무엇인가?</h2><p>성분 설명입니다.</p><h2>일일 권장 섭취량과 효과적인 섭취법은 무엇인가?</h2><p>500mg을 하루 2회 먹습니다.</p>';
  assert.throws(()=>assertDirectSubmissionFocus(source(bodyHtml)),/E_DIRECT_NUTRIENT_EXPECTED_CHANGE_SECTION_MISSING/);
});

test('nutrient TOP ranking blocks estimated values derived from ingredient ratios',()=>{
  const bodyHtml=`<h2>${h2}</h2><p>성인이 커큐민 500mg을 하루 2회 8주 섭취했을 때 통증이 개선됐습니다.</p><h2>풍부한 식품 TOP7과 각 식품의 평균 함유량은 얼마인가?</h2><table><tbody><tr><td>1</td><td>강황가루</td><td>약 580~3140mg/100g</td></tr><tr><td>2</td><td>강황 강화 카레가루</td><td>약 24~132mg/100g 추정</td></tr></tbody></table>`;
  assert.throws(()=>assertDirectSubmissionFocus(source(bodyHtml)),/E_DIRECT_NUTRIENT_FOOD_RANKING_ESTIMATED_VALUE/);
});

test('nutrient TOP ranking accepts directly measured values',()=>{
  const bodyHtml=`<h2>${h2}</h2><p>성인이 커큐민 500mg을 하루 2회 8주 섭취했을 때 통증이 개선됐습니다.</p><h2>풍부한 식품 TOP7과 각 식품의 평균 함유량은 얼마인가?</h2><table><tbody><tr><td>1</td><td>식품 A</td><td>120mg/100g</td></tr><tr><td>2</td><td>식품 B</td><td>80mg/100g</td></tr><tr><td>3</td><td>식품 C</td><td>40mg/100g</td></tr></tbody></table>`;
  const review=assertDirectSubmissionFocus(source(bodyHtml));
  assert.deepEqual(review.nutrientFoodRankingSections,[{heading:'풍부한 식품 TOP7과 각 식품의 평균 함유량은 얼마인가?',hasEstimatedRankingValue:false}]);
});
