import test from 'node:test';
import assert from 'node:assert/strict';
import {assertFoodBenefitBreadth,observeFoodBenefitBreadth} from '../publishing/food-benefit-breadth.mjs';
import {directPreflight} from '../publishing/direct-preflight.mjs';

const mark=text=>'<mark data-tone="positive"><strong>'+text+'</strong></mark>';
function food(changes,foodBenefitScopeReview){
  return {
    id:'direct-187-walnut-butter-test',articleId:'187',category:'음식',contentStandard:'SP1',
    title:'호두버터 칼로리·효능｜먹는 법·보관법',
    bodyHtml:[
      '<h2>1. 소개</h2><p>호두버터는 호두를 갈아 만든 스프레드입니다.</p>',
      '<h2>2. 영양소·핵심 성분</h2><p>식물성 지방과 단백질이 있습니다.</p>',
      '<h2>3. 꾸준 섭취 변화</h2><ul>',
      ...changes.map(value=>'<li><strong>신체 변화</strong> '+mark(value)+'</li>'),
      '</ul><h2>4. 궁합·시너지</h2><p>통밀빵과 함께 먹습니다.</p>',
      '<h2>5. 주의사항</h2><p>견과 알레르기 주의.</p>',
      '<h2>6. 고르는 법·보관법</h2><p>밀폐 냉장.</p>'
    ].join(''),
    ...(foodBenefitScopeReview?{foodBenefitScopeReview}:{})
  };
}

test('walnut butter regression: LDL, total cholesterol and triglycerides are ONE lipid domain',()=>{
  const source=food(['LDL 콜레스테롤 · 감소','총콜레스테롤 · 소폭 감소','중성지방 · 감소 경향']);
  assert.deepEqual(observeFoodBenefitBreadth(source).coveredDomains,['lipids']);
  assert.throws(()=>assertFoodBenefitBreadth(source),/E_DIRECT_FOOD_BENEFIT_BREADTH/);
});

test('different evidence-backed body domains produce breadth rather than three variants of one biomarker',()=>{
  const article=food(['LDL · 감소','포만감 · 간식량 관리','인지 기능 · 유지','장내 미생물 · 변화']);
  assert.equal(assertFoodBenefitBreadth(article).status,'DIVERSE');
  const withoutChanges=article.bodyHtml.replace('인지 기능 · 유지','콜레스테롤 · 감소')
    .replace('장내 미생물 · 변화','중성지방 · 변화');
  assert.throws(()=>assertFoodBenefitBreadth({...article,bodyHtml:withoutChanges}),/E_DIRECT_FOOD_BENEFIT_BREADTH/);
});

test('single-domain food needs evidence-screened exception with four DIFFERENT investigated domains',()=>{
  const domains=[
    {domain:'lipids',verdict:'included',reason:'인체 연구에서 혈중지질 변화가 반복 관찰됨',sourceUrl:'https://pubmed.ncbi.nlm.nih.gov/29931130/'},
    {domain:'cognition',verdict:'insufficient',reason:'해당 식품 형태에서 일관된 인지 개선 효과를 판단하기 어려움',sourceUrl:'https://pubmed.ncbi.nlm.nih.gov/29931130/'},
    {domain:'glycemic',verdict:'insufficient',reason:'사람 연구에서 이 제품 자체의 혈당 개선이 불명확함',sourceUrl:'https://pubmed.ncbi.nlm.nih.gov/29931130/'},
    {domain:'weight',verdict:'not_applicable',reason:'건강한 식단에서 식품 단독의 체중 감소를 일반화할 수 없음',sourceUrl:'https://pubmed.ncbi.nlm.nih.gov/29931130/'}
  ];
  const review={status:'EVIDENCE_SCREENED',scopeReason:'실제 조사에서는 다른 세 신체 영역에서 일관된 인체 개선 결과를 확인하지 못해 본문 효능에서 제외함',domains};
  assert.equal(assertFoodBenefitBreadth(food(['LDL 콜레스테롤 · 감소'],review)).status,'NARROW_SCOPE_DOCUMENTED');
  assert.throws(()=>assertFoodBenefitBreadth(food(['LDL 콜레스테롤 · 감소'],{...review,domains:domains.slice(0,3)})),/E_DIRECT_FOOD_BENEFIT_BREADTH/);
  assert.throws(()=>assertFoodBenefitBreadth(food(['LDL 콜레스테롤 · 감소'],{...review,domains:[domains[0],domains[0],...domains.slice(2)]})),/E_DIRECT_FOOD_BENEFIT_BREADTH/);
  assert.throws(()=>assertFoodBenefitBreadth(food(['LDL 콜레스테롤 · 감소'],{...review,domains:domains.map(x=>({...x,sourceUrl:'https://example.invalid/placeholder'}))})),/E_DIRECT_FOOD_BENEFIT_BREADTH/);
});

test('published headings in utility sections do not contribute benefit domains',()=>{
  const article=food(['LDL 콜레스테롤 · 감소','총콜레스테롤 · 감소','중성지방 · 감소']);
  article.bodyHtml+='<h2>자료 출처</h2><p>'+mark('뇌 건강 · 향상')+' '+mark('혈당 · 감소')+'</p>';
  assert.deepEqual(observeFoodBenefitBreadth(article).coveredDomains,['lipids']);
});

test('new food breadth gate appears in direct preflight report without silently claiming semantic verification',()=>{
  const result=directPreflight(food(['LDL 콜레스테롤 · 감소','총콜레스테롤 · 감소','중성지방 · 감소']));
  assert.equal(result.checks.foodBenefitBreadth,'E_DIRECT_FOOD_BENEFIT_BREADTH');
  assert.equal(result.automatedSemanticVerdict,false);
});

test('other categories, older non-standard sections and non-direct work are not subject to this check',()=>{
  assert.equal(assertFoodBenefitBreadth({...food(['LDL · 감소']),category:'영양소'}).status,'NOT_APPLICABLE');
  assert.equal(assertFoodBenefitBreadth({...food(['LDL · 감소']),bodyHtml:'<h2>1. 소개</h2><p>단일 단락</p>'}).status,'NOT_APPLICABLE');
});
