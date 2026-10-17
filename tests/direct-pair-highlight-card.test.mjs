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
