import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareDirectSource} from '../authoring/prepare-direct-source.mjs';
const headings={음식:['음식 소개','영양성분','영양 작용','음식 궁합','섭취 주의','선택과 보관'],영양소:['성분 소개','함유 식품과 섭취 기준','생리 기능','성분 보완과 흡수','과량과 상호작용','선택과 섭취 방법'],약학:['제품 소개','유효성분과 허가 효능','기대 효과','식사와 복용 관계','금기와 이상반응','용법과 보관'],질병:['질환 소개','증상과 원인','진단과 치료','생활 관리','응급 신호','경과 관찰']};
const base={id:'direct-category-parity-test',articleId:'39',targetUrl:'https://nhunnhun.tistory.com/39',expectedCurrentTitle:'기존 제목',title:'분야별 안내',contentStandard:'SP1',status:'ready',approved:true,representativeImageUrl:'https://example.com/reference.jpg'};
let baseline;
for(const [category,titles] of Object.entries(headings))test(`${category}: 같은 렌더·강조 계약을 유지하고 분야별 내용과 검토 질문만 교체`,()=>{
 const bodyHtml='<p><img src="https://example.com/reference.jpg" alt="주제 사진"></p>'+titles.map(h=>`<h2>${h}</h2><ul><li><strong>핵심 정보</strong><mark><strong>주요 조건</strong></mark> <mark><u><strong>실천 행동</strong></u></mark></li></ul>`).join('');
 const source={...base,category,bodyHtml};const original=JSON.stringify(source);const prepared=prepareDirectSource(source);
 assert.equal(JSON.stringify(source),original);
 for(const cls of ['effects','pairs','cautions','storage'])assert.ok(prepared.preview.includes(`class="${cls}"`));
 assert.equal(prepared.report.pairingReview.heading,titles[3]);assert.equal(prepared.report.pairingReview.reviewQuestions.length,4);
 assert.equal(prepared.report.editorialReview.automatedSemanticVerdict,false);
 if(category==='약학')assert.match(prepared.report.pairingReview.reviewQuestions.join(' '),/허가사항/);
 if(category==='질병')assert.match(prepared.report.pairingReview.reviewQuestions.join(' '),/표준 치료/);
 if(category==='영양소')assert.match(prepared.report.pairingReview.reviewQuestions.join(' '),/상한/);
 const css=prepared.preview.match(/<style>([\s\S]*?)<\/style>/)[1];if(baseline)assert.equal(css,baseline);else baseline=css;
 assert.equal((prepared.preview.match(/<mark><u><strong>실천 행동/g)||[]).length,6);
});
test('주요 작성 진입 문서는 동일 공통 계약을 참조한다',async()=>{
 for(const f of ['AGENTS.md','docs/GENERAL_CHAT_EXECUTION.md','docs/CONTENT_STANDARD_R1.md','docs/CONTENT_WRITER_PROMPT_R1.md','docs/content/DIRECT_AUTHORING_R1.md','docs/content/DOMAIN_GUIDES_R1.md'])assert.match(await readFile(f,'utf8'),/CATEGORY_CONTENT_PARITY\.md/);
});
