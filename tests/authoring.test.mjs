import test from 'node:test';
import assert from 'node:assert/strict';
import { options, outputText, citations, responseRequest, buildDraft, generate } from '../authoring/generate.mjs';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const config = { id: 'sample-food', domain: 'food' };
const urls = ['https://example.org/a','https://example.org/b'];
const article = { title: '검토용 글', tags: ['음식'], bodyHtml: '<p>식사 선택 기준을 확인합니다. <a href="https://example.org/a">근거</a> <a href="https://example.org/b">자료</a></p>' };
test('입력과 키가 없으면 API 호출 이전에 중단', () => {
  assert.throws(() => options({}), /E_WRITER_INPUT/);
  assert.throws(() => options({ ARTICLE_TOPIC:'배',ARTICLE_ID:'pear-food',ARTICLE_DOMAIN:'food' }), /E_OPENAI_KEY_MISSING/);
  assert.throws(() => options({ ARTICLE_TOPIC:'배',ARTICLE_ID:'../escape',ARTICLE_DOMAIN:'food',OPENAI_API_KEY:'test' }), /E_WRITER_INPUT/);
});
test('미완료·거절 응답은 글로 사용하지 않음', () => {
  assert.throws(() => outputText({ status:'incomplete' }), /E_OPENAI_INCOMPLETE/);
  assert.throws(() => outputText({ status:'completed',output:[{content:[{type:'refusal'}]}] }), /E_OPENAI_REFUSAL/);
});
test('실제 응답 인용만 수집하고 비밀 URL을 제외', () => {
  assert.deepEqual(citations({ output:[{content:[{annotations:[{type:'url_citation',url:urls[0]},{type:'url_citation',url:'https://example.org/?token=secret'}]}]}] }), [urls[0]]);
});
test('초안은 강제로 미승인, 검색 외 링크·이미지·스크립트 차단', () => {
  const source = buildDraft(article, config, urls);
  assert.equal(source.approved, false); assert.equal(source.status, 'draft');
  assert.throws(() => buildDraft(article, config, [urls[0]]), /E_WRITER_CITATIONS/);
  assert.throws(() => buildDraft({...article,bodyHtml:article.bodyHtml+'<img src="https://example.org/i" alt="이미지">'}, config, urls), /E_WRITER_UNREVIEWED_IMAGE/);
  assert.throws(() => buildDraft({...article,bodyHtml:article.bodyHtml+'<script>alert(1)</script>'}, config, urls), /E_UNSAFE_HTML/);
});
test('API 오류가 키·원문을 출력하지 않고 재시도하지 않음', async () => {
  let calls = 0;
  await assert.rejects(responseRequest({}, 'private-key', async () => { calls++; return {ok:false,status:401,json:async()=>({error:{message:'private-key'}})}; }), /^Error: E_OPENAI_HTTP_401$/);
  assert.equal(calls, 1);
  await assert.rejects(responseRequest({}, 'private-key', async () => { throw new Error('private-key'); }), /E_OPENAI_TRANSPORT_STATE_UNKNOWN/);
});
test('전체 생성은 source와 미승인 검토서를 저장하고 기존 산출물을 덮어쓰지 않음', async () => {
  const root = await mkdtemp(join(tmpdir(), 'writer-test-'));
  try {
    await mkdir(join(root,'docs/content'), {recursive:true}); await mkdir(join(root,'posts'));
    for (const file of ['CONTENT_STANDARD_R1.md','CONTENT_WRITER_PROMPT_R1.md','content/DOMAIN_GUIDES_R1.md','EDITORIAL_PUBLISH_STANDARD_R4.md','CONTENT_REVIEW_FORMAT_R1.md']) await writeFile(join(root,'docs',file),'검토용 기준');
    const env = {ARTICLE_TOPIC:'식사 선택',ARTICLE_ID:config.id,ARTICLE_DOMAIN:'food',OPENAI_API_KEY:'test-only-key'};
    let calls = 0;
    const fetcher = async (_url, init) => {
      const body = JSON.parse(init.body); assert.equal(body.store,false); calls++;
      return {ok:true,json:async()=>({id:`response-${calls}`,status:'completed',output:[{content:[{type:'output_text',text:calls===1?'조건과 연구 한계':JSON.stringify({...article,reviewNotes:'이미지 및 의미 검토 미완료'}),annotations:calls===1?urls.map(url=>({type:'url_citation',url})):[]}]}]})};
    };
    await generate(env,{root,fetcher}); assert.equal(calls,2);
    const review = JSON.parse(await readFile(join(root,`generated-drafts/${config.id}/content-reviews/posts/${config.id}.json`),'utf8'));
    assert.equal(review.review.status,'pending'); assert.equal(review.review.reviewer.independence,'same-author');
    const research = await readFile(join(root,`generated-drafts/${config.id}/research.json`),'utf8'); assert.ok(!research.includes(env.OPENAI_API_KEY));
    await assert.rejects(generate(env,{root,fetcher}), {code:'EEXIST'}); assert.equal(calls,2);
  } finally { await rm(root,{recursive:true,force:true}); }
});
