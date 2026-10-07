import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateJob, renderArticle, localRequest } from '../authoring/ollama.mjs';
const job=JSON.parse(await readFile(new URL('../authoring/jobs/carnosic-acid-232-rewrite.json',import.meta.url),'utf8'));
const article={title:'카르노산의 정체와 연구',summary:'허브 성분의 연구와 사용 조건을 살펴봅니다.',reviewNotes:'미승인',sections:Array.from({length:4},(_,i)=>({heading:`질문 ${i+1}`,paragraphs:['카르노산의 정체와 연구 대상은 구분해야 합니다.'],keyPoint:'근거의 적용 범위를 확인합니다.',sourceIds:['identity','jecfa-2025']}))};
test('수정 URL·분류·출처 입력 계약',()=>{
  assert.equal(validateJob(job).articleId,'232');
  assert.throws(()=>validateJob({...job,targetUrl:'https://nhunnhun.tistory.com/233'}),/E_OLLAMA_JOB/);
  assert.throws(()=>validateJob({...job,sources:[]}),/E_OLLAMA_SOURCES/);
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
  await assert.rejects(localRequest({},async(url)=>{calls++;assert.equal(url,'http://127.0.0.1:11434/api/chat');return {ok:true,json:async()=>({done:true,done_reason:'length',message:{content:'{}'}})};}),/E_OLLAMA_INCOMPLETE/);
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
