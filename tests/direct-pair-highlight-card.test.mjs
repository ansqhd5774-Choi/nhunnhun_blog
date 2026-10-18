import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseDocument} from 'htmlparser2';
import {renderDirectArticle} from '../publishing/direct-design.mjs';
import {directPublicExpectations,assertDirectPublicSnapshot} from '../publishing/direct-public-contract.mjs';

function all(root,pred){const out=[];const walk=node=>{if(pred(node))out.push(node);for(const child of node.children||[])walk(child)};walk(root);return out}
function cls(node,name){return node.type==='tag'&&String(node.attribs?.class||'').split(/\s+/).includes(name)}
function desc(node,tag){return all(node,n=>n.type==='tag'&&n.name===tag)}
function cards(html,kind){
 const doc=parseDocument(html);
 return all(doc,n=>cls(n,kind)).flatMap(group=>(group.children||[]).filter(n=>n.type==='tag'&&n.name==='article'));
}
test('highlight-leading list items render as complete semantic cards with mark INSIDE heading',()=>{
 const source='<h2>5. 함께 섭취하면 좋은 영양소와 주의할 상호작용</h2><ul>'+
 '<li><mark data-tone="positive"><strong>엽산+B12 · 혈액 생성</strong></mark> 엽산과 B12의 역할을 함께 확인합니다.</li>'+
 '<li><mark data-tone="caution"><strong>항경련제 · 상담 필요</strong></mark> 복용 중이면 확인합니다.</li></ul>';
 const output=renderDirectArticle(source),list=cards(output,'pairs');
 assert.equal(list.length,2);
 assert.ok(list.every(n=>desc(n,'h3').length===1&&desc(n,'p').length===1&&desc(n,'mark').length===1));
 assert.equal(all(parseDocument(output),n=>n.type==='tag'&&n.name==='li').length,0);
 const expected=directPublicExpectations(source);
 assert.equal(expected.pairsArticles,2);assert.equal(expected.pairsMarkedArticles,2);
 assert.throws(()=>assertDirectPublicSnapshot({...expected,pairsArticles:0,stylesVisible:true},source),/E_DIRECT_PUBLIC_PAIRSARTICLES/);
 assert.doesNotThrow(()=>assertDirectPublicSnapshot({...expected,stylesVisible:true},source));
});
test('unlabelled card item fails before submission; ordinary label-first cards still render',()=>{
 const good=renderDirectArticle('<h2>5. 함께 섭취하면 좋은 영양소</h2><ul><li><strong>기본 조합</strong> '+ '<mark data-tone="info"><strong>핵심 성분</strong></mark> 설명.</li></ul>');
 assert.equal(cards(good,'pairs').length,1);
 assert.throws(()=>renderDirectArticle('<h2>5. 함께 섭취하면 좋은 영양소</h2><ul><li>제목 없이 본문만 있음</li></ul>'),/E_DIRECT_CARD_ITEM_STRUCTURE/);
});
test('folate /124 preserves five highlighted pairing cards in actual renderer',()=>{
 const json=JSON.parse(readFileSync(new URL('../updates/direct-124-folate-r10-checklist-html-highlights-20261018.json',import.meta.url),'utf8'));
 const out=renderDirectArticle(json.bodyHtml);
 const group=cards(out,'pairs');
 assert.equal(group.length,5);
 assert.equal(group.filter(x=>desc(x,'mark').length>=1).length,5);
 assert.equal(directPublicExpectations(json.bodyHtml).pairsArticles,5);
 assert.equal(directPublicExpectations(json.bodyHtml).pairsMarkedArticles,5);
});

test('folate /124 R12 ⑤ left card titles are ONLY ingredient or drug names; right cards show marked effects',()=>{
 const r12=JSON.parse(readFileSync(new URL('../updates/direct-124-folate-r12-pair-role-alignment-20261018.json',import.meta.url),'utf8'));
 const r11=JSON.parse(readFileSync(new URL('../updates/direct-124-folate-r11-mark-card-render-fix-20261018.json',import.meta.url),'utf8'));
 const before=a=>a.split('<h2>5.')[0],after=a=>a.split('<h2>6.')[1];
 assert.equal(before(r12.bodyHtml),before(r11.bodyHtml),'all sections before ⑤ must remain unchanged');
 assert.equal(after(r12.bodyHtml),after(r11.bodyHtml),'all sections after ⑤ must remain unchanged');
 const rendered=renderDirectArticle(r12.bodyHtml),group=cards(rendered,'pairs');
 const expected=[
  ['비타민 B12',/적혈구 형성·호모시스테인 대사 보완/],
  ['철분',/빈혈·신경관결손 위험 감소/],
  ['메토트렉세이트',/치료 목적에 따라 처방 확인/],
  ['항경련제',/약물 상호작용 상담/],
  ['설파살라진',/엽산 흡수 감소 가능/]
 ];
 const content=node=>node.type==='text'?node.data:(node.children||[]).map(content).join('');
 assert.equal(group.length,5);
 for(let i=0;i<expected.length;i++){
  const h=desc(group[i],'h3'),p=desc(group[i],'p');
  assert.equal(h.length,1);assert.equal(p.length,1);
  assert.equal(content(h[0]),expected[i][0],`left card ${i+1} must be a short name`);
  assert.equal(desc(h[0],'mark').length,0,`left card ${i+1} must not contain effect highlight`);
  const marked=desc(p[0],'mark');
  assert.equal(marked.length,1,`right card ${i+1} must contain exactly one meaningful highlight`);
  assert.match(content(marked[0]),expected[i][1]);
  assert.ok(content(p[0]).length>content(marked[0]).length,`right card ${i+1} must include useful explanatory text`);
 }
});

test('quercetin /128 ⑤ maps ingredient or drug names at left to effects and cautions at right',()=>{
 const source=JSON.parse(readFileSync(new URL('../updates/direct-128-quercetin-r1-20261018.json',import.meta.url),'utf8'));
 const out=renderDirectArticle(source.bodyHtml),group=cards(out,'pairs');
 const expected=[
  ['비타민 C',/항산화 영양 보완/],
  ['브로멜라인',/효능과 알레르기 따로 확인/],
  ['와파린',/INR 상호작용 상담/],
  ['혈압약',/혈압 중복 저하/],
  ['일부 처방약',/CYP3A4·2C19/]
 ];
 const content=n=>n.type==='text'?n.data:(n.children||[]).map(content).join('');
 assert.equal(group.length,expected.length);
 for(let i=0;i<expected.length;i++){
  const h=desc(group[i],'h3'),p=desc(group[i],'p');
  assert.equal(h.length,1);assert.equal(p.length,1);
  assert.equal(content(h[0]),expected[i][0]);
  assert.equal(desc(h[0],'mark').length,0);
  assert.equal(desc(p[0],'mark').length,1);
  assert.match(content(desc(p[0],'mark')[0]),expected[i][1]);
 }
 assert.equal(directPublicExpectations(source.bodyHtml).pairsArticles,5);
 assert.equal(directPublicExpectations(source.bodyHtml).pairsMarkedArticles,5);
 assert.equal(out.split('<img ').length-1,3);
 assert.equal((out.match(/<table>/g)||[]).length,2);
});

test('phytosterol /140 source keeps left ingredient names and right effect highlights in five pairing cards',()=>{
 const source=JSON.parse(readFileSync(new URL('../updates/direct-140-phytosterol-r1-20261018.json',import.meta.url),'utf8'));
 const rendered=renderDirectArticle(source.bodyHtml);
 const group=cards(rendered,'pairs');
 const expected=[
  ['베타글루칸',/LDL 관리 보완/],
  ['불포화지방산',/식물성 기름·견과류 선택/],
  ['베타카로틴',/카로티노이드 섭취 보완/],
  ['스타틴계 약물',/처방 유지·의료진 상담/],
  ['에제티미브',/병용 여부 상담/]
 ];
 const content=n=>n.type==='text'?n.data:(n.children||[]).map(content).join('');
 assert.equal(group.length,expected.length);
 for(let i=0;i<expected.length;i++){
  const h=desc(group[i],'h3'),p=desc(group[i],'p');
  assert.equal(h.length,1);assert.equal(p.length,1);
  assert.equal(content(h[0]),expected[i][0]);
  assert.equal(desc(h[0],'mark').length,0);
  assert.equal(desc(p[0],'mark').length,1);
  assert.match(content(desc(p[0],'mark')[0]),expected[i][1]);
 }
 assert.equal(directPublicExpectations(source.bodyHtml).pairsArticles,5);
 assert.equal(directPublicExpectations(source.bodyHtml).pairsMarkedArticles,5);
 assert.equal(rendered.split('<img ').length-1,3);
 assert.equal((rendered.match(/<table>/g)||[]).length,2);
});

test('glucoside /143 ⑤ places only ingredient names left, effects and cautions in marked right cards',()=>{
 const source=JSON.parse(readFileSync(new URL('../updates/direct-143-glucoside-r1-20261018.json',import.meta.url),'utf8'));
 const out=renderDirectArticle(source.bodyHtml),group=cards(out,'pairs');
 const expected=[
  ['비타민 C',/항산화 영양 보완/],
  ['식이섬유',/섬유질 함께 섭취/],
  ['카페인',/제품별 확인/],
  ['혈당강하제',/시작 전 상담/]
 ];
 const textOf=n=>n.type==='text'?n.data:(n.children||[]).map(textOf).join('');
 assert.equal(group.length,4);
 for(let i=0;i<expected.length;i++){
  const h=desc(group[i],'h3'),p=desc(group[i],'p');
  assert.equal(h.length,1);assert.equal(p.length,1);
  assert.equal(textOf(h[0]),expected[i][0]);
  assert.equal(desc(h[0],'mark').length,0);
  assert.equal(desc(p[0],'mark').length,1);
  assert.match(textOf(desc(p[0],'mark')[0]),expected[i][1]);
 }
 assert.equal(directPublicExpectations(source.bodyHtml).pairsArticles,4);
 assert.equal(directPublicExpectations(source.bodyHtml).pairsMarkedArticles,4);
 assert.equal(out.split('<img ').length-1,3);
 assert.equal((out.match(/<table>/g)||[]).length,2);
});

test('glutathione /147 ⑤ left ingredients and right effects render as distinct meaningful highlighted cards',()=>{
 const source=JSON.parse(readFileSync(new URL('../updates/direct-147-glutathione-r1-20261018.json',import.meta.url),'utf8'));
 const html=renderDirectArticle(source.bodyHtml),group=cards(html,'pairs');
 const expected=[
  ['시스테인·글리신',/글루타치온 합성 원료/],
  ['비타민 C',/항산화 영양 보완/],
  ['셀레늄',/GSH 효소 활동 지원/],
  ['NAC',/복용약 상담/],
  ['항암제',/종양내과에 병용 확인/]
 ];
 const textOf=n=>n.type==='text'?n.data:(n.children||[]).map(textOf).join('');
 assert.equal(group.length,5);
 for(let i=0;i<expected.length;i++){
  const h=desc(group[i],'h3'),p=desc(group[i],'p');
  assert.equal(h.length,1);assert.equal(p.length,1);
  assert.equal(textOf(h[0]),expected[i][0]);
  assert.equal(desc(h[0],'mark').length,0);
  assert.equal(desc(p[0],'mark').length,1);
  assert.match(textOf(desc(p[0],'mark')[0]),expected[i][1]);
 }
 assert.equal(directPublicExpectations(source.bodyHtml).pairsArticles,5);
 assert.equal(directPublicExpectations(source.bodyHtml).pairsMarkedArticles,5);
 assert.equal(html.split('<img ').length-1,3);
 assert.equal((html.match(/<table>/g)||[]).length,2);
});
