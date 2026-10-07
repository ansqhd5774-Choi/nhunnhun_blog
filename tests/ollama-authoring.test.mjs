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
test('로컬 API만 호출하고 출력 한도 종료와 전송 불확실은 재시도하지 않음',async()=>{
  let calls=0;
  await assert.rejects(localRequest({},async(url)=>{calls++;assert.equal(url,'http://127.0.0.1:11434/api/chat');return {ok:true,json:async()=>({done:true,done_reason:'length',message:{content:'{}'}})};}),/E_OLLAMA_INCOMPLETE/);
  assert.equal(calls,1);
  await assert.rejects(localRequest({},async()=>{throw new Error('private detail')}),/^Error: E_OLLAMA_TRANSPORT_STATE_UNKNOWN$/);
});
