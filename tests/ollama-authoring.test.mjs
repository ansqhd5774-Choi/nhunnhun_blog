import test from 'node:test';
import assert from 'node:assert/strict';
import { validateJob, renderArticle, localRequest, assembleEvidenceArticle, assertOllamaAuthoringAllowed } from '../authoring/ollama.mjs';

const sources=[
  {id:'identity',title:'Identity source',url:'https://example.org/identity',checkedAt:'2026-10-14',notes:'검증용 식별 자료'},
  {id:'jecfa-2025',title:'Safety source',url:'https://example.org/safety',checkedAt:'2026-10-14',notes:'검증용 안전 자료'},
];
const evidenceOutline=Array.from({length:4},(_,i)=>({id:`q${i+1}`,heading:`질문 ${i+1}`,paragraphs:[`검증용 문단 ${i+1}`],keyPoint:`검증 포인트 ${i+1}`,sourceIds:['identity','jecfa-2025']}));
const job={id:'legacy-food-fixture',kind:'rewrite',articleId:'232',targetUrl:'https://nhunnhun.tistory.com/232',expectedCurrentTitle:'기존 제목',domain:'food',category:'음식',topic:'검증용 주제',proposedTitle:'카르노산 검증용 제목',evidenceSummary:'검증용 요약',generationMode:'evidence-bound-outline',sources,evidenceOutline};
const article={title:'카르노산의 정체와 연구',summary:'허브 성분의 연구와 사용 조건을 살펴봅니다.',reviewNotes:'미승인',sections:Array.from({length:4},(_,i)=>({heading:`질문 ${i+1}`,paragraphs:['카르노산의 정체와 연구 대상은 구분해야 합니다.'],keyPoint:'근거의 적용 범위를 확인합니다.',sourceIds:['identity','jecfa-2025']}))};

test('수정 URL·분류·출처 입력 계약',()=>{
  assert.equal(validateJob(job).articleId,'232');
  assert.throws(()=>validateJob({...job,targetUrl:'https://nhunnhun.tistory.com/233'}),/E_OLLAMA_JOB/);
  assert.throws(()=>validateJob({...job,sources:[]}),/E_OLLAMA_SOURCES/);
});
test('음식은 Ollama 작성 실행 경로에서 하드 차단',()=>{
  assert.throws(()=>assertOllamaAuthoringAllowed(job),/E_OLLAMA_FOOD_DISABLED/);
  assert.doesNotThrow(()=>assertOllamaAuthoringAllowed({...job,id:'medicine-fixture',domain:'medicine',category:'약학'}));
});
test('구조화 텍스트는 HTML escape하고 대상 URL과 미승인을 유지',()=>{
  const source=renderArticle({...article,summary:'<script>bad()</script>'},job);
  assert.ok(source.bodyHtml.includes('&lt;script&gt;')); assert.ok(!source.bodyHtml.includes('<script>'));
  assert.equal(source.targetUrl,job.targetUrl); assert.equal(source.status,'draft'); assert.equal(source.approved,false);
});
test('만든 출처와 중복 소제목은 중단',()=>{
  assert.throws(()=>renderArticle({...article,sections:article.sections.map(s=>({...s,sourceIds:['invented']}))},job),/E_OLLAMA_SECTION/);
  assert.throws(()=>renderArticle({...article,sections:article.sections.map(s=>({...s,heading:'중복'}))},job),/E_OLLAMA_SECTION/);
});
test('카르노산 원고의 확인된 오해를 재생산하면 승인 대신 중단',()=>{
  assert.throws(()=>renderArticle({...article,title:job.expectedCurrentTitle},job),/E_OLLAMA_CLAIM_REVIEW/);
  assert.throws(()=>renderArticle({...article,summary:'카르노산 11.25mg을 사용합니다.'},job),/E_OLLAMA_CLAIM_REVIEW/);
});
test('로컬 API만 호출하고 출력 한도 종료와 전송 불확실은 재시도하지 않음',async()=>{
  let calls=0;
  await assert.rejects(localRequest({},async(url)=>{calls++;assert.equal(url,'http://127.0.0.1:11434/api/chat');return {ok:true,json:async()=>({done:true,done_reason:'length',eval_count:3539,message:{content:'{}'}})};}),error=>error.message==='E_OLLAMA_LENGTH_LIMIT'&&error.details.outputTokens===3539);
  assert.equal(calls,1);
  await assert.rejects(localRequest({},async()=>{throw new Error('private detail')}),/^Error: E_OLLAMA_TRANSPORT_STATE_UNKNOWN$/);
});
test('스트리밍 JSON이 잘린 청크로 와도 모으고 진행과 완료를 확인',async()=>{
  const lines=[{done:false,message:{content:'{"title":'}},{done:true,done_reason:'stop',message:{content:'"완료"}'}}].map(v=>JSON.stringify(v)+'\n').join('');
  const bytes=new TextEncoder().encode(lines); let progress;
  const result=await localRequest({stream:true},async()=>({ok:true,body:(async function*(){yield bytes.slice(0,13);yield bytes.slice(13);})()}),async p=>{progress=p;});
  assert.equal(result.message.content,'{"title":"완료"}'); assert.equal(progress.chunks,2);
  await assert.rejects(localRequest({stream:true},async()=>({ok:true,body:(async function*(){yield new TextEncoder().encode(JSON.stringify({done:false,message:{content:'partial'}})+'\n');})()})),/E_OLLAMA_INCOMPLETE/);
});
test('근거 제한 모드는 Ollama의 새로운 효능 문장을 삽입하지 않음',()=>{
  const plan={sectionIds:job.evidenceOutline.map(s=>s.id).reverse(),title:'근거 없는 치료 제목'};
  const assembled=assembleEvidenceArticle(plan,job);
  assert.equal(assembled.title,job.proposedTitle);
  assert.deepEqual(assembled.sections[0].paragraphs,job.evidenceOutline.at(-1).paragraphs);
  assert.throws(()=>assembleEvidenceArticle({sectionIds:plan.sectionIds.map(()=>plan.sectionIds[0])},job),/E_OLLAMA_OUTLINE/);
  assert.equal(renderArticle(assembled,job).approved,false);
});
