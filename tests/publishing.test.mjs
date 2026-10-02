import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { checkPost, checkPublishHtml, eligible, fingerprint, assertArticleUrl, plainText } from '../publishing/core.mjs';
import { applyEditorialTemplate } from '../publishing/editorial.mjs';
const base = {id:'first-post',title:'첫 글',category:'음식',tags:['음식'],bodyHtml:'<h2>제목</h2><p>내용입니다.</p>',status:'draft',approved:false};
test('draft posts never publish', () => assert.equal(eligible(base,null),false));
test('unapproved ready posts are rejected', () => assert.throws(() => checkPost({...base,status:'ready'},'first-post.json')));
test('approved ready post accepted', () => assert.equal(eligible(checkPublishHtml(checkPost({...base,status:'ready',approved:true},'first-post.json')),null),true));
test('same publication is skipped', () => assert.equal(eligible({...base,status:'ready',approved:true},{phase:'published',fingerprint:fingerprint(base)}),false));
test('uncertain final click never retries', () => assert.throws(() => eligible({...base,status:'ready',approved:true},{phase:'submitting',fingerprint:fingerprint(base)})));
test('changed published content never creates another article', () => assert.equal(eligible({...base,status:'ready',approved:true,bodyHtml:'<p>변경</p>'},{phase:'published',fingerprint:fingerprint(base)}),false));
test('arbitrary fields and path injection are rejected', () => {
  assert.throws(() => checkPost({...base,id:'../bad'},'../bad.json'));
  assert.throws(() => checkPost({...base,blog:'https://other.tistory.com'},'first-post.json'));
});
test('executable HTML and invalid URL schemes rejected', () => {
  for (const bodyHtml of ['<script>alert(1)</script>','<p onclick="x()">내용</p>','<a href="javascript:alert(1)">내용</a>','<img src="http://host/image.png" />','<p>{{남은문구}}</p>']) assert.throws(() => checkPost({...base,bodyHtml},'first-post.json'));
});
test('HTTPS references and Unicode content preserved', () => assert.equal(checkPost({...base,bodyHtml:'<p>영양 100g <a href="https://example.org/">출처</a></p>'},'first-post.json').title,'첫 글'));
test('rich archival HTML is allowed by schema but rejected for new publication', () => {
  const rich=checkPost({...base,bodyHtml:'<p style="color:red">내용</p>'},'first-post.json');
  assert.throws(() => checkPublishHtml(rich));
});
test('post hash changes with category tags title and body', () => {
  for (const delta of [{category:'영양소'},{tags:['건강']},{title:'새 글'},{bodyHtml:'<p>수정</p>'}]) assert.notEqual(fingerprint(base),fingerprint({...base,...delta}));
});
test('only numeric article URLs on the authorized blog accepted', () => {
  assert.equal(assertArticleUrl('https://nhunnhun.tistory.com/355'),'https://nhunnhun.tistory.com/355');
  for (const url of ['https://other.tistory.com/355','https://nhunnhun.tistory.com/manage','https://nhunnhun.tistory.com/355?token=x']) assert.throws(() => assertArticleUrl(url));
});
test('block text remains separated for runtime content verification', () => assert.equal(plainText('<h2>제목</h2><p>첫 단락</p><p>다음 단락</p>'),'제목 첫 단락 다음 단락'));
test('relative assets and credential-bearing content URLs rejected', () => {
  for (const bodyHtml of ['<img src="./photo.png" />','<a href="https://example.org/?token=placeholder">내용</a>','<a href="https://user:placeholder@example.org/">내용</a>']) assert.throws(() => checkPost({...base,bodyHtml},'first-post.json'));
});
test('cloud workflow has serial execution and an explicit main-only activation gate', () => {
  const workflow = parse(readFileSync(new URL('../.github/workflows/publish-posts.yml', import.meta.url),'utf8'));
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.equal(workflow.jobs.publish.concurrency.group, 'nhunnhun-tistory-publish');
  assert.equal(workflow.jobs.publish.concurrency['cancel-in-progress'], false);
  assert.deepEqual(workflow.permissions, {contents:'read'});
  assert.equal(workflow.jobs.publish.if, "vars.TISTORY_PUBLISH_ENABLED == 'true' && github.ref == 'refs/heads/main'");
  assert.equal(workflow.jobs.publish.needs, 'validate');
  assert.ok(workflow.jobs.publish.steps.some(step => step.run === 'pnpm run publish'));
});

test('editorial template gives new posts the shared visual hierarchy', () => {
  const html='<p><img src="https://example.org/a.jpg" alt="대표"></p><p>도입</p><h2>1. 제목</h2><h3>소제목</h3><table><thead><tr><th>구분</th></tr></thead><tbody><tr><td>값</td></tr></tbody></table><h2>질문</h2><p><strong>Q. 테스트?</strong><br>답변</p><h2>핵심 정리</h2><ul><li>정리</li></ul>';
  const styled=applyEditorialTemplate(html);
  assert.match(styled,/width:34px;height:4px/);
  assert.match(styled,/font-size:26px/);
  assert.match(styled,/font-size:20px/);
  assert.match(styled,/overflow-x:auto/);
  assert.match(styled,/>A\.<\/span>/);
  assert.match(styled,/background:#f8fafc/);
});
