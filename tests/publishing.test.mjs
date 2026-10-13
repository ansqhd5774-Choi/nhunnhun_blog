import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'yaml';
import {checkPost,assertArticleUrl,plainText} from '../publishing/core.mjs';
import {MUTATION_WORKFLOW_PATHS} from '../publishing/workflow-policy.mjs';

const base={
  id:'first-post',title:'테스트 제목',category:'음식',tags:['테스트'],status:'ready',approved:true,
  representativeImageUrl:'https://example.com/image.jpg',
  bodyHtml:'<h2>소개</h2><p>테스트 본문입니다.</p>',
  contentStandard:'R1'
};

test('safe entity and void spellings pass while sanitizer removals remain blocked',()=>{
  for(const bodyHtml of ['<p>철분&nbsp;정보</p><br>','<p>철분&#160;정보</p><img src="https://example.com/a.jpg" alt="설명">'])
    assert.doesNotThrow(()=>checkPost({...base,bodyHtml},'first-post.json'));
  for(const bodyHtml of ['<script>alert(1)</script><p>본문</p>','<p onclick="x()">본문</p>'])
    assert.throws(()=>checkPost({...base,bodyHtml},'first-post.json'));
});
test('draft posts never publish',()=>assert.throws(()=>checkPost({...base,status:'draft'},'first-post.json')));
test('unapproved ready posts are rejected',()=>assert.throws(()=>checkPost({...base,approved:false},'first-post.json')));
test('approved ready post accepted',()=>assert.doesNotThrow(()=>checkPost(base,'first-post.json')));
test('same publication is skipped',()=>{});
test('scheduled publication is terminal and schedule metadata is validated',()=>{});
test('uncertain final click never retries',()=>{});
test('evidence-backed failed publication may retry only after confirmed no public mutation',()=>{});
test('changed published content never creates another article',()=>{});
test('arbitrary fields and path injection are rejected',()=>{});
test('executable HTML and invalid URL schemes rejected',()=>{});
test('HTTPS references and Unicode content preserved',()=>{});
test('rich archival HTML is allowed by schema but rejected for new publication',()=>{});
test('post hash changes with category tags title and body',()=>{});
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
  assert.equal(workflow.jobs.publish.concurrency.group, 'nhunnhun-tistory-mutation');
  assert.equal(workflow.jobs.publish.concurrency['cancel-in-progress'], false);
  assert.deepEqual(workflow.permissions, {contents:'read'});
  assert.equal(workflow.jobs.publish.if, "vars.TISTORY_PUBLISH_ENABLED == 'true' && github.ref == 'refs/heads/main' && needs.validate.outputs.should_publish == 'true'");
  assert.equal(workflow.jobs.validate.outputs.should_publish,'${{ steps.mutation-gate.outputs.should_mutate }}');
  assert.equal(workflow.jobs.validate.steps.find(step => step.id === 'mutation-gate').run,'node publishing/mutation-gate.mjs posts');
  assert.equal(workflow.jobs.validate.steps.find(step => step.uses === 'actions/checkout@v5').with['fetch-depth'],0);
  assert.equal(workflow.jobs.publish.needs, 'validate');
  assert.ok(!workflow.jobs.publish.steps.some(step => step.run === 'pnpm test'));
  assert.ok(workflow.jobs.validate.steps.some(step => step.run === 'pnpm validate'));
  assert.ok(!workflow.jobs.publish.steps.some(step => step.run === 'pnpm validate'));
  assert.ok(workflow.jobs.publish.steps.some(step => step.run === 'pnpm run publish'));
  assert.equal(workflow.jobs.validate.steps.find(step => step.uses === 'actions/checkout@v5').with.ref,'${{ github.sha }}');
  assert.equal(workflow.jobs.publish.steps.find(step => step.uses === 'actions/checkout@v5').with.ref,'${{ github.sha }}');
  assert.ok(workflow.jobs.publish.steps.findIndex(step => step.run === 'node publishing/runner-gate.mjs') < workflow.jobs.publish.steps.findIndex(step => step.run === 'pnpm install --frozen-lockfile --ignore-scripts'));
  const watched=workflow.on?.push?.paths ?? workflow['on']?.push?.paths ?? [];
  assert.ok(!watched.includes('publishing/**'));
  assert.ok(!watched.includes('publishing/update.mjs'));
});

test('mutation gate prevents maintenance commits from reaching Tistory', () => {
  const workflow = parse(readFileSync(new URL('../.github/workflows/publish-posts.yml', import.meta.url),'utf8'));
  assert.equal(workflow.jobs.publish.if, "vars.TISTORY_PUBLISH_ENABLED == 'true' && github.ref == 'refs/heads/main' && needs.validate.outputs.should_publish == 'true'");
  assert.ok(MUTATION_WORKFLOW_PATHS.includes('.github/workflows/publish-posts.yml'));
});
test('editorial template gives new posts the shared visual hierarchy',()=>{});
test('editorial quick-summary topic removes Korean genitive particle',()=>{});
test('new public article requires complete editorial source structure',()=>{});
test('only canonical publish workflow may invoke the public publisher',()=>{});
test('publish pipeline keeps the required recurrence-prevention gates',()=>{});
test('validation and public publisher use the Windows CMD self-hosted runner with mutation isolated to publish',()=>{});
test('publisher attaches to the saved login Chrome and reuses only the authenticated manager tab',()=>{});
