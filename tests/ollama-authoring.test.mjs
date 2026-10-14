import test from 'node:test';
import assert from 'node:assert/strict';
import { validateJob, renderArticle, localRequest, assembleEvidenceArticle, assertOllamaAuthoringAllowed } from '../authoring/ollama.mjs';

const sources=[
  {id:'source-a',title:'공식 자료 A',url:'https://example.org/a',notes:'검토용 자료 A',checkedAt:'2026-10-14'},
  {id:'source-b',title:'공식 자료 B',url:'https://example.org/b',notes:'검토용 자료 B',checkedAt:'2026-10-14'}
];
const job={
  id:'medicine-ollama-fixture',kind:'rewrite',articleId:'277',targetUrl:'https://nhunnhun.tistory.com/277',expectedCurrentTitle:'기존 약학 글',domain:'medicine',category:'약학',topic:'검토용 약학 주제',sources,
  proposedTitle:'검토용 약학 제목',evidenceSummary:'검토용 요약',generationMode:'evidence-bound-outline',
  evidenceOutline:Array.from({length:4},(_,i)=>({id:`section-${i+1}`,heading:`질문 ${i+1}`,paragraphs:['검토용 설명입니다.'],keyPoint:'확인할 내용을 정리합니다.',sourceIds:['source-a','source-b']}))
};
const article={title:'검토용 약학 제목',summary:'독자가 필요한 내용을 살펴봅니다.',reviewNotes:'미승인',sections:Array.from({length:4},(_,i)=>({heading:`질문 ${i+1}`,paragraphs:['검토용 설명입니다.'],keyPoint:'확인할 내용을 정리합니다.',sourceIds:['source-a','source-b']}))};

test('수정 URL·분류·출처 입력 계약',()=>{
  assert.equal(validateJob(job).articleId,'277');
  assert.throws(()=>validateJob({...job,targetUrl:'https://nhunnhun.tistory.com/278'}),/E_OLLAMA_JOB/);
  assert.throws(()=>validateJob({...job,sources:[]}),/E_OLLAMA_SOURCES/);
});

test('음식은 Ollama 작성 실행 경로에서 하드 차단',()=>{
  const food={...job,id:'food-ollama-disabled',articleId:'327',targetUrl:'https://nhunnhun.tistory.com/327',expectedCurrentTitle:'가지',domain:'food',category:'음식'};
  assert.equal(validateJob(food).domain,'food');
  assert.throws(()=>assertOllamaAuthoringAllowed(food),/E_OLLAMA_FOOD_DISABLED/);
  assert.doesNotThrow(()=>assertOllamaAuthoringAllowed(job));
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

test('근거 제한 모드는 제공된 문장 밖의 새 문장을 삽입하지 않음',()=>{
  const plan={sectionIds:job.evidenceOutline.map(s=>s.id).reverse(),title:'임의 제목'};
  const assembled=assembleEvidenceArticle(plan,job);
  assert.equal(assembled.title,job.proposedTitle);
  assert.deepEqual(assembled.sections[0].paragraphs,job.evidenceOutline.at(-1).paragraphs);
  assert.throws(()=>assembleEvidenceArticle({sectionIds:plan.sectionIds.map(()=>plan.sectionIds[0])},job),/E_OLLAMA_OUTLINE/);
  assert.equal(renderArticle(assembled,job).approved,false);
});
