import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareDirectSource} from '../authoring/prepare-direct-source.mjs';

test('one local preparation uses publishing layout and retains author-selected emphasis',()=>{
  const source={id:'direct-39-prepare-test',articleId:'39',targetUrl:'https://nhunnhun.tistory.com/39',expectedCurrentTitle:'껌',title:'껌',category:'음식',contentStandard:'SP1',status:'ready',approved:true,representativeImageUrl:'https://example.com/gum.jpg',bodyHtml:'<p><img src="https://example.com/gum.jpg" alt="껌"></p><h2>소개</h2><p>소개</p><h2>성분</h2><p>성분</p><h2>효과</h2><ul><li><strong>조건</strong><mark><u><strong>중요한 행동</strong></u></mark></li></ul>'};
  const before=JSON.stringify(source);
  const result=prepareDirectSource(source);
  assert.equal(JSON.stringify(source),before);
  assert.match(result.preview,/<div class="effects">/);
  assert.match(result.preview,/\.nh-direct-v2 \.effects\{[^}]*border:1px/);
  assert.match(result.preview,/<mark><u><strong>중요한 행동<\/strong><\/u><\/mark>/);
  assert.equal(result.report.sections[3].level3,1);
  assert.equal(result.report.sourceId,source.id);
});
