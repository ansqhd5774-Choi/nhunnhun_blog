import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareDirectSource} from '../authoring/prepare-direct-source.mjs';
import {pairingReview} from '../authoring/pairing-review.mjs';
import {buildFoodAxisReview} from '../authoring/food-axis-review.mjs';

test('preparation exposes actual pairing paragraphs for author review without automatic meaning PASS',()=>{
 const html='<h2>소개</h2><h2>성분</h2><h2>효과</h2><h2>궁합</h2><ul><li><strong>은행 + 달걀</strong> 단백질을 보완합니다.</li></ul><h2>주의</h2><ul><li>주의 행동</li></ul>';
 const review=pairingReview(html);
 assert.equal(review.heading,'궁합');
 assert.deepEqual(review.combinations,['은행 + 달걀 단백질을 보완합니다.']);
 assert.equal(review.assessment,'AUTHOR_REVIEW_REQUIRED');
 assert.equal(review.reviewQuestions.length,6);
 assert.equal(pairingReview('<h2>소개</h2>').combinations.length,0);
});

test('food-axis review uses the user-defined six food topics and reader-first questions',()=>{
  const source={bodyHtml:[
    '<h2>1. 소개</h2><p><img src="https://example.com/food.jpg" alt="음식"></p><p>첫째 답변입니다.</p>',
    '<h2>2. 영양소·핵심 성분</h2><p>둘째 답변입니다.</p>',
    '<h2>함께 보면 좋은 글</h2><p>보조 링크 설명입니다.</p>',
    '<h2>3. 꾸준 섭취 변화</h2><p>셋째 답변입니다.</p>',
    '<h2>4. 궁합·시너지</h2><p>넷째 답변입니다.</p>',
    '<h2>5. 주의사항</h2><p>다섯째 답변입니다.</p>',
    '<h2>6. 고르는 법·보관법</h2><p>여섯째 답변입니다.</p>',
    '<h2>핵심 정리</h2><p>보조 항목입니다.</p>'
  ].join('')};
  const review=buildFoodAxisReview(source);
  assert.equal(review.assessment,'AUTHOR_REVIEW_REQUIRED');
  assert.equal(review.automatedSemanticVerdict,false);
  assert.equal(review.scope,'FOOD_ONLY');
  assert.equal(review.ruleSource,'docs/project-instructions/PROJECT_INSTRUCTIONS_FOOD_R8.1.txt');
  assert.equal(review.qualityRuleSource,'docs/content/FOOD_CONTENT_QUALITY_R1.md');
  assert.equal(review.observedCoreH2Count,6);
  assert.deepEqual(review.axes.map(axis=>axis.expectedAxis),['소개','영양소·핵심 성분','꾸준 섭취 변화','궁합·시너지','주의사항','고르는 법·보관법']);
  assert.equal(review.axes[0].firstAnswer,'첫째 답변입니다.');
  assert.equal(review.axes[2].heading,'3. 꾸준 섭취 변화');
  assert.match(review.axes[0].readerQuestion,/맛·식감·종류·제철·산지/);
  assert.match(review.axes[1].readerQuestion,/영양소와 핵심 성분/);
  assert.match(review.axes[2].readerQuestion,/꾸준히 먹으면/);
  assert.match(review.axes[3].reviewQuestion,/무엇과 먹는지·왜 좋은지·어떻게 먹는지/);
  assert.match(review.axes[4].reviewQuestion,/행동을 바꿔야 하는 주의/);
  assert.match(review.axes[5].reviewQuestion,/신선도·구매 기준·제품 형태·보관/);
  assert.equal(review.balanceReview.questions.length,10);
  const balance=review.balanceReview.questions.join('\n');
  assert.match(balance,/사용자 확정 6개 소제목/);
  assert.match(balance,/부정·제한·반박 문장/);
  assert.match(balance,/확인해서 사용할 수 없는 내용은 생략/);
  assert.match(balance,/100mL→200mL/);
  assert.match(balance,/표의 각 행·열/);
  assert.match(balance,/실제 행동으로 옮길 수 있는 정보/);
  assert.doesNotMatch(balance,/연구 부족|근거 부족|미확인|일반화 불가|연구 설계|표본|근거 수준|직접 근거|간접 근거/);
});

test('food-axis review reports all core H2 even though only six axis slots are displayed',()=>{
  const source={bodyHtml:[
    '<h2>1. 소개</h2><p>첫 답변</p>',
    '<h2>2. 영양소·핵심 성분</h2><p>둘 답변</p>',
    '<h2>3. 꾸준 섭취 변화</h2><p>셋 답변</p>',
    '<h2>4. 궁합·시너지</h2><p>넷 답변</p>',
    '<h2>5. 주의사항</h2><p>다섯 답변</p>',
    '<h2>6. 고르는 법·보관법</h2><p>여섯 답변</p>',
    '<h2>7. 추가 핵심 질문</h2><p>일곱 답변</p>'
  ].join('')};
  const review=buildFoodAxisReview(source);
  assert.equal(review.observedCoreH2Count,7);
  assert.equal(review.axes.length,6);
  assert.equal(review.axes[5].heading,'6. 고르는 법·보관법');
});

test('food editorial review is reader-first and does not reintroduce research-centric prompts',()=>{
  const source={id:'direct-39-prepare-test',articleId:'39',targetUrl:'https://nhunnhun.tistory.com/39',expectedCurrentTitle:'껌',title:'껌',category:'음식',contentStandard:'SP1',status:'ready',approved:true,representativeImageUrl:'https://example.com/gum.jpg',bodyHtml:'<p><img src="https://example.com/gum.jpg" alt="껌"></p><h2>소개</h2><p>소개</p><h2>영양소·핵심 성분</h2><p>성분</p><h2>꾸준 섭취 변화</h2><ul><li><strong>조건</strong><mark><u><strong>중요한 행동</strong></u></mark></li></ul>'};
  const before=JSON.stringify(source);
  const result=prepareDirectSource(source);
  assert.equal(JSON.stringify(source),before);
  assert.match(result.preview,/<div class="effects">/);
  assert.match(result.preview,/\.nh-direct-v2 \.effects\{[^}]*border:1px/);
  assert.match(result.preview,/<mark><u><strong>중요한 행동<\/strong><\/u><\/mark>/);
  assert.equal(result.report.sections[3].level3,1);
  assert.equal(result.report.foodAxisReview.scope,'FOOD_ONLY');
  assert.equal(result.report.editorialReview.scope,'FOOD_ONLY');
  const questions=result.report.editorialReview.questions.join('\n');
  assert.match(questions,/사용자 확정 6개 소제목/);
  assert.match(questions,/일반 독자/);
  assert.match(questions,/특징·영양·장점·활용·선택·섭취·보관/);
  assert.match(questions,/확인해서 사용할 수 없는 내용은 생략/);
  assert.match(questions,/소개/);
  assert.match(questions,/영양소·핵심 성분/);
  assert.match(questions,/꾸준 섭취 변화/);
  assert.match(questions,/궁합·시너지/);
  assert.match(questions,/주의사항/);
  assert.match(questions,/고르는 법·보관법/);
  assert.doesNotMatch(questions,/연구 부족|근거 부족|미확인|일반화 불가|연구 설계|표본|근거 수준|직접 근거|간접 근거|제품 형태 선택|복용법|표준 치료|주요 의약품|TOP7|nhunnhun_nutrients/);
  assert.equal(result.report.editorialReview.automatedSemanticVerdict,false);

  const nonFoodResult=prepareDirectSource({...source,id:'direct-39-nonfood-review-test',category:'약학'});
  assert.equal('foodAxisReview' in nonFoodResult.report,false);
  assert.equal('scope' in nonFoodResult.report.editorialReview,false);
  assert.equal('qualityRuleSource' in nonFoodResult.report.editorialReview,false);
});
