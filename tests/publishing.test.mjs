import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localBrowserConfig, assertDedicatedProfile, assertLocalCdpUrl, assertLocalGit, openEditorConnection, closeEditorConnection, openPublicBrowser, freshEditorPage } from '../publishing/local-browser.mjs';
import { parse } from 'yaml';
import { checkPost, checkPublishHtml, eligible, fingerprint, assertArticleUrl, plainText } from '../publishing/core.mjs';
import { checkUpdateSource, eligibleUpdate, updateFingerprint } from '../publishing/update-core.mjs';
import { applyEditorialTemplate, renderEditorialPost, assertEditorialSource, assertEditorialContract, EDITORIAL_TEMPLATE_VERSION } from '../publishing/editorial.mjs';
import { assertImageReview } from '../publishing/image-review.mjs';
const base = {id:'first-post',title:'첫 글',category:'음식',tags:['음식'],bodyHtml:'<h2>제목</h2><p>내용입니다.</p>',status:'draft',approved:false};
test('draft posts never publish', () => assert.equal(eligible(base,null),false));
test('unapproved ready posts are rejected', () => assert.throws(() => checkPost({...base,status:'ready'},'first-post.json')));
test('approved ready post accepted', () => assert.equal(eligible(checkPublishHtml(checkPost({...base,status:'ready',approved:true},'first-post.json')),null),true));
test('same publication is skipped', () => assert.equal(eligible({...base,status:'ready',approved:true},{phase:'published',fingerprint:fingerprint(base)}),false));
test('uncertain final click never retries', () => assert.throws(() => eligible({...base,status:'ready',approved:true},{phase:'submitting',fingerprint:fingerprint(base)})));
test('evidence-backed failed publication may retry only after confirmed no public mutation', () => {
  const post={...base,status:'ready',approved:true};
  assert.equal(eligible(post,{phase:'failed',fingerprint:fingerprint(post),publicMutationConfirmed:false}),true);
  assert.throws(()=>eligible(post,{phase:'failed',fingerprint:fingerprint(post),publicMutationConfirmed:true}));
  assert.throws(()=>eligible(post,{phase:'failed',fingerprint:'different',publicMutationConfirmed:false}));
});
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
  assert.equal(workflow.jobs.validate.steps.find(step => step.uses === 'actions/checkout@v5').with.ref,'${{ github.sha }}');
  assert.equal(workflow.jobs.publish.steps.find(step => step.uses === 'actions/checkout@v5').with.ref,'${{ github.sha }}');
  assert.ok(workflow.jobs.publish.steps.findIndex(step => step.run === 'node publishing/runner-gate.mjs') < workflow.jobs.publish.steps.findIndex(step => step.run === 'pnpm install --frozen-lockfile --ignore-scripts'));
  const watched=workflow.on?.push?.paths ?? workflow['on']?.push?.paths ?? [];
  assert.ok(!watched.includes('publishing/**'));
  assert.ok(!watched.includes('publishing/update.mjs'));
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
    bodyHtml:'<p><img src="https://example.org/a.jpg" alt="대표"></p><p>도입 <u>핵심 하나</u> 문장입니다.</p><p><img src="https://example.org/b.jpg" alt="설명 이미지 1"></p><blockquote><strong>핵심만 먼저:</strong> <u>핵심 둘</u> 요약입니다.</blockquote><h2>1. 첫 항목</h2><p><img src="https://example.org/c.jpg" alt="설명 이미지 2"></p><h3>소제목</h3><table><thead><tr><th>구분</th></tr></thead><tbody><tr><td>값</td></tr></tbody></table><p>설명 <a href="https://example.org/source-a">출처 A</a></p><h2>2. 두 번째</h2><p>설명 <a href="https://example.net/source-b">출처 B</a></p><h2>핵심 정리</h2><ul><li>정리</li></ul><h2>자료 출처</h2><ul><li><a href="https://example.org/source-a">출처 A</a></li><li><a href="https://example.net/source-b">출처 B</a></li></ul>'
  };
  const rendered=renderEditorialPost(post);
  assert.equal(EDITORIAL_TEMPLATE_VERSION,'R3');
  assert.match(rendered,/바나나, 이것만 먼저 보세요/);
  assert.match(rendered,/width:34px;height:4px/);
  assert.match(rendered,/font-size:26px/);
  assert.match(rendered,/font-size:20px/);
  assert.match(rendered,/overflow-x:auto/);
  assert.match(rendered,/background:#f8fafc/);
  assert.match(rendered,/linear-gradient\(transparent 45%,#fff1a8 45%\)/);
  assert.match(rendered,/linear-gradient\(transparent 45%,#d9f99d 45%\)/);
  assert.doesNotThrow(()=>assertEditorialContract(rendered,post.bodyHtml));
});

test('editorial quick-summary topic removes Korean genitive particle', () => {
  const post={
    id:'coffee-topic-test',
    title:'커피의 역사와 원두 종류 총정리',
    category:'음식',
    tags:['커피'],
    representativeImageUrl:'https://example.org/a.jpg',
    status:'ready',
    approved:true,
    bodyHtml:'<p><img src="https://example.org/a.jpg" alt="a"></p><p>도입 <u>강조 하나</u></p><p><img src="https://example.org/b.jpg" alt="b"></p><blockquote><strong>핵심만 먼저:</strong> <u>강조 둘</u> 요약</blockquote><p><img src="https://example.org/c.jpg" alt="c"></p><h2>1</h2><p><a href="https://example.org/a">A</a></p><h2>2</h2><p><a href="https://example.net/b">B</a></p><h2>3</h2><p>본문</p><h2>4</h2><p>본문</p><h2>핵심 정리</h2><ul><li>정리</li></ul><h2>자료 출처</h2><ul><li><a href="https://example.org/a">A</a></li><li><a href="https://example.net/b">B</a></li></ul>'
  };
  const rendered=renderEditorialPost(post);
  assert.match(rendered,/커피, 이것만 먼저 보세요/);
  assert.doesNotMatch(rendered,/커피의, 이것만 먼저 보세요/);
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
    bodyHtml:'<p><img src="https://example.org/apple.jpg" alt="사과"></p><p>도입 <u>강조 하나</u></p><p><img src="https://example.org/apple-2.jpg" alt="사과 설명 1"></p><blockquote><strong>핵심만 먼저:</strong> <u>강조 둘</u> 요약</blockquote><p><img src="https://example.org/apple-3.jpg" alt="사과 설명 2"></p><h2>1. 하나</h2><p><a href="https://example.org/a">A</a></p><h2>2. 둘</h2><p><a href="https://example.net/b">B</a></p><h2>3. 셋</h2><p>본문</p><h2>4. 넷</h2><p>본문</p><h2>핵심 정리</h2><ul><li>정리</li></ul><h2>자료 출처</h2><ul><li><a href="https://example.org/a">A</a></li><li><a href="https://example.net/b">B</a></li></ul>'
  };
  assert.doesNotThrow(()=>assertEditorialSource(valid));
  assert.throws(()=>assertEditorialSource({...valid,bodyHtml:valid.bodyHtml.replace('<p><img src="https://example.org/apple-2.jpg" alt="사과 설명 1"></p>','').replace('<p><img src="https://example.org/apple-3.jpg" alt="사과 설명 2"></p>','')}),/E_EDITORIAL_IMAGE_MINIMUM/);
  assert.throws(()=>assertEditorialSource({...valid,bodyHtml:valid.bodyHtml.replace('alt="사과 설명 1"','alt=""')}),/E_EDITORIAL_IMAGE_ALT_REQUIRED/);
  assert.throws(()=>assertEditorialSource({...valid,representativeImageUrl:undefined}),/E_REPRESENTATIVE_IMAGE_REQUIRED/);
  assert.throws(()=>assertEditorialSource({...valid,representativeImageUrl:'https://example.org/other.jpg'}),/E_REPRESENTATIVE_IMAGE_NOT_IN_BODY/);
  assert.throws(()=>assertEditorialSource({...valid,bodyHtml:valid.bodyHtml.replace('<blockquote><strong>핵심만 먼저:</strong> <u>강조 둘</u> 요약</blockquote>','')}),/E_EDITORIAL_QUICK_REQUIRED/);
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
  assert.match(publish,/assertEditorialContract\(stagedHtml, post\.bodyHtml\)/);
  assert.match(publish,/E_EDITORIAL_PUBLIC_CONTRACT/);
  assert.match(publish,/host\.innerText\|\|host\.textContent/);
  assert.doesNotMatch(publish,/DOMParser\(\)\.parseFromString/);
  assert.match(publish,/editorialSnapshot\.responsiveImages/);
  assert.match(publish,/editorialSnapshot\.highlights/);
  assert.match(publish,/editorialSnapshot\.highlightColors/);
  assert.match(publish,/editorialSnapshot\.quickCards/);
  assert.match(publish,/editorialSnapshot\.relatedCards/);
  assert.match(publish,/editorialTemplateVersion:EDITORIAL_TEMPLATE_VERSION/);
  assert.match(publish,/E_REPRESENTATIVE_UNVERIFIED/);
  assert.match(publish,/E_SOURCE_DRIFT/);
  assert.match(publish,/previousStateSha/);
  assert.match(publish,/stage === 'final-submit'/);
  assert.match(publish,/E_PUBLISH_BUTTON_DISABLED/);
  assert.match(publish,/FINAL_SUBMIT_RESPONSES/);
  assert.match(publish,/page\.goto\(\`\$\{BLOG\}\/manage\/posts\`/);
  assert.equal((publish.match(/publishButton\.click/g)||[]).length,1);
  assert.match(publish,/git', \['ls-remote', 'origin', 'refs\/heads\/main'\]/);
  assert.match(validate,/renderEditorialPost\(post\)/);
});

test('validation remains hosted; public publisher is Windows CMD only', () => {
  const w=parse(readFileSync(new URL('../.github/workflows/publish-posts.yml',import.meta.url),'utf8'));
  assert.equal(w.jobs.validate['runs-on'],'ubuntu-latest');
  assert.deepEqual(w.jobs.publish['runs-on'],['self-hosted','windows','x64','tistory-publisher']);
  assert.deepEqual(w.jobs.publish.defaults,{run:{shell:'cmd'}});
  assert.equal(w.jobs.publish['timeout-minutes'],12);
  assert.equal(w.jobs.publish.permissions.contents,'write');
  assert.doesNotMatch(JSON.stringify(w),/BROWSERBASE_|upload-artifact|actions\/cache|powershell|pwsh/i);
});

test('active browser sources use only local persistent Chrome and no cloud session', () => {
  for(const name of ['publish.mjs','login.mjs','smoke.mjs','local-browser.mjs']){
    const source=readFileSync(new URL('../publishing/'+name,import.meta.url),'utf8');
    assert.doesNotMatch(source,/@browserbasehq\/sdk|Browserbase|BROWSERBASE_|\/tmp\//);
    assert.doesNotMatch(source,/restore-last-session/);
  }
  const local=readFileSync(new URL('../publishing/local-browser.mjs',import.meta.url),'utf8');
  assert.match(local,/connectOverCDP/);
  assert.match(local,/127\.0\.0\.1/);
  assert.match(local,/_shouldCloseConnectionOnClose = true/);
  const p=readFileSync(new URL('../publishing/publish.mjs',import.meta.url),'utf8');
  assert.match(p,/tmpdir\(\)/);
  assert.match(p,/publicBrowser = await openPublicBrowser\(browserConfig\)/);
  assert.match(p,/verificationContext\(publicBrowser\)/);
  assert.match(p,/closeEditorConnection\(editorConnection\)/);
  const verification=readFileSync(new URL('../publishing/verification-context.mjs',import.meta.url),'utf8');
  assert.match(verification,/context\.route\('\*\*\/\*'/);
  assert.match(verification,/serviceWorkers: 'block'/);
  assert.ok(p.indexOf("phase:'submitting'")<p.indexOf('await publishButton.click'));
  assert.ok(p.indexOf("E_SOURCE_DRIFT")<p.indexOf("phase:'submitting'"));
});

test('configuration rejects missing executables, missing profiles, remote CDP and ordinary Chrome profiles', async () => {
  const temp=await mkdtemp(join(tmpdir(),'tistory-config-test-'));
  try {
    const exe=join(temp,'chrome.exe'); await writeFile(exe,'fixture');
    await assert.rejects(localBrowserConfig({}),/E_LOCAL_CHROME_REQUIRED/);
    await assert.rejects(localBrowserConfig({TISTORY_CHROME_PATH:join(temp,'missing.exe')}),/E_LOCAL_CHROME_REQUIRED/);
    await assert.rejects(localBrowserConfig({TISTORY_CHROME_PATH:exe}),/E_LOCAL_PROFILE_REQUIRED/);
    for(const value of ['C:/Users/example/AppData/Local/Google/Chrome/User Data/Default',join(temp,'Google','Chrome','User Data')]){
      assert.throws(()=>assertDedicatedProfile(value),/E_LOCAL_PROFILE_REQUIRED/);
    }
    const profile=join(temp,'dedicated');
    const config=await localBrowserConfig({TISTORY_CHROME_PATH:exe,TISTORY_PROFILE_DIR:profile});
    assert.equal(config.profileDir,profile);
    assert.equal(config.cdpUrl,'http://127.0.0.1:9223');
    assert.equal(assertLocalCdpUrl('http://localhost:9333'),'http://localhost:9333');
    assert.throws(()=>assertLocalCdpUrl('https://example.com:9223'),/E_LOCAL_CDP_REQUIRED/);
    await assert.rejects(localBrowserConfig({TISTORY_CHROME_PATH:exe,TISTORY_PROFILE_DIR:exe}),/E_LOCAL_PROFILE_ACCESS/);
  } finally {await rm(temp,{recursive:true,force:true});}
});

test('missing Git fails closed before browser or publication', () => {
  assert.throws(()=>assertLocalGit(()=>{throw Error('fixture');}),/E_LOCAL_GIT_REQUIRED/);
});

test('authenticated editor attaches to local persistent Chrome and disconnects without closing it', async () => {
  const calls=[];
  const context={kind:'editor-context'};
  const browser={
    _shouldCloseConnectionOnClose:false,
    contexts:()=>[context],
    close:async()=>{calls.push(['disconnect',browser._shouldCloseConnectionOnClose]);}
  };
  const engine={
    connectOverCDP:async(...args)=>{calls.push(['editor',...args]);return browser;},
    launch:async(...args)=>{calls.push(['public',...args]);return {kind:'public'};}
  };
  const config={chromePath:'fixture-chrome',profileDir:'fixture-profile',cdpUrl:'http://127.0.0.1:9223'};
  const connection=await openEditorConnection(config,{engine});
  assert.equal(connection.context,context);
  assert.equal((await openPublicBrowser(config,engine)).kind,'public');
  await closeEditorConnection(connection);
  assert.deepEqual(calls,[
    ['editor','http://127.0.0.1:9223',{timeout:15000,isLocal:true,noDefaults:true}],
    ['public',{headless:true,executablePath:'fixture-chrome'}],
    ['disconnect',true]
  ]);
  await assert.rejects(openEditorConnection(config,{engine:{connectOverCDP:async()=>{throw Error('offline');}}}),/^Error: E_LOCAL_BROWSER_CONNECT$/);
});

test('login bootstrap confirms administrator page and never submits posts', () => {
  const s=readFileSync(new URL('../publishing/login.mjs',import.meta.url),'utf8');
  assert.match(s,/openEditorConnection/);
  assert.match(s,/url\.origin === BLOG && url\.pathname === '\/manage\/posts'/);
  assert.match(s,/name:'글쓰기', exact:true/);
  assert.match(s,/LOGIN_SAVED/);
  assert.doesNotMatch(s,/publishButton|ledger\.write|공개 발행/);
});

test('retired execution records remain byte-identical and outside active workflows', () => {
  const records=JSON.parse(readFileSync(new URL('../evidence/legacy-browser-publisher-20261003/manifest.json',import.meta.url),'utf8'));
  assert.equal(records.length,95);
  for(const record of records){
    const bytes=readFileSync(new URL('../'+record.archive,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256,record.source);
  }
  for(const name of readdirSync(new URL('../.github/workflows/',import.meta.url))){
    assert.doesNotMatch(readFileSync(new URL('../.github/workflows/'+name,import.meta.url),'utf8'),/BROWSERBASE_|pwsh|powershell/i);
  }
  assert.doesNotMatch(readFileSync(new URL('../pnpm-lock.yaml',import.meta.url),'utf8'),/@browserbasehq/);
});


test('existing-post update source is locked to one numeric public URL', () => {
  const update={
    id:'update-111-coffee-history-20261004',
    articleId:'111',
    targetUrl:'https://nhunnhun.tistory.com/111',
    expectedCurrentTitle:'기존 제목',
    title:'새 제목',
    representativeImageUrl:'https://example.org/a.jpg',
    bodyHtml:'<p><img src="https://example.org/a.jpg" alt="a"></p><p>도입</p><p><img src="https://example.org/b.jpg" alt="b"></p><blockquote><strong>핵심만 먼저:</strong> 요약</blockquote><p><img src="https://example.org/c.jpg" alt="c"></p><h2>1</h2><p>내용</p><h2>2</h2><p>내용</p><h2>3</h2><p>내용</p><h2>4</h2><p>내용</p><h2>핵심 정리</h2><ul><li>정리</li></ul><h2>자료 출처</h2><ul><li><a href="https://example.org/1">1</a></li><li><a href="https://example.net/2">2</a></li></ul>',
    status:'ready',
    approved:true
  };
  assert.equal(checkUpdateSource(update,update.id+'.json').articleId,'111');
  assert.equal(eligibleUpdate(update,null),true);
  const state={phase:'updated',fingerprint:updateFingerprint(update),url:update.targetUrl};
  assert.equal(eligibleUpdate(update,state),false);
  assert.throws(()=>checkUpdateSource({...update,targetUrl:'https://nhunnhun.tistory.com/112'},update.id+'.json'),/E_UPDATE_URL/);
  assert.throws(()=>eligibleUpdate(update,{phase:'submitting',fingerprint:updateFingerprint(update),url:update.targetUrl}),/E_UPDATE_EXISTING_STATE_REQUIRES_REVIEW/);
});

test('existing-post update workflow is separated from new publication', () => {
  const w=parse(readFileSync(new URL('../.github/workflows/update-posts.yml',import.meta.url),'utf8'));
  assert.equal(w.jobs['validate-update']['runs-on'],'ubuntu-latest');
  assert.deepEqual(w.jobs.update['runs-on'],['self-hosted','windows','x64','tistory-publisher']);
  assert.deepEqual(w.jobs.update.defaults,{run:{shell:'cmd'}});
  assert.equal(w.jobs.update.needs,'validate-update');
  const all=JSON.stringify(w);
  assert.match(all,/pnpm run update/);
  assert.match(all,/pnpm run validate:update/);
  assert.doesNotMatch(all,/pnpm run publish|publishing\/publish\.mjs/);
  assert.equal(w.jobs.update.if,"vars.TISTORY_PUBLISH_ENABLED == 'true' && github.ref == 'refs/heads/main'");
});

test('image review gate requires visually checked close-up hero and exact attribution', () => {
  const body='<p><img src="https://commons.wikimedia.org/wiki/Special:Redirect/file/Fruit_A.jpg?width=960" alt="잘라 놓은 과일 단면과 통과일"></p><p><img src="https://commons.wikimedia.org/wiki/Special:Redirect/file/Fruit_B.jpg?width=960" alt="과일 내부 구조를 보여주는 단면"></p><p><img src="https://commons.wikimedia.org/wiki/Special:Redirect/file/Fruit_C.jpg?width=960" alt="과수원에서 자라는 과일나무"></p><h2>자료 출처</h2><ul><li><a href="https://commons.wikimedia.org/wiki/File:Fruit_A.jpg">A</a></li><li><a href="https://commons.wikimedia.org/wiki/File:Fruit_B.jpg">B</a></li><li><a href="https://commons.wikimedia.org/wiki/File:Fruit_C.jpg">C</a></li></ul>';
  const review=[
    {src:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Fruit_A.jpg?width=960',alt:'잘라 놓은 과일 단면과 통과일',role:'hero',composition:'closeup',sourcePage:'https://commons.wikimedia.org/wiki/File:Fruit_A.jpg',author:'A',license:'CC BY-SA 4.0',visualChecked:true},
    {src:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Fruit_B.jpg?width=960',alt:'과일 내부 구조를 보여주는 단면',role:'detail',composition:'cross-section',sourcePage:'https://commons.wikimedia.org/wiki/File:Fruit_B.jpg',author:'B',license:'CC BY-SA 4.0',visualChecked:true},
    {src:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Fruit_C.jpg?width=960',alt:'과수원에서 자라는 과일나무',role:'context',composition:'context',sourcePage:'https://commons.wikimedia.org/wiki/File:Fruit_C.jpg',author:'C',license:'CC0',visualChecked:true}
  ];
  const item={representativeImageUrl:review[0].src,bodyHtml:body,imageReview:review};
  assert.doesNotThrow(()=>assertImageReview(item));
  assert.throws(()=>assertImageReview({...item,imageReview:review.map((x,i)=>i?x:{...x,composition:'context'})}),/E_IMAGE_HERO_REVIEW/);
  assert.throws(()=>assertImageReview({...item,imageReview:review.map((x,i)=>i?x:{...x,alt:'실제와 다른 설명'})}),/E_IMAGE_REVIEW_MISMATCH/);
  assert.throws(()=>assertImageReview({...item,imageReview:review.map((x,i)=>i?x:{...x,visualChecked:false})}),/E_IMAGE_REVIEW_REQUIRED/);
});


test('publisher diagnoses Tistory daily limit and human verification without a second click', () => {
  const publish=readFileSync(new URL('../publishing/publish.mjs',import.meta.url),'utf8');
  assert.match(publish,/E_TISTORY_DAILY_PUBLISH_LIMIT/);
  assert.match(publish,/E_TISTORY_HUMAN_VERIFICATION_REQUIRED/);
  assert.match(publish,/E_PUBLICATION_NOT_FOUND_AFTER_CLICK/);
  assert.match(publish,/FINAL_SUBMIT_SIGNALS/);
  const finalBlock=publish.slice(publish.indexOf("stage = 'final-submit'"),publish.indexOf("stage = 'public-verification'"));
  assert.equal((finalBlock.match(/publishButton\.click\(/g)||[]).length,1);
});

test('human-verification failure stays blocked until manual clearance', () => {
  const post={...base,status:'ready',approved:true};
  const state={phase:'failed',fingerprint:fingerprint(post),publicMutationConfirmed:false,failureCode:'E_TISTORY_HUMAN_VERIFICATION_REQUIRED'};
  assert.equal(eligible(post,state),false);
});

test('publisher recognizes dkaptcha probe and 403 post response as human verification', () => {
  const publish=readFileSync(new URL('../publishing/publish.mjs',import.meta.url),'utf8');
  assert.match(publish,/dkaptcha/);
  assert.match(publish,/x\.path === '\/manage\/post\.json' && x\.status === 403/);
});


test('persistent Chrome helper binds CDP to loopback only', () => {
  const helper=readFileSync(new URL('../maintenance/ensure-tistory-chrome.cmd',import.meta.url),'utf8');
  assert.match(helper,/remote-debugging-address=127\.0\.0\.1/);
  assert.match(helper,/remote-debugging-port=%TISTORY_CDP_PORT%/);
  assert.match(helper,/user-data-dir="%TISTORY_PROFILE_DIR%"/);
  assert.doesNotMatch(helper,/0\.0\.0\.0|powershell|pwsh/i);
});


test('persistent editor reuses authenticated Tistory tab and closes extras', async () => {
  const closed=[];
  const auth={url:()=> 'https://nhunnhun.tistory.com/manage/posts',close:async()=>closed.push('auth')};
  const extra={url:()=> 'about:blank',close:async()=>closed.push('extra')};
  const context={pages:()=>[extra,auth],newPage:async()=>{throw Error('must not create');}};
  const page=await freshEditorPage(context);
  assert.equal(page,auth);
  assert.deepEqual(closed,['extra']);
});

test('persistent editor creates one tab only when browser has no pages', async () => {
  const created={url:()=> 'about:blank'};
  const context={pages:()=>[],newPage:async()=>created};
  assert.equal(await freshEditorPage(context),created);
});


test('dialog handler contains stale-dialog race guard', () => {
  const publish=readFileSync(new URL('../publishing/publish.mjs',import.meta.url),'utf8');
  assert.match(publish,/No dialog is showing/);
  assert.match(publish,/E_DIALOG_HANDLER/);
  assert.match(publish,/void \(async \(\) =>/);
});


test('publisher uses trusted visible mode controls and only writes after the HTML CodeMirror becomes active', () => {
  const publish=readFileSync(new URL('../publishing/publish.mjs',import.meta.url),'utf8');
  const switchBlock=publish.slice(
    publish.indexOf('async function switchToHtmlEditor(page) {'),
    publish.indexOf('\nlet editorConnection')
  );
  assert.match(switchBlock,/\[role="button"\]\[aria-haspopup="true"\]/);
  assert.match(switchBlock,/filter\(\{hasText:\/기본\\s\*모드\|HTML\/i\}\)/);
  assert.match(switchBlock,/\[role="menuitem"\]/);
  assert.match(switchBlock,/hasText:\/\^\\s\*HTML\\s\*\$\//);
  assert.match(switchBlock,/for \(let attempt = 0; attempt < 2; attempt\+\+\)/);
  assert.match(switchBlock,/document\.querySelectorAll\('\.CodeMirror\.cm-s-tistory-html'\)/);
  assert.match(switchBlock,/document\.querySelectorAll\('\.CodeMirror\.cm-s-tistory-markdown'\)/);
  assert.match(switchBlock,/return htmlActive && !markdownActive/);
  assert.match(switchBlock,/keyboard\.press\('Escape'\)/);
  assert.doesNotMatch(switchBlock,/force:true/);
  assert.doesNotMatch(switchBlock,/\.evaluate\([^]*\.click\(\)/);
  assert.match(publish,/DIALOG_DIAG/);
  assert.match(publish,/DIALOG_ACTION/);
  assert.match(publish,/stage === 'html-mode'/);
  assert.match(publish,/htmlMirror\.click\(\{position:/);
  assert.match(publish,/keyboard\.insertText\(bodyHtml\)/);
  assert.match(publish,/cm\.setValue\(html\)/);
  assert.doesNotMatch(publish,/htmlCode\.click\(\{force:true\}\)/);
  assert.match(publish,/E_EDITOR_MODE_MENU/);
  assert.match(publish,/E_EDITOR_HTML_MODE/);
  assert.match(publish,/E_EDITOR_HTML_BODY/);
});

test('publisher exits promptly after a pre-submit runtime failure', () => {
  const publish=readFileSync(new URL('../publishing/publish.mjs',import.meta.url),'utf8');
  assert.match(publish,/fatalExitCode/);
  assert.match(publish,/setTimeout\(\(\) => process\.exit\(fatalExitCode\), 0\)/);
});

test('CDP disconnect closes transport directly without closing persistent Chrome', () => {
  const local=readFileSync(new URL('../publishing/local-browser.mjs',import.meta.url),'utf8');
  assert.match(local,/browser\._connection\?\.close/);
  assert.match(local,/disconnect-timeout/);
});


test('publisher category selector uses actual Tistory button/link structure', () => {
  const publish=readFileSync(new URL('../publishing/publish.mjs',import.meta.url),'utf8');
  assert.match(publish,/categoryList\.locator\('button, a'\)/);
  assert.match(publish,/CATEGORY_DIAG/);
  assert.match(publish,/E_CATEGORY_CONTROL/);
  assert.match(publish,/E_CATEGORY_LIST/);
  assert.match(publish,/E_CATEGORY_AMBIGUOUS/);
  assert.match(publish,/E_TAG_CONTROL/);
});
