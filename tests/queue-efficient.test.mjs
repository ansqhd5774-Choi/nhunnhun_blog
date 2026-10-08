import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { buildWritingContract, writeEfficientArticle, patchDraft, assembleDraft } from '../authoring/queue-efficient.mjs';
import { createStageCache, recordAttempt } from '../authoring/queue-checkpoint.mjs';
import { modelMetrics } from '../authoring/queue-ollama.mjs';
import { highRiskClaims, finalizeReview, reviewDetails } from '../authoring/queue-review.mjs';
import { DOMAIN_RULES } from '../publishing/content-standards.mjs';
import { shouldRetryState } from '../authoring/update-queue.mjs';
import { finalizeQueuedUpdate } from '../authoring/update-queue-finalize.mjs';
import { renderR53Body } from '../authoring/queue-r53.mjs';
import { conservativeExtensions } from '../authoring/queue-draft.mjs';
import { REVIEW_CHECKS } from '../publishing/standards/common.mjs';
import { todayInSeoul } from '../publishing/content-standards.mjs';
import { validateClaimSupport } from '../authoring/queue-evidence-support.mjs';
import { sourceMainText } from '../authoring/queue-research.mjs';

const evidence={sources:[
  {id:'official-a',url:'https://nedrug.mfds.go.kr/test',title:'공식 주제 안전 안내',notes:'해당 주제의 안전 조건과 사용 범위를 확인한 자료 발췌입니다. 적용 대상에 따라 조건을 구분합니다.',kind:'official',role:'authorization',topicSpecific:true},
  {id:'official-b',url:'https://example.gov/health',title:'공식 건강 안내',notes:'해당 주제에 관한 건강 정보와 연구의 한계를 설명한 자료입니다. 확인된 정보와 불확실한 정보를 구분합니다.',kind:'official',role:'health',topicSpecific:true}
]};
const item=domain=>({domain,keyword:'시험 주제',articleId:'999'});
const section=spec=>({id:spec.id,paragraphs:[`정체를 먼저 확인합니다. 적용 조건을 구분합니다. 근거 범위를 살핍니다. 선택 기준을 확인합니다. ${spec.heading}에 관한 직접 자료의 내용과 한계를 구분해 설명합니다.`],answers:spec.modules.map(module=>({module,quote:'정체를 먼저 확인합니다. 적용 조건을 구분합니다.'})),sourceIds:['official-a'],anchors:['정체를 먼저 확인','적용 조건을 구분','근거 범위를 살핍','선택 기준을 확인']});
const draft=contract=>({title:'시험 주제의 근거와 선택 안내',lead:'확인된 자료를 바탕으로 주제의 의미와 선택 조건을 안내합니다.',summary:'주제의 적용 대상과 근거 범위를 먼저 확인하고 자신의 상황에 맞게 선택합니다.',sections:contract.sections.map(section)});
const response=value=>({ok:true,body:(async function*(){yield Buffer.from(JSON.stringify({done:true,message:{content:JSON.stringify(value)},eval_count:100,eval_duration:1e9})+'\n');})()});

for(const domain of ['food','nutrient','medicine','disease'])test(`${domain}: writer and validator share core without forced ranking/synergy`,()=>{
  const contract=buildWritingContract(item(domain),evidence);
  assert.deepEqual(contract.required,DOMAIN_RULES[domain].core);
  assert.deepEqual(new Set(contract.sections.flatMap(s=>s.modules)),new Set(contract.required));
  assert.ok(contract.sections.every(s=>!/TOP|Best|브랜드|시너지|한 달|최소~최대/.test(s.heading)));
});
test('evidence shortage stops before any model call',()=>assert.throws(()=>buildWritingContract(item('food'),{sources:[]}),/E_QUEUE_PLAN_EVIDENCE/));
test('medicine requires actual Korean authorization source',()=>assert.throws(()=>buildWritingContract(item('medicine'),{sources:evidence.sources.map(s=>({...s,url:'https://example.gov/'+s.id}))}),/E_QUEUE_KR_AUTHORIZATION/));
test('missing section triggers exactly one scoped patch and preserves all normal sections',async()=>{
  const contract=buildWritingContract(item('food'),evidence),raw=draft(contract),missing=raw.sections.pop(),requests=[];
  const fetcher=async(_url,request)=>{requests.push(JSON.parse(request.body));return response(requests.length===1?raw:{sections:[missing]});};
  const result=await writeEfficientArticle(contract,{model:'fixture',fetcher});
  assert.equal(requests.length,2);assert.equal(result.repaired,true);
  assert.deepEqual(result.article.sections[0].paragraphs,raw.sections[0].paragraphs);
  assert.equal(JSON.parse(requests[1].messages[1].content).contract.sections.length,1);
});
test('patch cannot replace an unrelated section',async()=>{
  const contract=buildWritingContract(item('food'),evidence),raw=draft(contract);
  await assert.rejects(patchDraft(raw,contract,[{sectionId:contract.sections[0].id}],{model:'fixture',fetcher:async()=>response({sections:[raw.sections[1]]})}),/E_QUEUE_PATCH_SCOPE/);
});
test('failed patch terminates without whole-draft regeneration',async()=>{
  const contract=buildWritingContract(item('food'),evidence),raw=draft(contract);raw.sections.pop();let calls=0;
  await assert.rejects(writeEfficientArticle(contract,{model:'fixture',fetcher:async()=>{calls++;return response(calls===1?raw:{sections:[]});}}),/E_QUEUE_PATCH_SCOPE/);
  assert.equal(calls,2);
});
test('emphasis selection chooses exact excerpts without rewriting prose',async()=>{
  const contract=buildWritingContract(item('food'),evidence),raw=draft(contract),requests=[];
  raw.sections.forEach(s=>delete s.anchors);
  const fetcher=async(_url,request)=>{
    const body=JSON.parse(request.body);requests.push(body);
    if(requests.length===1)return response(raw);
    const choices=JSON.parse(body.messages[1].content);
    return response(Object.fromEntries(choices.map(s=>[s.sectionId,s.candidates.slice(0,4).map(c=>c.id)])));
  };
  const result=await writeEfficientArticle(contract,{model:'fixture',fetcher});
  assert.equal(requests.length,2);assert.equal(result.repaired,false);
  assert.deepEqual(result.article.sections.map(s=>s.paragraphs),raw.sections.map(s=>s.paragraphs));
  assert.ok(result.article.sections.every(s=>s.anchors.every(a=>s.paragraphs.join(' ').includes(a))));
  assert.equal(requests[1].options.num_ctx,12288);
});
test('food high-risk prose is inspected without predeclared claims',()=>{
  const claims=highRiskClaims({sections:[{id:'food-safety',sourceIds:['official-a'],paragraphs:['이 식품은 질병을 예방한다고 주장한 문장입니다.']}]});
  assert.equal(claims.length,1);assert.equal(claims[0].sectionId,'food-safety');
});
test('unknown citations never receive automatic source assignment',()=>{
  const contract=buildWritingContract(item('food'),evidence),raw=draft(contract);raw.sections[0].sourceIds=['invented'];
  assert.throws(()=>assembleDraft(raw,contract),/E_QUEUE_DRAFT_VALIDATION/);
});
test('checkpoint reuses only same inputs within TTL and does not cache failures',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'producer-cache-'));let now=1000,calls=0;
  try{
    const cache=createStageCache(dir,{now:()=>now,maxAgeMs:100}),action=async()=>++calls;
    assert.equal(await cache('draft',{policy:'a'},action),1);
    assert.equal(await cache('draft',{policy:'a'},action),1);
    assert.equal(await cache('draft',{policy:'b'},action),2);
    now=1200;assert.equal(await cache('draft',{policy:'a'},action),3);
    await assert.rejects(cache('draft',{policy:'failure'},async()=>{throw Error('failed');}),/failed/);
    assert.equal(await cache('draft',{policy:'failure'},action),4);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('metrics distinguish absent duration from zero and calculate decode rate',()=>{
  const metrics=modelMetrics({eval_count:100,eval_duration:2e9,load_duration:0},{purpose:'draft',model:'fixture',elapsedMs:2400});
  assert.equal(metrics.tokensPerSecond,50);assert.equal(metrics.loadMs,0);assert.equal(metrics.promptMs,null);
});
test('attempt history includes failures and does not count duplicate writes twice',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'producer-history-'));
  try{
    const metrics={attemptId:'one',totalMs:100,modelCalls:[],cacheHits:[],result:'failed'};
    await recordAttempt(dir,'999',metrics);
    assert.equal((await recordAttempt(dir,'999',metrics)).totalExecutionMs,100);
    assert.equal((await recordAttempt(dir,'999',{...metrics,attemptId:'two',totalMs:50,result:'passed'})).totalExecutionMs,150);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('semantic reviewer failure never becomes automatic PASS',async()=>{
  const target={...item('food'),category:'음식'},contract=buildWritingContract(target,evidence),article=assembleDraft(draft(contract),contract);
  const base=JSON.parse(await readFile(new URL('../authoring/update-source-archive/auto-327-r53-20261008-e1ff762a.json',import.meta.url),'utf8'));
  const enriched={...evidence,query:'test topic',sources:evidence.sources.map(s=>({...s,checkedAt:todayInSeoul(),scopeNote:'현재 주제에 적용할 수 있는 자료의 대상과 한계를 확인한 공식 자료다.'}))};
  const rendered=renderR53Body(article,enriched,base.imageReview);
  const source={...base,id:'auto-999-r54-test',articleId:'999',targetUrl:'https://nhunnhun.tistory.com/999',title:article.title,bodyHtml:rendered.html};
  const details=await reviewDetails(target,article,enriched,{},{});
  let calls=0;
  const checks=Object.fromEntries(REVIEW_CHECKS.filter(k=>k!=='images').map(k=>[k,{status:k==='accuracy'?'fail':'pass',note:'실제 본문과 근거를 대조한 검토 결과입니다.'}]));
  await assert.rejects(finalizeReview(source,target,enriched,conservativeExtensions(target),article,contract.required,details,rendered.glossary,
    {model:'fixture',fetcher:async()=>{calls++;return response({checks,warningResolutions:[],issues:[{sectionId:article.sections[1].id,reason:'이 절의 주장과 제공된 근거가 일치하지 않습니다.'}]});}}),/E_QUEUE_SEMANTIC_REVIEW_FAILED/);
  assert.equal(calls,1);
});
test('a PASS label cannot approve a quotation from the wrong source or unsupported number',()=>{
  const article={claims:[{id:'claim',sectionId:'storage',text:'10°C 아래에서는 보관에 주의한다.',sourceIds:['fda']}]};
  const sources={sources:[{id:'fda',notes:'신선 농산물은 흐르는 물로 씻고 비누나 세제를 사용하지 않는다.'},{id:'storage',notes:'10°C 아래에서 여러 날 보관하면 저온장해가 생길 수 있다.'}]};
  assert.equal(validateClaimSupport(article,sources,[{claimId:'claim',sourceId:'storage',status:'pass',quote:sources.sources[1].notes}]).length,1);
  assert.equal(validateClaimSupport(article,sources,[{claimId:'claim',sourceId:'fda',status:'pass',quote:sources.sources[0].notes}]).length,1);
  article.claims[0].sourceIds=['storage'];
  assert.equal(validateClaimSupport(article,sources,[{claimId:'claim',sourceId:'storage',status:'pass',quote:sources.sources[1].notes}]).length,0);
});
test('article cache identity ignores surrounding widgets but detects a body change',()=>{
  const first='<body><div class="contents_style">실제 본문</div><footer>시각 1</footer></body>';
  const second=first.replace('시각 1','시각 2');
  assert.equal(sourceMainText(first,{article:true}),sourceMainText(second,{article:true}));
  assert.notEqual(sourceMainText(first,{article:true}),sourceMainText(first.replace('실제 본문','수정 본문'),{article:true}));
});
test('uncertain public mutation cannot be retried by policy upgrade',()=>assert.equal(shouldRetryState({status:'BLOCKED',policyVersion:'R5.3',error:'E_QUEUE_MUTATION_UNCERTAIN',publicMutation:null}),false));
test('pending consumer exits without sleep or mutation',async()=>{
  const previous=globalThis.fetch,requests=[];
  globalThis.fetch=async(url,options)=>{requests.push(options?.method??'GET');
    if(String(url).includes('/contents/updates/'))return {ok:true,json:async()=>({content:Buffer.from(JSON.stringify({articleId:'999',targetUrl:'https://nhunnhun.tistory.com/999'})).toString('base64')})};
    if(String(url).includes('/contents/publishing/'))return {status:404};
    return {ok:true,json:async()=>({workflow_runs:[{event:'workflow_dispatch',head_sha:'a'.repeat(40),status:'queued'}]})};};
  try{const result=await finalizeQueuedUpdate({sourceId:'test-999',articleId:'999',token:'fixture',commitSha:'a'.repeat(40)});
    assert.equal(result.status,'PENDING');assert.ok(requests.every(method=>method==='GET'));
  }finally{globalThis.fetch=previous;}
});
test('direct workflow holds no publisher runner while waiting on consumer completion',async()=>{
 const w=parse(await readFile(new URL('../.github/workflows/direct-author-update.yml',import.meta.url),'utf8'));
 assert.equal(w.on.workflow_run,undefined);assert.equal(w.jobs.finalize,undefined);assert.equal(w.jobs.reconcile,undefined);
 assert.equal(w.jobs.dispatch.timeoutMinutes,undefined);assert.equal(w.jobs.dispatch['timeout-minutes'],5);
 assert.deepEqual(w.jobs.dispatch['runs-on'],['self-hosted','Windows','X64','tistory-validation']);
 assert.ok(w.jobs.dispatch.steps.some(x=>x.run?.includes('node authoring/direct-dispatch.mjs')));
});

test('editor summaries never become writer source facts',()=>{
 const contract=buildWritingContract(item('food'),{...evidence,r53SectionEvidence:{s1:{facts:['unsupported 999']}}});
 assert.ok(!JSON.stringify(contract).includes('999'));
 assert.ok(contract.sections.some(s=>s.facts.length));
});
