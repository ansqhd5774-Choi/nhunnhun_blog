import test from 'node:test';
import assert from 'node:assert/strict';
import {renderDirectArticle} from '../publishing/direct-design.mjs';

test('effect list uses one-column target cards on every viewport',()=>{
  const html='<h2>2. 한 달 복용 후 기대되는 신체 변화와 권장 대상은 누구인가?</h2><ul><li><strong>포화지방 섭취가 많은 사람</strong>버터·라드 일부를 식물성 기름으로 바꿉니다.</li><li><strong>지방 섭취를 지나치게 제한하는 사람</strong>식물성 기름·견과류·씨앗류를 식사에 포함합니다.</li></ul>';
  const out=renderDirectArticle(html);
  assert.match(out,/class="effects"/);
  assert.match(out,/\.nh-direct-v2 \.effects article\{grid-template-columns:1fr!important;row-gap:6px!important\}/);
  assert.match(out,/\.nh-direct-v2 \.effects article h3\{grid-column:1!important;grid-row:1!important;font-size:18px!important/);
  assert.match(out,/\.nh-direct-v2 \.effects article p\{grid-column:1!important;grid-row:2!important/);
  assert.match(out,/overflow-wrap:anywhere!important/);
  assert.match(out,/border-left:4px solid #6c92b7/);
  assert.match(out,/font-family:system-ui,-apple-system,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif!important/);
  assert.match(out,/>포화지방 섭취가 많은 사람<\/h3><p>버터·라드 일부를 식물성 기름으로 바꿉니다.<\/p>/);
});

test('pair list keeps desktop two-column layout and collapses to one column on mobile',()=>{
  const html='<h2>5. 함께 섭취하면 좋은 영양소와 주의할 상호작용은 무엇인가?</h2><ul><li><strong>비타민 C</strong>같은 식사에 곁들입니다.</li><li><strong>비타민 K</strong>섭취량 변화에 주의합니다.</li></ul>';
  const out=renderDirectArticle(html);
  assert.match(out,/class="pairs"/);
  assert.match(out,/\.nh-direct-v2 \.pairs article\{grid-template-columns:170px minmax\(0,1fr\)!important/);
  assert.match(out,/@media\(max-width:900px\).*?\.nh-direct-v2 \.pairs article\{grid-template-columns:150px minmax\(0,1fr\)!important/s);
  assert.match(out,/@media\(max-width:600px\).*?:is\(\.effects,\.pairs\) article\{grid-template-columns:1fr!important/s);
  assert.match(out,/\.nh-direct-v2 \.pairs article a,\.nh-direct-v2 \.pairs article mark,\.nh-direct-v2 \.pairs article strong\{min-width:0!important;max-width:100%!important;overflow-wrap:anywhere!important\}/);
  assert.match(out,/>비타민 C<\/h3><p>같은 식사에 곁들입니다.<\/p>/);
  assert.match(out,/>비타민 K<\/h3><p>섭취량 변화에 주의합니다.<\/p>/);
});
