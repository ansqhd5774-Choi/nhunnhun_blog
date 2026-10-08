import test from 'node:test';
import assert from 'node:assert/strict';
import {applyEditorialTemplate} from '../publishing/editorial.mjs';
test('SP1 editorial design preserves layered emphasis and plain lists',()=>{
 const html=applyEditorialTemplate('<h2>소개</h2><p><mark><u><strong>핵심</strong></u></mark></p><h2>주의</h2><ul><li>목록</li></ul>',{version:'SP1'});
 assert.match(html,/1\. 소개/);assert.match(html,/2\. 주의/);
 assert.match(html,/font-size:24px/);assert.match(html,/background:#fff1a8/);
 assert.match(html,/text-underline-offset:3px/);
 assert.match(html,/<li[^>]*background:none;border:0/);
 assert.equal(html.replace(/<[^>]+>/g,''),'1. 소개핵심2. 주의목록');
});
