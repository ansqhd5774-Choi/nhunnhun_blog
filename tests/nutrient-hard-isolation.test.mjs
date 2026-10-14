import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { options } from '../authoring/generate.mjs';
import { generateKeyword } from '../authoring/keywords.mjs';
import { runOllama } from '../authoring/ollama.mjs';
import { assertLegacyNutrientAuthoringDisabled, NUTRIENT_EDITORIAL_EXTERNAL_ERROR } from '../authoring/nutrient-editorial-boundary.mjs';

const nutrientJob={
  id:'nutrient-fixture',kind:'rewrite',articleId:'232',targetUrl:'https://nhunnhun.tistory.com/232',expectedCurrentTitle:'기존 제목',
  domain:'nutrient',category:'영양소',topic:'검증용 영양소',proposedTitle:'검증용 제목',evidenceSummary:'검증용 요약',
  sources:[
    {id:'a',title:'A',url:'https://example.org/a',checkedAt:'2026-10-14',notes:'검증용 A'},
    {id:'b',title:'B',url:'https://example.org/b',checkedAt:'2026-10-14',notes:'검증용 B'},
  ],
  evidenceOutline:Array.from({length:4},(_,i)=>({id:`s${i}`,heading:`항목 ${i}`,paragraphs:['검증'],keyPoint:'검증',sourceIds:['a','b']})),
};

test('공통 boundary는 nutrient만 legacy authoring에서 차단',()=>{
  assert.throws(()=>assertLegacyNutrientAuthoringDisabled('nutrient'),new RegExp(NUTRIENT_EDITORIAL_EXTERNAL_ERROR));
  assert.doesNotThrow(()=>assertLegacyNutrientAuthoringDisabled('food'));
});

test('legacy OpenAI writer는 API key 확인보다 먼저 nutrient를 차단',()=>{
  assert.throws(()=>options({ARTICLE_TOPIC:'마그네슘',ARTICLE_ID:'magnesium-test',ARTICLE_DOMAIN:'nutrient'}),/E_NUTRIENT_DIRECT_EDITORIAL_EXTERNAL/);
});

test('verified nutrient keyword는 research·Ollama 호출 전에 차단',async()=>{
  const root=await mkdtemp(join(tmpdir(),'nutrient-keyword-block-'));
  let calls=0;
  try{
    await assert.rejects(generateKeyword('카르노산',{root,fetcher:async()=>{calls++;throw new Error('unexpected fetch');}}),/E_NUTRIENT_DIRECT_EDITORIAL_EXTERNAL/);
    assert.equal(calls,0);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('legacy Ollama nutrient job은 모델 상태 조회 전에 차단',async()=>{
  const root=await mkdtemp(join(tmpdir(),'nutrient-ollama-block-'));
  let calls=0;
  try{
    await mkdir(join(root,'authoring','jobs'),{recursive:true});
    await writeFile(join(root,'authoring','jobs','nutrient-fixture.json'),JSON.stringify(nutrientJob));
    await assert.rejects(runOllama('nutrient-fixture',{root,fetcher:async()=>{calls++;throw new Error('unexpected fetch');}}),/E_NUTRIENT_DIRECT_EDITORIAL_EXTERNAL/);
    assert.equal(calls,0);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('queue producer는 public fetch·evidence보다 먼저 nutrient boundary를 실행',async()=>{
  const source=await readFile(new URL('../authoring/update-producer.mjs',import.meta.url),'utf8');
  const start=source.indexOf('export async function runQueueProducer');
  const boundary=source.indexOf('assertLegacyNutrientAuthoringDisabled(selected.item.domain)',start);
  const publicFetch=source.indexOf("const current=await timed('publicFetchMs'",start);
  const evidence=source.indexOf("let evidence=await timed('evidenceMs'",start);
  assert.ok(start>=0 && boundary>start && publicFetch>boundary && evidence>boundary);
});
