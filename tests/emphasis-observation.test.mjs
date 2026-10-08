import test from 'node:test';
import assert from 'node:assert/strict';
import {observeEmphasis} from '../authoring/emphasis-summary.mjs';

test('observes missing nesting by section without modifying the source',()=>{
  const html='<p><strong>소개</strong></p><h2>영양</h2><p><mark>단독 형광펜</mark></p><h2>주의</h2><p><mark><u><strong>중요 조건</strong></u></mark></p>';
  const result=observeEmphasis(html);
  assert.equal(result.sections[0].bold,1);
  assert.deepEqual(result.sections[1].standaloneHighlights,['단독 형광펜']);
  assert.equal(result.sections[1].level2,0);
  assert.equal(result.sections[2].level3,1);
  assert.equal(result.sections[2].level2,0);
});
test('handles whitespace and inline links in highlighted phrases',()=>{
  const result=observeEmphasis('<h2>효과</h2><mark> <a href="/64"><strong>효과와 조건</strong></a></mark>');
  assert.equal(result.sections[1].level2,1);
  assert.deepEqual(result.sections[1].standaloneHighlights,[]);
});
