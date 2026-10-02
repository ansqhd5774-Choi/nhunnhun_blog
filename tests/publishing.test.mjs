import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { checkPost, checkPublishHtml, eligible, fingerprint, assertArticleUrl, plainText } from '../publishing/core.mjs';
import { applyEditorialTemplate, renderEditorialPost, assertEditorialSource, assertEditorialContract, EDITORIAL_TEMPLATE_VERSION } from '../publishing/editorial.mjs';
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
  assert.ok(workflow.jobs.publish.steps.some(step => step.run === 'pnpm test'));
  assert.ok(workflow.jobs.publish.steps.some(step => step.run === 'pnpm validate'));
  assert.ok(workflow.jobs.publish.steps.some(step => step.run === 'pnpm run publish'));
  assert.equal(workflow.jobs.validate.steps.find(step => step.uses === 'actions/checkout@v5').with.ref,'main');
  assert.equal(workflow.jobs.publish.steps.find(step => step.uses === 'actions/checkout@v5').with.ref,'main');
});

test('editorial template gives new posts the shared visual hierarchy', () => {
  const post={
    id:'banana-test',
    title:'바나나 테스트 글',
    category:'음식',
    tags:['바나나'],
    representativeImageUrl:'https://example.org/a.jpg',
    status:'ready',
    approved:true,
    bodyHtml:'<p><img src="https://example.org/a.jpg" alt="대표"></p><p>도입 문장입니다.</p><blockquote><strong>핵심만 먼저:</strong> 핵심 요약입니다.</blockquote><h2>1. 첫 항목</h2><h3>소제목</h3><table><thead><tr><th>구분</th></tr></thead><tbody><tr><td>값</td></tr></tbody></table><p>설명 <a href="https://example.org/source-a">출처 A</a></p><h2>2. 두 번째</h2><p>설명 <a href="https://example.net/source-b">출처 B</a></p><h2>핵심 정리</h2><ul><li>정리</li></ul><h2>자료 출처</h2><ul><li><a href="https://example.org/source-a">출처 A</a></li><li><a href="https://example.net/source-b">출처 B</a></li></ul>'
  };
  const rendered=renderEditorialPost(post);
  assert.equal(EDITORIAL_TEMPLATE_VERSION,'R2');
  assert.match(rendered,/바나나, 이것만 먼저 보세요/);
  assert.match(rendered,/width:34px;height:4px/);
  assert.match(rendered,/font-size:26px/);
  assert.match(rendered,/font-size:20px/);
  assert.match(rendered,/overflow-x:auto/);
  assert.match(rendered,/background:#f8fafc/);
  assert.doesNotThrow(()=>assertEditorialContract(rendered,post.bodyHtml));
});

test('new public article requires complete editorial source structure', () => {
  const valid={
    id:'editorial-post',
    title:'사과 테스트 글',
    category:'음식',
    tags:['사과'],
    representativeImageUrl:'https://example.org/apple.jpg',
    status:'ready',
    approved:true,
    bodyHtml:'<p><img src="https://example.org/apple.jpg" alt="사과"></p><p>도입</p><h2>1. 하나</h2><p><a href="https://example.org/a">A</a></p><h2>2. 둘</h2><p><a href="https://example.net/b">B</a></p><h2>3. 셋</h2><p>본문</p><h2>4. 넷</h2><p>본문</p><h2>핵심 정리</h2><ul><li>정리</li></ul><h2>자료 출처</h2><ul><li><a href="https://example.org/a">A</a></li><li><a href="https://example.net/b">B</a></li></ul>'
  };
  assert.doesNotThrow(()=>assertEditorialSource(valid));
  assert.throws(()=>assertEditorialSource({...valid,representativeImageUrl:undefined}),/E_REPRESENTATIVE_IMAGE_REQUIRED/);
  assert.throws(()=>assertEditorialSource({...valid,representativeImageUrl:'https://example.org/other.jpg'}),/E_REPRESENTATIVE_IMAGE_NOT_IN_BODY/);
  assert.throws(()=>assertEditorialSource({...valid,bodyHtml:valid.bodyHtml.replace('<h2>핵심 정리</h2>','')}),/E_EDITORIAL_SUMMARY_REQUIRED/);
  assert.throws(()=>assertEditorialSource({...valid,bodyHtml:valid.bodyHtml.replace('<h2>자료 출처</h2>','')}),/E_EDITORIAL_SOURCES_REQUIRED/);
});

test('only canonical publish workflow may invoke the public publisher', () => {
  const dir=new URL('../.github/workflows/', import.meta.url);
  const offenders=[];
  for(const name of readdirSync(dir).filter(n=>/\.ya?ml$/.test(n))){
    if(name==='publish-posts.yml') continue;
    const content=readFileSync(new URL(name,dir),'utf8');
    if(/pnpm\s+(?:run\s+)?publish\b|publishing\/publish\.mjs/.test(content)) offenders.push(name);
  }
  assert.deepEqual(offenders,[]);
});

test('publish pipeline keeps the required recurrence-prevention gates', () => {
  const publish=readFileSync(new URL('../publishing/publish.mjs', import.meta.url),'utf8');
  const validate=readFileSync(new URL('../publishing/validate.mjs', import.meta.url),'utf8');
  assert.match(publish,/renderEditorialPost\(post\)/);
  assert.match(publish,/E_EDITORIAL_PUBLIC_CONTRACT/);
  assert.match(publish,/editorialTemplateVersion:EDITORIAL_TEMPLATE_VERSION/);
  assert.match(publish,/E_REPRESENTATIVE_UNVERIFIED/);
  assert.match(publish,/E_SOURCE_DRIFT/);
  assert.match(publish,/git', \['ls-remote', 'origin', 'refs\/heads\/main'\]/);
  assert.match(validate,/renderEditorialPost\(post\)/);
});
