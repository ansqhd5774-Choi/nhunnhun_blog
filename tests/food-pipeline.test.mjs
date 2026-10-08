import test from 'node:test';
import assert from 'node:assert/strict';
import {applyChosenEmphasis} from '../authoring/food-emphasis.mjs';
import {renderFoodMarkdown} from '../authoring/queue-food-sections.mjs';
import {collectSectionImages} from '../authoring/queue-images.mjs';
test('importance levels preserve text and accumulate independent effects',()=>{
  const html=applyChosenEmphasis('<p>감자</p><p>제철</p><p>보관</p>',[{text:'감자',level:1},{text:'제철',level:2},{text:'보관',level:3}]);
  assert.ok(html.includes('<strong>감자</strong>'));
  assert.ok(html.includes('<mark><strong>제철</strong></mark>'));
  assert.ok(html.includes('<mark><u><strong>보관</strong></u></mark>'));
  assert.equal(html.replace(/<[^>]+>/g,''),'감자제철보관');
});
test('numbered lines are distinct list entries',()=>{
  const html=renderFoodMarkdown('1. 첫 항목\n2. 두 번째 항목');
  assert.equal((html.match(/<li>/g)||[]).length,2);
  assert.ok(!html.includes('첫 항목 2.'));
});
test('missing representative image stops before publication after bounded search',async()=>{
  let searches=0;
  const fetcher=async url=>String(url).includes('/api/chat')?{ok:true,json:async()=>({message:{content:'{"queries":[""]}'}})}:(searches++,{ok:true,json:async()=>({})});
  await assert.rejects(collectSectionImages({keyword:'감자',articleId:'179'},{sections:[{heading:'소개',markdown:'감자'}]},{subject:'potato',fetcher}),/E_IMAGE_REPRESENTATIVE_REQUIRED/);
  assert.equal(searches,2);
});
