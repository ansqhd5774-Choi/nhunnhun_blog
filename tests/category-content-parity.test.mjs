import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareDirectSource} from '../authoring/prepare-direct-source.mjs';
const headings={
 음식:['소개','영양소·핵심 성분','꾸준 섭취 변화','궁합·시너지','주의사항','고르는 법·보관법'],
 영양소:['정의·주요 성분·작용','효능·기대 변화·권장 대상·제품 형태 선택','실제 섭취량·복용법·기간·대표 제품','풍부한 식품 TOP7·평균 함량','함께 섭취할 영양소·보충제 조합','결핍·과다 섭취'],
 약학:['개발 목적·주요 성분·작용','주요 적응증·기본 복용법','효과를 높이는 보조제·주의점','위험한 약물·음식 병용','안전 복용·부작용·모니터링','대체 약품 비교·선택'],
 질병:['정의·발병 기전','주요 원인·고위험군','진단 방법·핵심 검사','예방·도움되는 음식 5가지','표준 치료·주요 의약품 3가지','재발 예방·생활습관 5가지·추적 관찰']
};
const base={id:'direct-category-parity-test',articleId:'39',targetUrl:'https://nhunnhun.tistory.com/39',expectedCurrentTitle:'기존 제목',title:'분야별 안내',contentStandard:'SP1',status:'ready',approved:true,representativeImageUrl:'https://example.com/reference.jpg'};
const sectionChunk=(preview,n)=>(preview.split(`<h2 id="direct-section-${n}"`)[1]??'').split('<h2 id="direct-section-')[0];
let baseline;
for(const [category,titles] of Object.entries(headings))test(`${category}: 같은 렌더·강조 계약을 유지하고 분야별 6개 질문과 검토 위치를 적용`,()=>{
 const bodyHtml='<p><img src="https://example.com/reference.jpg" alt="주제 사진"></p>'+titles.map(h=>`<h2>${h}</h2><ul><li><strong>핵심 정보</strong><mark><strong>주요 조건</strong></mark> <mark><u><strong>실천 행동</strong></u></mark></li></ul>`).join('');
 const source={...base,category,bodyHtml};const original=JSON.stringify(source);const prepared=prepareDirectSource(source);
 assert.equal(JSON.stringify(source),original);
 for(const cls of ['effects','pairs','cautions','storage'])assert.ok(prepared.preview.includes(`class="${cls}"`));
 const pairingIndex=category==='영양소'?4:3;
 assert.equal(prepared.report.pairingReview.heading,titles[pairingIndex]);
 assert.equal(prepared.report.pairingReview.targetSection,pairingIndex+1);
 assert.equal(prepared.report.pairingReview.reviewQuestions.length,6);
 assert.equal(prepared.report.editorialReview.automatedSemanticVerdict,false);
 if(category==='음식'){
   assert.equal(prepared.report.editorialReview.scope,'FOOD_ONLY');
   assert.equal(prepared.report.editorialReview.ruleSource,'docs/project-instructions/PROJECT_INSTRUCTIONS_FOOD_R8.1.txt');
   const q=prepared.report.editorialReview.questions.join(' ');
   assert.match(q,/음식 전용 지침/);
   assert.match(q,/소개/);
   assert.match(q,/영양소·핵심 성분/);
   assert.match(q,/꾸준 섭취 변화/);
   assert.match(q,/궁합·시너지/);
   assert.match(q,/주의사항/);
   assert.match(q,/고르는 법·보관법/);
   assert.doesNotMatch(q,/정의·주요 성분·작용|핵심 효능·예방 효과|섭취법·권장량|궁합·상호작용|부작용·주의 대상|신선도·보관·조리 팁|제품 형태 선택|복용법|표준 치료|주요 의약품|TOP7|nhunnhun_nutrients/);
 }
 if(category==='약학')assert.match(prepared.report.pairingReview.reviewQuestions.join(' '),/허가사항/);
 if(category==='질병')assert.match(prepared.report.pairingReview.reviewQuestions.join(' '),/표준 치료/);
 if(category==='영양소'){
   const q=prepared.report.pairingReview.reviewQuestions.join(' ');
   assert.match(q,/영양소\/기능성 성분/);
   assert.match(q,/상한/);
   assert.match(q,/복용 시점/);
   assert.doesNotMatch(sectionChunk(prepared.preview,4),/class="pairs"/);
   assert.match(sectionChunk(prepared.preview,5),/class="pairs"/);
   assert.match(sectionChunk(prepared.preview,3),/class="storage"/);
   assert.match(sectionChunk(prepared.preview,6),/class="cautions"/);
 }
 const css=prepared.preview.match(/<style>([\s\S]*?)<\/style>/)[1];if(baseline)assert.equal(css,baseline);else baseline=css;
 assert.equal((prepared.preview.match(/<mark><u><strong>실천 행동/g)||[]).length,6);
});
test('주요 음식 작성 진입 문서는 음식 편집 기준을 외부 저장소에 위임하지 않는다',async()=>{
 for(const f of ['AGENTS.md','docs/GENERAL_CHAT_EXECUTION.md','docs/content/DIRECT_AUTHORING_R1.md','docs/content/DIRECT_AUTHORING_CONTRACT_20261012.md']){
   const text=await readFile(f,'utf8');
   assert.match(text,/PROJECT_INSTRUCTIONS_FOOD_R8\.1\.txt/);
   assert.doesNotMatch(text,/ansqhd5774-Choi\/nhunnhun_nutrients/);
 }
});
test('주요 작성 진입 문서는 동일 공통 계약을 참조한다',async()=>{
 for(const f of ['AGENTS.md','docs/GENERAL_CHAT_EXECUTION.md','docs/CONTENT_STANDARD_R1.md','docs/CONTENT_WRITER_PROMPT_R1.md','docs/content/DIRECT_AUTHORING_R1.md','docs/content/DOMAIN_GUIDES_R1.md'])assert.match(await readFile(f,'utf8'),/CATEGORY_CONTENT_PARITY\.md/);
});
