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
    '<h2>2. 효능은 어디까지 확인됐을까?</h2><p>둘째 효능 답변입니다.</p>',
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
  assert.equal(review.observedCoreH2Count,6);
  assert.equal(review.axes.length,6);
  assert.equal(review.axes[0].firstAnswer,'첫째 답변입니다.');
  assert.equal(review.axes[1].heading,'2. 효능은 어디까지 확인됐을까?');
  assert.equal(review.axes[1].firstAnswer,'둘째 효능 답변입니다.');
  assert.equal(review.axes[2].heading,'3. 얼마나 먹을까?');
  assert.match(review.axes[1].readerQuestion,/핵심 효능/);
  assert.match(review.axes[1].reviewQuestion,/부정 설명을 첫 답변으로/);
  assert.match(review.axes[2].reviewQuestion,/⑤에서 다룰 독성·고용량 경고/);
  assert.match(review.axes[4].reviewQuestion,/독성·고용량·금기·응급 행동을 이 축에 집중/);
  assert.equal(review.balanceReview.status,'AUTHOR_REVIEW_REQUIRED');
  assert.equal(review.balanceReview.automatedSemanticVerdict,false);
  assert.equal(review.balanceReview.questions.length,5);
  assert.match(review.balanceReview.questions.join('\n'),/첫 인상/);
  assert.match(review.balanceReview.questions.join('\n'),/동일 의미/);
  assert.match(review.balanceReview.questions.join('\n'),/⑤에 집중/);
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
  assert.equal(result.report.foodAxisReview.axes[0].heading,'소개');
  assert.equal(result.report.foodAxisReview.axes[0].firstAnswer,'소개');
  assert.equal(result.report.foodAxisReview.balanceReview.questions.length,5);
  const evidenceQuestions=result.report.editorialReview.questions.join('\n');
  assert.match(evidenceQuestions,/정제 성분·추출물·오일·보충제·유사 종/);
  assert.match(evidenceQuestions,/항산화·항균·항염/);
  assert.match(evidenceQuestions,/전통 약재·민간 기록/);
  assert.match(evidenceQuestions,/종·부위·제형·용량/);
  assert.match(evidenceQuestions,/경고·부정 표현을 첫 인상/);
  assert.match(evidenceQuestions,/동일 의미를 반복하지 않았는가/);
  assert.match(evidenceQuestions,/⑤ 부작용·주의 대상에 집중/);
  assert.equal(result.report.editorialReview.automatedSemanticVerdict,false);

  const nonFoodResult=prepareDirectSource({...source,id:'direct-39-nonfood-review-test',category:'약학'});
  assert.equal('foodAxisReview' in nonFoodResult.report,false);
});