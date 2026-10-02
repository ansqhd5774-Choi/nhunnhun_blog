import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { checkPost, eligible, fingerprint, assertArticleUrl, plainText } from '../publishing/core.mjs';
const base = {id:'first-post',title:'첫 글',category:'음식',tags:['음식'],bodyHtml:'<h2>제목</h2><p>내용입니다.</p>',status:'draft',approved:false};
test('draft posts never publish', () => assert.equal(eligible(base,null),false));
test('unapproved ready posts are rejected', () => assert.throws(() => checkPost({...base,status:'ready'},'first-post.json')));
test('approved ready post accepted', () => assert.equal(eligible(checkPost({...base,status:'ready',approved:true},'first-post.json'),null),true));
test('same publication is skipped', () => assert.equal(eligible({...base,status:'ready',approved:true},{phase:'published',fingerprint:fingerprint(base)}),false));
test('uncertain final click never retries', () => assert.throws(() => eligible({...base,status:'ready',approved:true},{phase:'submitting',fingerprint:fingerprint(base)})));
test('changed published content requires review rather than another article', () => assert.throws(() => eligible({...base,status:'ready',approved:true,bodyHtml:'<p>변경</p>'},{phase:'published',fingerprint:fingerprint(base)})));
test('arbitrary fields and path injection are rejected', () => {
  assert.throws(() => checkPost({...base,id:'../bad'},'../bad.json'));
  assert.throws(() => checkPost({...base,blog:'https://other.tistory.com'},'first-post.json'));
});
test('executable HTML and invalid URL schemes rejected', () => {
  for (const bodyHtml of ['<script>alert(1)</script>','<p onclick="x()">내용</p>','<a href="javascript:alert(1)">내용</a>','<img src="http://host/image.png" />','<p>{{남은문구}}</p>']) assert.throws(() => checkPost({...base,bodyHtml},'first-post.json'));
});
test('HTTPS references and Unicode content preserved', () => assert.equal(checkPost({...base,bodyHtml:'<p>영양 100g <a href="https://example.org/">출처</a></p>'},'first-post.json').title,'첫 글'));
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
