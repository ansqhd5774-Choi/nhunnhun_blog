import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {spawnSync} from 'node:child_process';
import {changedPaths} from '../authoring/update-producer.mjs';
import { parseUpdateQueue, assertLocalOnly, assertProtectedDiff, queueSourceId, selectNextQueueItem,archiveCompletedSources,restoreArchivedSources } from '../authoring/update-queue.mjs';
import {dispatchQueuedUpdate} from '../authoring/update-queue-dispatch.mjs';
import {consumerMatches} from '../authoring/update-queue-finalize.mjs';
import {classifyWebSource,sourceMainText,externalLinks,isTopicSpecificSource,normalizeExtensionDecisions} from '../authoring/queue-research.mjs';
import {VERIFIED_ALIASES} from '../authoring/keywords.mjs';
import { contentDigest } from '../publishing/content-standards.mjs';
import { updateFingerprint } from '../publishing/update-core.mjs';
import { validateJob } from '../authoring/ollama.mjs';
import '../authoring/queue-research.mjs';
import {missingRequiredModules,requiredModules,renderBody,draftArticle,outputBudget,selectDraftSources} from '../authoring/queue-draft.mjs';
import {assertEditorialSource,renderEditorialPost} from '../publishing/editorial.mjs';
import {DOMAIN_RULES} from '../publishing/content-standards.mjs';
import '../authoring/queue-review.mjs';
import '../authoring/update-producer.mjs';
import '../authoring/update-queue-finalize.mjs';

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

test('selector skips item-level BLOCKED state and continues with the next keyword',async()=>{
  const root=await mkdtemp(join(tmpdir(),'queue-blocked-skip-'));
  try{
    await mkdir(join(root,'authoring','update-queue-state'),{recursive:true});
    await mkdir(join(root,'updates'),{recursive:true});
    await mkdir(join(root,'content-reviews','updates'),{recursive:true});
    await mkdir(join(root,'publishing','update-state'),{recursive:true});
    await writeFile(join(root,'authoring','update-queue.txt'),'음식 - 가지 - https://nhunnhun.tistory.com/327\n음식 - 바나나 - https://nhunnhun.tistory.com/328\n');
    await writeFile(join(root,'authoring','update-queue-state','327.json'),JSON.stringify({status:'BLOCKED_CONTENT',error:'E_QUEUE_DRAFT_VALIDATION'}));
    const fetcher=async()=>({ok:true,text:async()=>'<meta property="og:title" content="현재 글">'});
    const selected=await selectNextQueueItem(root,{fetcher});
    assert.equal(selected.item.articleId,'328');
    assert.equal(selected.skipped[0].articleId,'327');
    assert.equal(selected.skipped[0].blockedStatus,'BLOCKED_CONTENT');
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
  assert.match(workflow,/actions: write/);
  assert.match(workflow,/update-queue-dispatch\.mjs/);
  assert.match(workflow,/group: nhunnhun-tistory-mutation/);
  assert.match(workflow,/CONTENT_UPDATE_QUEUE_ENABLED/);
});

test('GITHUB_TOKEN 원고 commit 뒤 main SHA 확인 후 기존 수정 workflow를 명시 호출',async()=>{
  const sha='a'.repeat(40),calls=[];
  const fetcher=async(url,options)=>{calls.push({url,options});return url.endsWith('main')?{ok:true,json:async()=>({object:{sha}})}:{status:204};};
  assert.equal((await dispatchQueuedUpdate({token:'fixture',commitSha:sha,fetcher})).submitted,true);
  assert.ok(calls[1].url.endsWith('/actions/workflows/update-posts.yml/dispatches'));
  assert.deepEqual(JSON.parse(calls[1].options.body),{ref:'main',inputs:{update:'true'}});
  calls.length=0;
  await assert.rejects(dispatchQueuedUpdate({token:'fixture',commitSha:'b'.repeat(40),fetcher}),/E_QUEUE_SOURCE_DRIFT/);
  assert.equal(calls.length,1);
});
test('DONE에는 같은 SHA의 실제 수동 수정 workflow 성공이 필요',()=>{
  const run={event:'workflow_dispatch',head_sha:'actual',status:'completed',conclusion:'success'};
  assert.equal(consumerMatches(run,'actual'),true);
  assert.equal(consumerMatches({...run,conclusion:'failure'},'actual'),false);
  assert.equal(consumerMatches({...run,event:'push'},'actual'),false);
  assert.equal(consumerMatches(run,'other'),false);
});
test('가지는 eggplant로 조사하고 색인·저작권 페이지를 공식 건강 근거로 승격하지 않음',()=>{
  assert.equal(VERIFIED_ALIASES['가지'].englishQuery,'eggplant');
  assert.deepEqual(classifyWebSource('https://pubmed.ncbi.nlm.nih.gov/30064803/','food'),{kind:'article',role:'context'});
  assert.deepEqual(externalLinks('<a href="https://pubmed.ncbi.nlm.nih.gov/30064803/">초록</a><a href="https://creativecommons.org/licenses/by/4.0/">허가</a>'),[]);
  assert.equal(sourceMainText('<body><nav>메뉴</nav><main><script>hidden()</script><p>조회한 실제 본문</p></main></body>'),'조회한 실제 본문');
});
test('가지 확장 판단은 eggplant 정체를 고정하고 일반 채소 자료만으로 확장을 켜지 않음',()=>{
  const item={keyword:'가지',domain:'food'};
  const evidence={query:'eggplant',sources:[
    {id:'generic',title:'Selecting and Serving Produce Safely',notes:'general fresh produce safety',topicSpecific:false},
    {id:'eggplant',title:'Eggplant nutrition data',notes:'eggplant Solanum melongena nutrition and selection',topicSpecific:true},
  ]};
  assert.equal(isTopicSpecificSource(evidence.sources[0],evidence.query),false);
  assert.equal(isTopicSpecificSource(evidence.sources[1],evidence.query),true);
  const keys=['longTerm','comparison','combinations','products','foodReplacement','essentialNutrient','cultivars','origins','seasonality','cost','folkRemedies','selfCheck','exercise','diet','vulnerableGroups','discontinuation','missedDose','myths','latest'];
  const raw=Object.fromEntries(keys.map(key=>[key,{applies:false,reason:'이번 근거에서는 직접 적용할 이유가 충분하지 않습니다.',sourceIds:[]}]));
  raw.selfCheck={applies:true,reason:'일반 채소 안전 자료에서 스스로 상태를 확인할 수 있습니다.',sourceIds:['generic']};
  raw.products={applies:true,reason:'가지 제품 선택을 직접 다루는 근거입니다.',sourceIds:['eggplant']};
  const out=normalizeExtensionDecisions(item,evidence,raw,[]);
  assert.equal(out.selfCheck.applies,false);
  assert.equal(out.products.applies,true);
  const drift=structuredClone(raw);
  drift.comparison={applies:true,reason:'Chinese cabbage와 비교합니다.',sourceIds:['eggplant']};
  assert.throws(()=>normalizeExtensionDecisions(item,evidence,drift,[]),/E_QUEUE_IDENTITY_DRIFT/);
});

test('R3 output budget leaves JSON completion headroom without changing visible-length guidance',()=>{
  assert.deepEqual(['focused','standard','comprehensive','deep'].map(outputBudget),[3000,4500,6000,7500]);
});

test('draft source bundle is capped and prioritizes topic-specific authoritative evidence',()=>{
  const sources=Array.from({length:9},(_,i)=>({id:`s${i}`,kind:'article',role:'context',topicSpecific:false}));
  sources[8]={id:'official-topic',kind:'official',role:'nutrition',topicSpecific:true};
  sources[7]={id:'trial-topic',kind:'trial',role:'health',topicSpecific:true};
  const selected=selectDraftSources({sources});
  assert.equal(selected.length,7);
  assert.equal(selected[0].id,'official-topic');
  assert.equal(selected[1].id,'trial-topic');
});

test('필수 모듈 누락 목록을 정확히 계산해 재작성 단계가 보완 대상을 알 수 있음',()=>{
  const article={sections:[{modules:['identity','nutrition']},{modules:['safety']}]};
  assert.deepEqual(missingRequiredModules(article,['identity','nutrition','amount','safety','decision']),['amount','decision']);
});

for(const domain of ['food','nutrient','medicine','disease'])test(`${domain}: R3 keeps optional extensions out of mandatory core coverage`,()=>{
  const evidence={query:'example',sources:[{id:'direct',topicSpecific:true}]};
  const raw={comparison:{applies:false,reason:'현재 검색 질문에 비교가 필요하지 않아 포함하지 않습니다.',sourceIds:[]}};
  const excluded=normalizeExtensionDecisions({keyword:'새 주제',domain},evidence,raw,['comparison']);
  assert.equal(excluded.comparison.applies,false);
  assert.deepEqual(requiredModules({domain},excluded),DOMAIN_RULES[domain].core);
  raw.comparison={applies:true,reason:'독자의 선택에 필요한 직접 비교 자료를 확인했습니다.',sourceIds:['direct']};
  const included=normalizeExtensionDecisions({keyword:'새 주제',domain},evidence,raw,['comparison']);
  assert.equal(included.comparison.applies,true);
  assert.deepEqual(requiredModules({domain},included),DOMAIN_RULES[domain].core);
});

for(const domain of ['food','nutrient','medicine','disease'])test(`${domain}: common body obeys existing R4 lead/summary/image contract without fabricated comparisons`,()=>{
  const images=[1,2,3].map(i=>({src:`https://example.org/image-${i}.jpg`,alt:`테스트 이미지 ${i}`,sourcePage:`https://example.org/image-${i}`,author:'fixture',license:'fixture-only'}));
  const evidence={sources:[1,2].map(i=>({id:`ref-${i}`,url:`https://example.org/source-${i}`,title:`자료 ${i}`,checkedAt:'2026-10-07'}))};
  const article={title:'테스트 주제 안내',lead:'이 글은 독자의 현재 질문과 자료를 확인한 범위를 설명하는 도입문입니다.',summary:'확인된 자료 안에서 판단하고 확인되지 않은 수치나 효과는 단정하지 않습니다.',sections:[1,2,3,4].map(i=>({heading:`독자가 확인할 질문 ${i}`,strongPoint:'확인한 대상과 형태를 먼저 구분합니다.',paragraphs:['출처에 제시된 조건을 확인하고 해당하지 않는 상황으로 결과를 확대하지 않습니다.'],keyPoint:'확인된 자료의 적용 범위를 살펴봅니다.',actionPoint:'',contrastPoint:'',sourceIds:['ref-1'],modules:[i===1&&domain==='medicine'?'contraindications':i===1&&domain==='disease'?'red_flags':'identity']}))};
  const {html}=renderBody(article,evidence,images);
  const source={title:article.title,bodyHtml:html,contentStandard:'R1',representativeImageUrl:images[0].src};
  assert.equal(assertEditorialSource(source),source);
  assert.doesNotThrow(()=>renderEditorialPost(source));
  assert.doesNotMatch(html,/<u>|비교해서 볼 부분은/);
  assert.match(html,/<blockquote><strong>핵심만 먼저:<\/strong>/);
  if(domain==='medicine')assert.match(html,/data-kind="caution"/);
  if(domain==='disease')assert.match(html,/data-kind="danger"/);
});

test('R3 draft performs only one repair and fails closed when core answers remain missing',async()=>{
  const item={keyword:'새 주제',domain:'nutrient',category:'영양소',targetUrl:'https://nhunnhun.tistory.com/999'};
  const evidence={query:'new topic',sources:[{id:'direct',title:'조회한 자료',kind:'official',role:'health',scopeNote:'현재 자료 범위만 사용합니다.',notes:'조회한 본문에서 확인할 수 있는 범위입니다.'}]};
  let calls=0;
  const fetcher=async(_url,options)=>{
    calls++;
    const request=JSON.parse(options.body);
    assert.equal(request.format.properties.sections.items.properties.highlightPhrase.minLength,2);
    assert.ok(request.format.properties.claims);
    const bytes=new TextEncoder().encode(JSON.stringify({done:true,message:{content:JSON.stringify({sections:[{id:'actual-answer',modules:['identity']}],plan:{}})}})+'\n');
    return {ok:true,body:(async function*(){yield bytes;})()};
  };
  await assert.rejects(draftArticle(item,evidence,{}, {model:'fixture-only',fetcher}),error=>error.message==='E_QUEUE_DRAFT_VALIDATION'&&error.details.failures.length>0);
  assert.equal(calls,2);
});

test('같은 URL의 완료 source만 archive하고 기존 원장은 보존·복구',async()=>{
  const root=await mkdtemp(join(tmpdir(),'queue-archive-'));
  try {
    for(const dir of ['updates','publishing/update-state','content-reviews/updates'])await mkdir(join(root,dir),{recursive:true});
    const source={id:'prior-327',articleId:'327',targetUrl:'https://nhunnhun.tistory.com/327',bodyHtml:'<p>이전 글</p>'};
    const ledger={phase:'updated',fingerprint:updateFingerprint(source),url:source.targetUrl};
    await writeFile(join(root,'updates/prior-327.json'),JSON.stringify(source));
    await writeFile(join(root,'content-reviews/updates/prior-327.json'),'{}');
    await writeFile(join(root,'publishing/update-state/prior-327.json'),JSON.stringify(ledger));
    const ids=await archiveCompletedSources(root,source);
    assert.deepEqual(ids,['prior-327']);
    await assert.rejects(readFile(join(root,'updates/prior-327.json')),/ENOENT/);
    assert.deepEqual(JSON.parse(await readFile(join(root,'authoring/update-source-archive/prior-327.json'))),source);
    assert.deepEqual(JSON.parse(await readFile(join(root,'publishing/update-state/prior-327.json'))),ledger);
    assert.equal(assertProtectedDiff(['updates/prior-327.json','authoring/update-source-archive/prior-327.json'],'327','new-327',ids),true);
    assert.throws(()=>assertProtectedDiff(['publishing/update-state/prior-327.json'],'327','new-327',ids),/E_QUEUE_PROTECTED_DIFF/);
    await restoreArchivedSources(root,ids);
    assert.deepEqual(JSON.parse(await readFile(join(root,'updates/prior-327.json'))),source);
    await writeFile(join(root,'publishing/update-state/prior-327.json'),JSON.stringify({...ledger,phase:'submitting'}));
    await assert.rejects(archiveCompletedSources(root,source),/E_QUEUE_EXISTING_UPDATE_PENDING/);
    assert.deepEqual(JSON.parse(await readFile(join(root,'updates/prior-327.json'))),source);
  } finally {await rm(root,{recursive:true,force:true});}
});
test('실제 Git porcelain 첫 줄의 선행 공백을 보존해 삭제 경로가 잘리지 않음',async()=>{
  const root=await mkdtemp(join(tmpdir(),'queue-git-status-'));
  try {
    const git=args=>{const result=spawnSync('git',args,{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);};
    git(['init','-q']);git(['config','user.name','queue-test']);git(['config','user.email','queue-test@example.invalid']);
    await writeFile(join(root,'prior-source.json'),'{}');git(['add','--','prior-source.json']);git(['commit','-qm','fixture']);
    await rm(join(root,'prior-source.json'));
    await writeFile(join(root,'new-source.json'),'{}');
    assert.deepEqual(changedPaths(root),['prior-source.json','new-source.json']);
  } finally {await rm(root,{recursive:true,force:true});}
});
