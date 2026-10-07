import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {spawnSync} from 'node:child_process';
import {changedPaths} from '../authoring/update-producer.mjs';
import { parseUpdateQueue, assertLocalOnly, assertProtectedDiff, queueSourceId, selectNextQueueItem,archiveCompletedSources,restoreArchivedSources,shouldRetryState,QUEUE_POLICY_VERSION } from '../authoring/update-queue.mjs';
import {dispatchQueuedUpdate} from '../authoring/update-queue-dispatch.mjs';
import {consumerMatches} from '../authoring/update-queue-finalize.mjs';
import {classifyWebSource,sourceMainText,externalLinks,isTopicSpecificSource,normalizeExtensionDecisions,usdaNutritionSource,classifyEvidenceSufficiency,CURATED_QUEUE_QUERIES} from '../authoring/queue-research.mjs';
import {VERIFIED_ALIASES} from '../authoring/keywords.mjs';
import { contentDigest } from '../publishing/content-standards.mjs';
import { updateFingerprint } from '../publishing/update-core.mjs';
import { validateJob } from '../authoring/ollama.mjs';
import '../authoring/queue-research.mjs';
import {renderBody,validateWrittenArticle,patchableSectionIds,applySectionPatches,mergePlanAndDraft,buildLengthReport,writeArticleFromPlan,reusableImages} from '../authoring/queue-draft.mjs';
import {inferWritingScope,lengthBandForScope,sectionLimitsForScope,selectPlanSources,validateEvidencePlan,buildCoreSkeleton,deterministicClaimType,deterministicClaimRisk} from '../authoring/queue-plan.mjs';
import {assertEditorialSource,renderEditorialPost} from '../publishing/editorial.mjs';
import {DOMAIN_RULES} from '../publishing/content-standards.mjs';
import {R53_SECTION_SPECS,R53_REQUIRED_MODULES,collectInternalLinks} from '../authoring/queue-r53.mjs';
import '../authoring/queue-review.mjs';
import '../authoring/update-producer.mjs';
import '../authoring/update-queue-finalize.mjs';

test('queue parses category keyword and canonical existing URL in order',()=>{
  const rows=parseUpdateQueue('음식 - 가지 - https://nhunnhun.tistory.com/327\n영양소 - 아연 - https://nhunnhun.tistory.com/314\n약 - CPC - https://nhunnhun.tistory.com/277\n');
  assert.deepEqual(rows.map(x=>[x.order,x.domain,x.keyword,x.articleId]),[[1,'food','가지','327'],[2,'nutrient','아연','314'],[3,'medicine','CPC','277']]);
  assert.throws(()=>parseUpdateQueue('음식 - 가지 - https://nhunnhun.tistory.com/327\n음식 - 가지2 - https://nhunnhun.tistory.com/327'),/E_QUEUE_DUPLICATE_ARTICLE/);
  assert.throws(()=>parseUpdateQueue('음식 - 가지 - https:\\//nhunnhun.tistory.com/327'),/E_QUEUE_ROW_1/);
});

test('R5.2 has a pinned canonical English query for every queued keyword',async()=>{
  const queue=parseUpdateQueue(await readFile(new URL('../authoring/update-queue.txt',import.meta.url),'utf8'));
  const missing=[...new Set(queue.map(item=>item.keyword).filter(keyword=>!CURATED_QUEUE_QUERIES[keyword]))];
  assert.deepEqual(missing,[]);
  assert.equal(CURATED_QUEUE_QUERIES['잣'],'pine nut');
  assert.equal(CURATED_QUEUE_QUERIES['CPC'],'cetylpyridinium chloride');
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
    await writeFile(join(root,'authoring','update-queue-state','327.json'),JSON.stringify({status:'BLOCKED_CONTENT',error:'E_QUEUE_DRAFT_VALIDATION',policyVersion:QUEUE_POLICY_VERSION}));
    const fetcher=async()=>({ok:true,text:async()=>'<meta property="og:title" content="현재 글">'});
    const selected=await selectNextQueueItem(root,{fetcher});
    assert.equal(selected.item.articleId,'328');
    assert.equal(selected.skipped[0].articleId,'327');
    assert.equal(selected.skipped[0].blockedStatus,'BLOCKED_CONTENT');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('USDA nutrition rate limit is evidence degradation, not a content failure',async()=>{
  let calls=0;
  const result=await usdaNutritionSource('eggplant',async()=>{calls++;return {ok:false,status:429};},{apiKey:'DEMO_KEY',useCache:false});
  assert.equal(calls,1);
  assert.equal(result.source,null);
  assert.equal(result.status,'rate-limited');
});

test('R5.2 retries repairable legacy blocks but skips current-policy blocks',async()=>{
  assert.equal(shouldRetryState({status:'BLOCKED_CONTENT',error:'E_QUEUE_PLAN_VALIDATION'}),true);
  assert.equal(shouldRetryState({status:'BLOCKED_CONTENT',error:'E_QUEUE_FOOD_NUTRITION_SOURCE',policyVersion:'R5'}),true);
  assert.equal(shouldRetryState({status:'BLOCKED_EVIDENCE',error:'E_QUEUE_RESEARCH_HIGH_QUALITY',policyVersion:'R5.1'}),true);
  assert.equal(shouldRetryState({status:'BLOCKED_GENERATION',error:'E_OLLAMA_LENGTH_LIMIT',policyVersion:'R5.1'}),true);
  assert.equal(shouldRetryState({status:'BLOCKED_CONTENT',error:'E_QUEUE_PLAN_VALIDATION',policyVersion:QUEUE_POLICY_VERSION}),false);
  assert.equal(shouldRetryState({status:'BLOCKED_CONTENT',error:'E_QUEUE_FOOD_NUTRITION_SOURCE',policyVersion:QUEUE_POLICY_VERSION}),false);
  const root=await mkdtemp(join(tmpdir(),'queue-r5-retry-'));
  try{
    await mkdir(join(root,'authoring','update-queue-state'),{recursive:true});
    await mkdir(join(root,'updates'),{recursive:true});
    await mkdir(join(root,'content-reviews','updates'),{recursive:true});
    await mkdir(join(root,'publishing','update-state'),{recursive:true});
    await writeFile(join(root,'authoring','update-queue.txt'),'음식 - 가지 - https://nhunnhun.tistory.com/327\n음식 - 바나나 - https://nhunnhun.tistory.com/328\n');
    await writeFile(join(root,'authoring','update-queue-state','327.json'),JSON.stringify({status:'BLOCKED_CONTENT',error:'E_QUEUE_PLAN_VALIDATION'}));
    const selected=await selectNextQueueItem(root,{fetcher:async()=>({ok:true,text:async()=>'<meta property="og:title" content="현재 글">'})});
    assert.equal(selected.item.articleId,'327');
    assert.equal(selected.recovered,true);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('R5.2 derives claim type and risk in code instead of trusting model labels',()=>{
  const food={domain:'food'};
  const benefitSection={id:'benefits-amount'};
  assert.equal(deterministicClaimType(food,benefitSection,'이 식품은 건강에 도움이 될 수 있다는 연구가 있습니다.'),'benefit');
  assert.equal(deterministicClaimRisk('benefit','이 식품은 건강에 도움이 될 수 있다는 연구가 있습니다.'),'low');
  assert.equal(deterministicClaimType({domain:'nutrient'},{id:'safety-interactions'},'확인되지 않은 상호작용은 단정하지 않습니다.'),'general');
  assert.equal(deterministicClaimRisk('general','확인되지 않은 상호작용은 단정하지 않습니다.'),'low');
  assert.equal(deterministicClaimType({domain:'medicine'},{id:'audience-amount-use'},'1회 500 mg을 복용합니다.'),'dose');
  assert.equal(deterministicClaimRisk('dose','1회 500 mg을 복용합니다.'),'high');
});

test('R5.2 evidence sufficiency is domain-specific instead of requiring two strong sources everywhere',()=>{
  const nutrientSources=[{id:'pmid-1',kind:'article',role:'health',topicSpecific:true,title:'Niacin review',notes:'niacin evidence'}];
  assert.deepEqual(classifyEvidenceSufficiency({domain:'nutrient'},nutrientSources),{directCount:1,strongCount:0,claimMode:'conservative'});
  assert.throws(()=>classifyEvidenceSufficiency({domain:'nutrient'},[{id:'x',kind:'article',role:'health',topicSpecific:false}]),/E_QUEUE_RESEARCH_TOPIC_SPECIFIC/);
  assert.throws(()=>classifyEvidenceSufficiency({domain:'medicine'},nutrientSources),/E_QUEUE_KR_AUTHORIZATION_MISSING/);
  const medicineSources=[{id:'mfds',kind:'official',role:'authorization',topicSpecific:true}];
  assert.equal(classifyEvidenceSufficiency({domain:'medicine'},medicineSources).directCount,1);
});

test('protected diff permits batched queue-state checkpoints without allowing unrelated files',()=>{
  assert.equal(assertProtectedDiff(['authoring/update-queue-state/327.json','authoring/update-queue-state/269.json'],'327','auto-327',[],['269']),true);
  assert.throws(()=>assertProtectedDiff(['authoring/update-queue-state/999.json'],'327','auto-327',[],['269']),/E_QUEUE_PROTECTED_DIFF/);
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

test('R4 scope uses search breadth only as an editorial warning range',()=>{
  const item={keyword:'가지',domain:'food'};
  assert.equal(inferWritingScope(item,'가지 효능·영양·칼로리·보관·고르는 법·조리·주의사항'),'comprehensive');
  assert.deepEqual(lengthBandForScope('comprehensive'),[3500,5200]);
  assert.deepEqual(sectionLimitsForScope('comprehensive'),[6,10]);
});

test('R4 evidence selection preserves role coverage and prioritizes direct authoritative sources',()=>{
  const sources=Array.from({length:9},(_,i)=>({id:`s${i}`,kind:'article',role:'context',topicSpecific:false,title:'context',notes:'context'}));
  sources[8]={id:'nutrition',kind:'nutrition-database',role:'nutrition',topicSpecific:true,title:'Eggplant nutrition',notes:'eggplant 100 g 25 kcal'};
  sources[7]={id:'safety',kind:'official',role:'safety',topicSpecific:false,title:'Produce safety',notes:'fresh produce safety'};
  sources[6]={id:'health',kind:'systematic-review',role:'health',topicSpecific:true,title:'Eggplant health review',notes:'eggplant health evidence'};
  const selected=selectPlanSources({sources},{domain:'food'});
  assert.equal(selected.length,7);
  assert.ok(selected.some(s=>s.id==='nutrition'));
  assert.ok(selected.some(s=>s.id==='safety'));
  assert.ok(selected.some(s=>s.id==='health'));
});

test('R5 deterministic skeleton covers every food core module without asking the model to invent module placement',()=>{
  const item={keyword:'가지',domain:'food'};
  const skeleton=buildCoreSkeleton(item);
  const covered=new Set(skeleton.flatMap(s=>s.modules));
  assert.equal(skeleton.length,5);
  assert.ok(DOMAIN_RULES.food.core.every(module=>covered.has(module)));
  assert.ok(skeleton.some(s=>s.modules.includes('decision')));
});

test('R5 plan validation rejects unsupported high-risk claims and invented numbers while skeleton stays complete',()=>{
  const item={keyword:'가지',domain:'food'};
  const evidence={sources:[
    {id:'nutrition',kind:'nutrition-database',role:'nutrition',topicSpecific:true,title:'Eggplant raw',scopeNote:'100 g',notes:'100 g eggplant contains 25 kcal'},
    {id:'farm',kind:'article',role:'health',topicSpecific:true,title:'Eggplant pesticide residue',scopeNote:'pesticide residue study',notes:'pesticide residue in eggplant crops'},
    {id:'safety',kind:'official',role:'safety',topicSpecific:false,title:'Produce safety',scopeNote:'general produce safety',notes:'wash fresh produce under running water and discard spoiled produce'},
  ]};
  const skeleton=buildCoreSkeleton(item);
  let claim=0;
  const plan={primaryQuestion:'가지의 영양과 섭취 판단에 필요한 핵심 정보를 확인합니다.',readerSituation:'가지의 영양·조리·보관과 주의사항을 한 번에 확인하려는 독자입니다.',nextActions:['확인된 자료 범위에서 조리와 보관 방법을 선택합니다.'],sections:skeleton.map(section=>({
    ...section,
    heading:section.heading,
    question:section.question,
    claims:[{id:`c${++claim}`,text:'확인된 자료 범위에서 실용적인 판단 기준을 설명합니다.',type:'general',risk:'low',sourceIds:['nutrition']}]
  }))};
  plan.sections[0].claims=[{id:'c1',text:'생가지 100g은 약 30kcal입니다.',type:'nutrition',risk:'low',sourceIds:['nutrition']}];
  plan.sections[1].claims=[{id:'c2',text:'가지는 당뇨병을 예방합니다.',type:'disease',risk:'high',sourceIds:['farm']}];
  const failures=validateEvidencePlan(item,evidence,plan,'focused',evidence.sources);
  assert.ok(failures.some(f=>f.code==='PLAN_NUMBER_SOURCE'&&f.claimId==='c1'));
  assert.ok(failures.some(f=>f.code==='PLAN_HIGH_RISK_SOURCE'&&f.claimId==='c2'));
  assert.ok(!failures.some(f=>f.code==='PLAN_CORE_MODULE'));
});

for(const domain of ['food','nutrient','medicine','disease'])test(`${domain}: Queue R4 core modules remain mandatory without forcing optional extensions`,()=>{
  const required=DOMAIN_RULES[domain].core;
  assert.ok(required.length>0);
  assert.ok(!required.includes('comparison')||domain==='disease'&&false);
});

for(const domain of ['food','nutrient','medicine','disease'])test(`${domain}: plan-bound body obeys existing R4 lead/summary/image contract`,()=>{
  const images=[1,2,3].map(i=>({src:`https://example.org/image-${i}.jpg`,alt:`테스트 이미지 ${i}`,sourcePage:`https://example.org/image-${i}`,author:'fixture',license:'fixture-only'}));
  const evidence={sources:[1,2].map(i=>({id:`ref-${i}`,url:`https://example.org/source-${i}`,title:`자료 ${i}`,checkedAt:'2026-10-07'}))};
  const sections=[1,2,3,4].map(i=>({
    id:`s${i}`,heading:`독자가 확인할 질문 ${i}`,question:'확인 질문',modules:[i===1&&domain==='medicine'?'contraindications':i===1&&domain==='disease'?'red_flags':'identity'],
    sourceIds:['ref-1'],claims:[{id:`c${i}`,text:'확인된 자료 범위를 설명합니다.',type:'general',risk:'low',sourceIds:['ref-1']}],
    paragraphs:['확인한 대상과 형태를 먼저 구분하고 자료의 적용 범위를 살펴봅니다. 추가 조건은 확인된 근거 안에서만 설명합니다.'],
    strongPhrase:'대상과 형태를 먼저 구분',highlightPhrase:'자료의 적용 범위',underlinePhrase:'확인된 근거 안에서만'
  }));
  const article={title:'테스트 주제 안내',lead:'이 글은 독자의 현재 질문과 자료를 확인한 범위를 설명하는 도입문입니다.',summary:'확인된 자료 안에서 판단하고 확인되지 않은 수치나 효과는 단정하지 않습니다.',sections};
  const {html}=renderBody(article,evidence,images);
  const source={title:article.title,bodyHtml:html,contentStandard:'R1',representativeImageUrl:images[0].src};
  assert.equal(assertEditorialSource(source),source);
  assert.doesNotThrow(()=>renderEditorialPost(source));
  assert.match(html,/<blockquote><strong>핵심만 먼저:<\/strong>/);
  assert.match(html,/<mark data-tone="key">자료의 적용 범위<\/mark>/);
  if(domain==='medicine')assert.match(html,/data-kind="caution"/);
  if(domain==='disease')assert.match(html,/data-kind="danger"/);
});

test('R4 validation identifies only failed sections and patch merge leaves the rest untouched',()=>{
  const plan={primaryQuestion:'핵심 질문을 확인합니다.',readerSituation:'정보를 확인하려는 독자입니다.',nextActions:['확인된 범위에서 판단합니다.'],sections:[
    {id:'s1',heading:'첫 질문',question:'첫 질문?',modules:['identity'],claims:[{id:'c1',text:'가지는 채소입니다.',type:'general',risk:'low',sourceIds:['a']}]},
    {id:'s2',heading:'둘째 질문',question:'둘째 질문?',modules:['nutrition'],claims:[{id:'c2',text:'생가지 100g은 25kcal입니다.',type:'nutrition',risk:'low',sourceIds:['a']}]},
  ]};
  const draft={title:'가지 정보 안내',lead:'가지의 핵심 정보를 확인하고 근거 범위에서 설명하는 글입니다.',summary:'핵심 내용을 먼저 확인하고 세부 설명은 아래에서 이어집니다.',sections:[
    {id:'s1',paragraphs:['가지는 채소이며 식생활에서 다양하게 사용됩니다. 확인된 자료 범위에서 설명합니다.'],strongPhrase:'가지는 채소',highlightPhrase:'다양하게 사용',underlinePhrase:''},
    {id:'s2',paragraphs:['생가지 100g은 30kcal라고 알려져 있습니다. 영양 수치를 확인합니다.'],strongPhrase:'생가지 100g',highlightPhrase:'영양 수치',underlinePhrase:''},
  ]};
  const failures=validateWrittenArticle(draft,plan);
  assert.ok(failures.some(f=>f.sectionId==='s2'&&f.code==='ARTICLE_UNDECLARED_NUMBER'));
  assert.deepEqual(patchableSectionIds(failures,plan),['s2']);
  const patched=applySectionPatches(draft,{sections:[{id:'s2',paragraphs:['생가지 100g은 25kcal입니다. 영양 수치를 확인합니다.'],strongPhrase:'생가지 100g',highlightPhrase:'영양 수치',underlinePhrase:''}]});
  assert.equal(patched.sections[0].paragraphs[0],draft.sections[0].paragraphs[0]);
  assert.equal(validateWrittenArticle(patched,plan).length,0);
  const article=mergePlanAndDraft(plan,patched);
  article.plan.scope='focused';
  assert.equal(article.sections[1].sourceIds[0],'a');
  assert.ok(buildLengthReport(article,'focused').visibleCharacters>0);
});

test('R5 writer splits one keyword into two concurrent section-generation requests',async()=>{
  const plan={primaryQuestion:'가지 정보를 확인합니다.',readerSituation:'가지에 대한 핵심 질문을 확인하려는 독자입니다.',nextActions:['근거 범위에서 선택합니다.'],sections:[
    {id:'s1',heading:'질문 하나',question:'첫 질문은 무엇인가요?',modules:['identity'],claims:[{id:'c1',text:'가지는 식품입니다.',type:'general',risk:'low',sourceIds:['a']}]},
    {id:'s2',heading:'질문 둘',question:'둘째 질문은 무엇인가요?',modules:['nutrition'],claims:[{id:'c2',text:'영양 정보는 출처 기준으로 봅니다.',type:'nutrition',risk:'low',sourceIds:['a']}]},
    {id:'s3',heading:'질문 셋',question:'셋째 질문은 무엇인가요?',modules:['safety'],claims:[{id:'c3',text:'안전 조건을 확인합니다.',type:'safety',risk:'low',sourceIds:['a']}]},
    {id:'s4',heading:'질문 넷',question:'넷째 질문은 무엇인가요?',modules:['decision'],claims:[{id:'c4',text:'확인된 근거에서 판단합니다.',type:'general',risk:'low',sourceIds:['a']}]},
  ]};
  let active=0,maxActive=0,calls=0;
  const fetcher=async(_url,options)=>{
    calls++;active++;maxActive=Math.max(maxActive,active);
    const req=JSON.parse(options.body),ids=req.format.properties.sections.items.properties.id.enum;
    const withMeta=req.format.required.includes('title');
    await new Promise(resolve=>setTimeout(resolve,20));
    active--;
    const body={sections:ids.map(id=>({id,paragraphs:[`${id} 섹션은 확인된 근거 범위에서 필요한 정보를 설명합니다. 추가 사실을 만들지 않습니다.`],strongPhrase:'확인된 근거',highlightPhrase:'필요한 정보',underlinePhrase:''}))};
    if(withMeta)Object.assign(body,{title:'가지 핵심 정보와 판단 기준',lead:'가지에 대해 확인된 근거 범위에서 필요한 내용을 정리한 안내입니다.',summary:'확인된 자료를 기준으로 영양과 안전 정보를 구분해 판단합니다.'});
    const bytes=new TextEncoder().encode(JSON.stringify({done:true,done_reason:'stop',message:{content:JSON.stringify(body)}})+'\n');
    return {ok:true,body:(async function*(){yield bytes;})()};
  };
  const article=await writeArticleFromPlan({keyword:'가지'},plan,'focused',{model:'fixture-only',fetcher,parallelism:2});
  assert.equal(calls,2);
  assert.equal(maxActive,2);
  assert.deepEqual(article.sections.map(s=>s.id),['s1','s2','s3','s4']);
});

test('R5.2 reuses only previously visual-checked image sets for the same subject',async()=>{
  const root=await mkdtemp(join(tmpdir(),'queue-images-'));
  try{
    await mkdir(join(root,'updates'),{recursive:true});
    await mkdir(join(root,'posts'),{recursive:true});
    const imageReview=[0,1,2].map(i=>({
      src:`https://commons.wikimedia.org/wiki/Special:Redirect/file/Test_${i}.jpg?width=960`,
      alt:`표고버섯 테스트 이미지 ${i}`,
      role:i===0?'hero':i===1?'detail':'context',
      composition:i===0?'closeup':i===1?'cross-section':'context',
      sourcePage:`https://commons.wikimedia.org/wiki/File:Test_${i}.jpg`,
      author:'fixture',license:'CC BY 2.0',visualChecked:true
    }));
    await writeFile(join(root,'posts','shiitake.json'),JSON.stringify({id:'shiitake',title:'표고버섯 영양과 보관법',imageReview}));
    const images=await reusableImages(root,{articleId:'393',keyword:'표고버섯'});
    assert.equal(images.length,3);
    assert.equal(images[0].role,'hero');
    await assert.rejects(reusableImages(root,{articleId:'999',keyword:'배'}),/E_QUEUE_IMAGE_REVIEW_REQUIRED/);
  }finally{await rm(root,{recursive:true,force:true});}
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


test('R5.3 uses the requested six content sections and character budgets',()=>{
  assert.deepEqual(R53_SECTION_SPECS.food.map(x=>[x.heading,x.targetChars]),[
    ['음식(식품) 소개',260],
    ['영양소와 핵심 성분',320],
    ['꾸준히 섭취시 신체 변화',300],
    ['궁합이 잘맞는 음식과 시너지 효과',230],
    ['섭취시 주의사항',230],
    ['좋은 제품을 고르는 방법',160],
  ]);
  assert.deepEqual(R53_SECTION_SPECS.nutrient.map(x=>x.targetChars),[250,260,240,300,230,220]);
  assert.deepEqual(R53_SECTION_SPECS.medicine.map(x=>x.targetChars),[260,300,260,230,270,180]);
  assert.deepEqual(R53_SECTION_SPECS.disease.map(x=>x.targetChars),[260,240,300,230,320,150]);
  for(const domain of ['food','nutrient','medicine','disease']){
    assert.equal(R53_SECTION_SPECS[domain].length,6);
    assert.equal(R53_REQUIRED_MODULES[domain].length,6);
  }
});

test('R5.3 source id is visibly separated from legacy R1 queue ids',()=>{
  assert.match(queueSourceId({articleId:'327',keyword:'가지'},'2026-10-08','abc'),/^auto-327-r54-20261008-/);
});

test('R5.3 finds verified internal links before the writer runs',async()=>{
  const root=await mkdtemp(join(tmpdir(),'queue-r53-links-'));
  try{
    await mkdir(join(root,'authoring'),{recursive:true});
    await mkdir(join(root,'posts'),{recursive:true});
    await mkdir(join(root,'updates'),{recursive:true});
    await writeFile(join(root,'authoring','update-queue.txt'),'영양소 - 비타민 C - https://nhunnhun.tistory.com/93\n음식 - 가지 - https://nhunnhun.tistory.com/327\n');
    const links=await collectInternalLinks(
      root,
      {articleId:'327',keyword:'가지'},
      '<p>가지에는 비타민 C가 포함됩니다.</p>',
      {sources:[]}
    );
    assert.ok(links.some(x=>x.url==='https://nhunnhun.tistory.com/93'&&x.label==='비타민 C'));
  }finally{await rm(root,{recursive:true,force:true});}
});
