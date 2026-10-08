import test from 'node:test';
import assert from 'node:assert/strict';
import {applyFoodDesign} from '../authoring/food-design.mjs';

test('design preserves prose and metadata without inventing a benefit highlight',()=>{
  const html='<h2>주의</h2><p>혈압 개선 효과가 있습니다.</p><p>과다 섭취는 주의해야 합니다.</p><p>하루 20g입니다.</p><a href="https://example.org/20g">원문</a>';
  const out=applyFoodDesign(html);
  const plain=value=>value.replace(/<[^>]*>/g,'');
  assert.equal(plain(out),plain(html));
  assert.ok(out.includes('<u>과다 섭취는 주의해야 합니다.</u>'));
  assert.ok(!out.includes('<u>혈압'));
  assert.ok(out.includes('href="https://example.org/20g"'));
  assert.ok(out.includes('<strong>20g</strong>'));
});
test('a second design pass does not duplicate emphasis or list structure',()=>{
  const html='<h2>보관</h2><p>1. 보관 온도: 5℃입니다.</p><p>2. 확인: 상태를 확인하세요.</p>';
  const out=applyFoodDesign(html);
  assert.equal(applyFoodDesign(out),out);
  assert.equal((out.match(/<ol>/g)||[]).length,1);
  assert.equal((out.match(/<li>/g)||[]).length,2);
});
test('existing emphasis and decimal numbers are preserved',()=>{
  const html='<p><strong>20g</strong>과 <u>짧은 강조</u>를 확인합니다. 1.2g입니다.</p>';
  const out=applyFoodDesign(html);
  assert.ok(out.includes('<strong>20g</strong>'));
  assert.ok(out.includes('<u>짧은 강조</u>'));
  assert.ok(out.includes('<strong>1.2g</strong>'));
  assert.ok(!out.includes('<ol>'));
});
