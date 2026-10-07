import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseUpdateQueue, assertLocalOnly, assertProtectedDiff, queueSourceId, selectNextQueueItem } from '../authoring/update-queue.mjs';
import { contentDigest } from '../publishing/content-standards.mjs';
import { updateFingerprint } from '../publishing/update-core.mjs';
import { validateJob } from '../authoring/ollama.mjs';

test('queue parses category keyword and canonical existing URL in order',()=>{
  const rows=parseUpdateQueue('음식 - 가지 - https://nhunnhun.tistory.com/327\n영양소 - 아연 - https://nhunnhun.tistory.com/314\n약 - CPC - https://nhunnhun.tistory.com/277\n');
  assert.deepEqual(rows.map(x=>[x.order,x.domain,x.keyword,x.articleId]),[[1,'food','가지','327'],[2,'nutrient','아연','314'],[3,'medicine','CPC','277']]);
  assert.throws(()=>parseUpdateQueue('음식 - 가지 - https://nhunnhun.tistory.com/327\n음식 - 가지2 - https://nhunnhun.tistory.com/327'),/E_QUEUE_DUPLICATE_ARTICLE/);
  assert.throws(()=>parseUpdateQueue('음식 - 가지 - https:\\//nhunnhun.tistory.com/327'),/E_QUEUE_ROW_1/);
});

test('queue automation refuses paid external AI keys and remote Ollama hosts',()=>{
  assert.equal(assertLocalOnly({OLLAMA_HOST:'http://127.0.0.1:11434'}),true);
  assert.equal(assertLocalOnly({OLLAMA_HOST:'http://localhost:11434'}),true);
  assert.throws(()=>assertLocalOnly({OPENAI_API_KEY:'x'}),/E_QUEUE_EXTERNAL_AI_KEY/);
  assert.throws(()=>assertLocalOnly({OLLAMA_HOST:'http://10.0.0.2:11434'}),/E_QUEUE_OLLAMA_NOT_LOCAL/);
});

test('protected diff permits only one update source review and its queue state',()=>{
  assert.equal(assertProtectedDiff(['updates/auto-327.json','content-reviews/updates/auto-327.json','authoring/update-queue-state/327.json'],'327','auto-327'),true);
  assert.throws(()=>assertProtectedDiff(['publishing/update.mjs'],'327','auto-327'),/E_QUEUE_PROTECTED_DIFF/);
});

test('queue source id is stable for the same item date and seed',()=>{
  const item={articleId:'327',keyword:'가지'};
  assert.equal(queueSourceId(item,'2026-10-07','abc'),queueSourceId(item,'2026-10-07','abc'));
  assert.notEqual(queueSourceId(item,'2026-10-07','abc'),queueSourceId(item,'2026-10-07','def'));
});

test('selector skips a publicly verified current R1 update and chooses the next item',async()=>{
  const root=await mkdtemp(join(tmpdir(),'queue-select-'));
  try{
    await mkdir(join(root,'authoring'),{recursive:true});
    await mkdir(join(root,'updates'),{recursive:true});
    await mkdir(join(root,'content-reviews','updates'),{recursive:true});
    await mkdir(join(root,'publishing','update-state'),{recursive:true});
    await writeFile(join(root,'authoring','update-queue.txt'),'음식 - 그래놀라 - https://nhunnhun.tistory.com/310\n음식 - 가지 - https://nhunnhun.tistory.com/327\n');
    const source={id:'current-310',articleId:'310',targetUrl:'https://nhunnhun.tistory.com/310',expectedCurrentTitle:'old',title:'현재 그래놀라 글',representativeImageUrl:'https://example.org/a.jpg',imageReview:[],bodyHtml:'<p>본문</p>',status:'ready',approved:true,category:'음식',contentStandard:'R1'};
    await writeFile(join(root,'updates','current-310.json'),JSON.stringify(source));
    await writeFile(join(root,'content-reviews','updates','current-310.json'),JSON.stringify({sourceDigest:contentDigest(source)}));
    await writeFile(join(root,'publishing','update-state','current-310.json'),JSON.stringify({phase:'updated',url:source.targetUrl,fingerprint:updateFingerprint(source)}));
    const fetcher=async url=>({ok:true,text:async()=>url.includes('/310')?'<meta property="og:title" content="현재 그래놀라 글">':'<meta property="og:title" content="가지">'}); 
    const selected=await selectNextQueueItem(root,{fetcher});
    assert.equal(selected.item.articleId,'327');
    assert.equal(selected.skipped.length,1);
    assert.equal(selected.skipped[0].sourceId,'current-310');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('generic Ollama rewrite job accepts food and medicine categories but keeps URL locked',()=>{
  const base={id:'rewrite-food',kind:'rewrite',articleId:'327',targetUrl:'https://nhunnhun.tistory.com/327',expectedCurrentTitle:'가지',domain:'food',category:'음식',sources:[{id:'a',url:'https://example.org/a',notes:'충분한 근거 설명입니다.',checkedAt:'2026-10-07'},{id:'b',url:'https://example.org/b',notes:'두 번째 근거 설명입니다.',checkedAt:'2026-10-07'}]};
  assert.equal(validateJob(base).domain,'food');
  assert.equal(validateJob({...base,id:'rewrite-drug',articleId:'277',targetUrl:'https://nhunnhun.tistory.com/277',domain:'medicine',category:'약'}).domain,'medicine');
  assert.throws(()=>validateJob({...base,targetUrl:'https://nhunnhun.tistory.com/328'}),/E_OLLAMA_JOB/);
});

test('queue workflow is local-only, one-at-a-time and does not pass paid AI keys',async()=>{
  const workflow=await readFile(new URL('../.github/workflows/ollama-update-queue.yml',import.meta.url),'utf8');
  assert.match(workflow,/workflow_dispatch/);
  assert.match(workflow,/group: nhunnhun-ollama-update-queue/);
  assert.match(workflow,/self-hosted, Windows, X64, tistory-publisher/);
  assert.match(workflow,/update-producer\.mjs/);
  assert.match(workflow,/update-queue-finalize\.mjs/);
  assert.match(workflow,/127\.0\.0\.1:11434/);
  assert.doesNotMatch(workflow,/OPENAI_API_KEY|ANTHROPIC_API_KEY/);
});
