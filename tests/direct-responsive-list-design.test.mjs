import test from 'node:test';
import assert from 'node:assert/strict';
import {renderDirectArticle} from '../publishing/direct-design.mjs';

test('approved effect list renders semantic vertical cards with responsive desktop tablet mobile CSS',()=>{
  const html='<h2>2. 한 달 복용 후 기대되는 신체 변화와 권장 대상은 누구인가?</h2><ul><li><strong>포만감</strong>식사 사이 허기 관리에 도움</li><li><strong>유당 소화</strong>우유보다 편하게 느껴질 수 있음</li></ul>';
  const out=renderDirectArticle(html);
  assert.match(out,/class="effects"/);
  assert.match(out,/grid-template-columns:120px minmax\(0,1fr\)/);
  assert.match(out,/@media\(max-width:900px\)/);
  assert.match(out,/grid-template-columns:105px minmax\(0,1fr\)/);
  assert.match(out,/@media\(max-width:600px\)/);
  assert.match(out,/grid-template-columns:1fr/);
  assert.match(out,/border-left:4px solid #6fa47b/);
  assert.match(out,/border-radius:999px/);
  assert.match(out,/>포만감<\/h3>/);
  assert.match(out,/>유당 소화<\/h3>/);
});

test('approved pair list uses the same readable responsive list system without rewriting source text',()=>{
  const html='<h2>5. 함께 섭취하면 좋은 영양소와 주의할 상호작용은 무엇인가?</h2><ul><li><strong>비타민 C</strong>같은 식사에 곁들입니다.</li><li><strong>비타민 K</strong>섭취량 변화에 주의합니다.</li></ul>';
  const out=renderDirectArticle(html);
  assert.match(out,/class="pairs"/);
  assert.match(out,/>비타민 C<\/h3><p>같은 식사에 곁들입니다.<\/p>/);
  assert.match(out,/>비타민 K<\/h3><p>섭취량 변화에 주의합니다.<\/p>/);
});
