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

test('food-axis review exposes six reader-question, H2 and first-answer pairs plus value-first balance questions without semantic auto-pass',()=>{
  const source={bodyHtml:[
    '<h2>1. 음식은 무엇일까?</h2><p><img src="https://example.com/food.jpg" alt="음식"></p><p>첫째 답변입니다.</p>',
    '<h2>2. 효능은 무엇일까?</h2><p>둘째 효능 답변입니다.</p>',
    '<h2>함께 보면 좋은 글</h2><p>보조 링크 설명입니다.</p>',
    '<h2>3. 얼마나 먹을까?</h2><p>셋째 섭취 답변입니다.</p>',
    '<h2>4. 무엇과 먹을까?</h2><p>넷째 궁합 답변입니다.</p>',
    '<h2>5. 부작용은?</h2><p>다섯째 주의 답변입니다.</p>',
    '<h2>6. 어떻게 고르고 보관할까?</h2><p>여섯째 보관 답변입니다.</p>',
    '<h2>핵심 정리</h2><p>보조 항목입니다.</p>'
  ].join('')};
  const review=buildFoodAxisReview(source);
  assert.equal(review.assessment,'AUTHOR_REVIEW_REQUIRED');
  assert.equal(review.automatedSemanticVerdict,false);
  assert.equal(review.scope,'FOOD_ONLY');
  assert.equal(review.ruleSource,'docs/project-instructions/PROJECT_INSTRUCTIONS_FOOD_R8.1.txt');
  assert.equal(review.observedCoreH2Count,6);
  assert.equal(review.axes.length,6);
  assert.equal(review.axes[0].firstAnswer,'첫째 답변입니다.');
  assert.match(review.axes[0].readerQuestion,/일반 영양표 외에/);
  assert.match(review.axes[0].reviewQuestion,/일반 열량·비타민·무기질 표에 묻히게/);
  assert.equal(review.axes[1].heading,'2. 효능은 무엇일까?');
  assert.equal(review.axes[1].firstAnswer,'둘째 효능 답변입니다.');
  assert.equal(review.axes[2].heading,'3. 얼마나 먹을까?');
  assert.match(review.axes[1].readerQuestion,/핵심 건강상 장점/);
  assert.match(review.axes[1].readerQuestion,/일상 식사/);
  assert.match(review.axes[1].reviewQuestion,/건강상 장점·몸에서 하는 역할·실제 식사 활용/);
  assert.match(review.axes[1].reviewQuestion,/연구 설계·근거 수준·한계 설명이 소제목이나 문단의 중심/);
  assert.match(review.axes[2].reviewQuestion,/⑤에서 다룰 독성·고용량 경고/);
  assert.match(review.axes[4].reviewQuestion,/독성·고용량·금기·응급 행동을 이 축에 집중/);
  assert.equal(review.balanceReview.status,'AUTHOR_REVIEW_REQUIRED');
  assert.equal(review.balanceReview.automatedSemanticVerdict,false);
  assert.equal(review.balanceReview.scope,'FOOD_ONLY');
  assert.equal(review.balanceReview.ruleSource,'docs/project-instructions/PROJECT_INSTRUCTIONS_FOOD_R8.1.txt');
  assert.equal(review.balanceReview.questions.length,5);
  const balanceQuestions=review.balanceReview.questions.join('\n');
  assert.match(balanceQuestions,/첫 인상/);
  assert.match(balanceQuestions,/건강상 장점·몸에서 하는 역할·실제 식사 활용/);
  assert.match(balanceQuestions,/연구 설계·표본·근거 수준·미확인/);
  assert.match(balanceQuestions,/⑤에 집중/);
  assert.match(balanceQuestions,/각 H2의 직접 답/);
  assert.match(balanceQuestions,/연구 한계나 반박 문구를 강조 개수 충족용/);
});

test('food-axis review reports all core H2 even though only six axis slots are displayed',()=>{
  const source={bodyHtml:[
    '<h2>1. 소개</h2><p>첫 답변</p>',
    '<h2>2. 효능</h2><p>둘 답변</p>',
    '<h2>3. 섭취</h2><p>셋 답변</p>',
    '<h2>4. 궁합</h2><p>넷 답변</p>',
    '<h2>5. 주의</h2><p>다섯 답변</p>',
    '<h2>6. 보관</h2><p>여섯 답변</p>',
    '<h2>7. 추가 핵심 질문</h2><p>일곱 답변</p>'
  ].join('')};
  const review=buildFoodAxisReview(source);
  assert.equal(review.observedCoreH2Count,7);
  assert.equal(review.axes.length,6);
  assert.equal(review.axes[5].heading,'6. 보관');
});

test('one local preparation uses publishing layout and retains author-selected emphasis',()=>{
  const source={id:'direct-39-prepare-test',articleId:'39',targetUrl:'https://nhunnhun.tistory.com/39',expectedCurrentTitle:'껌',title:'껌',category:'음식',contentStandard:'SP1',status:'ready',approved:true,representativeImageUrl:'https://example.com/gum.jpg',bodyHtml:'<p><img src="https://example.com/gum.jpg" alt="껌"></p><h2>소개</h2><p>소개</p><h2>성분</h2><p>성분</p><h2>효과</h2><ul><li><strong>조건</strong><mark><u><strong>중요한 행동</strong></u></mark></li></ul>'};
  const before=JSON.stringify(source);
  const result=prepareDirectSource(source);
  assert.equal(JSON.stringify(source),before);
  assert.match(result.preview,/<div class="effects">/);
  assert.match(result.preview,/\.nh-direct-v2 \.effects\{[^}]*border:1px/);
  assert.match(result.preview,/<mark><u><strong>중요한 행동<\/strong><\/u><\/mark>/);
  assert.equal(result.report.sections[3].level3,1);
  assert.equal(result.report.sourceId,source.id);
  assert.equal(result.report.foodAxisReview.automatedSemanticVerdict,false);
  assert.equal(result.report.foodAxisReview.scope,'FOOD_ONLY');
  assert.equal(result.report.foodAxisReview.ruleSource,'docs/project-instructions/PROJECT_INSTRUCTIONS_FOOD_R8.1.txt');
  assert.equal(result.report.foodAxisReview.axes[0].heading,'소개');
  assert.equal(result.report.foodAxisReview.axes[0].firstAnswer,'소개');
  assert.equal(result.report.foodAxisReview.balanceReview.questions.length,5);
  assert.equal(result.report.editorialReview.scope,'FOOD_ONLY');
  assert.equal(result.report.editorialReview.ruleSource,'docs/project-instructions/PROJECT_INSTRUCTIONS_FOOD_R8.1.txt');
  const evidenceQuestions=result.report.editorialReview.questions.join('\n');
  assert.match(evidenceQuestions,/이 저장소의 음식 전용 지침만 사용/);
  assert.match(evidenceQuestions,/정의·주요 성분·작용/);
  assert.match(evidenceQuestions,/핵심 효능·예방 효과/);
  assert.match(evidenceQuestions,/섭취법·권장량/);
  assert.match(evidenceQuestions,/궁합·상호작용/);
  assert.match(evidenceQuestions,/부작용·주의 대상/);
  assert.match(evidenceQuestions,/신선도·보관·조리 팁/);
  assert.match(evidenceQuestions,/건강상 장점·몸에서 하는 역할·실제 식사 활용/);
  assert.match(evidenceQuestions,/연구 설계·표본·근거 수준.*소제목이나 본문의 중심/);
  assert.match(evidenceQuestions,/각 H2의 직접 답과 확인된 건강·영양·안전·섭취 가치/);
  assert.doesNotMatch(evidenceQuestions,/제품 형태 선택|복용법|표준 치료|주요 의약품|TOP7|nhunnhun_nutrients/);
  assert.equal(result.report.editorialReview.automatedSemanticVerdict,false);

  const nonFoodResult=prepareDirectSource({...source,id:'direct-39-nonfood-review-test',category:'약학'});
  assert.equal('foodAxisReview' in nonFoodResult.report,false);
  assert.equal('scope' in nonFoodResult.report.editorialReview,false);
});
