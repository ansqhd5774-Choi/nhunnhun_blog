import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertOllamaAuthoringAllowed} from '../authoring/ollama.mjs';

const EDITORIAL_FOOD_FILES=[
  'AGENTS.md',
  'docs/project-instructions/PROJECT_INSTRUCTIONS_FOOD_R8.1.txt',
  'docs/content/FOOD_CONTENT_QUALITY_R1.md',
  'docs/content/DIRECT_AUTHORING_R1.md',
  'authoring/prepare-direct-source.mjs',
  'authoring/food-axis-review.mjs'
];
const LOCKED_TOPICS=['소개','영양소·핵심 성분','꾸준 섭취 변화','궁합·시너지','주의사항','고르는 법·보관법'];
const READER_FIRST_SIGNALS=[/일반 독자/u,/독자/u,/실제 (?:선택|섭취|행동|의미)/u];

test('active food editorial inputs retain reader-first signals',async()=>{
  for(const file of EDITORIAL_FOOD_FILES){
    const text=await readFile(file,'utf8');
    assert.ok(READER_FIRST_SIGNALS.some((pattern)=>pattern.test(text)),`${file} must retain reader-first guidance`);
  }
});

test('food editorial standards stay general-reader-first',async()=>{
  for(const file of EDITORIAL_FOOD_FILES){
    const text=await readFile(file,'utf8');
    assert.match(text,/독자/u,`${file} must keep the reader as the editorial reference point`);
  }
});

test('editorial food inputs retain the user-locked six topics',async()=>{
  for(const file of EDITORIAL_FOOD_FILES){
    const text=await readFile(file,'utf8');
    for(const topic of LOCKED_TOPICS) assert.match(text,new RegExp(topic.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'u'));
  }
});

test('active execution contracts defer food content to dedicated food standards',async()=>{
  for(const file of ['docs/GENERAL_CHAT_EXECUTION.md','docs/content/DIRECT_AUTHORING_CONTRACT_20261012.md']){
    const text=await readFile(file,'utf8');
    assert.match(text,/PROJECT_INSTRUCTIONS_FOOD_R8\.1\.txt/u);
    assert.match(text,/FOOD_CONTENT_QUALITY_R1\.md/u);
    assert.match(text,/기술 계약/u);
  }
});

test('food direct standards explicitly exclude Queue and Ollama authoring',async()=>{
  for(const file of ['AGENTS.md','docs/project-instructions/PROJECT_INSTRUCTIONS_FOOD_R8.1.txt','docs/content/DIRECT_AUTHORING_R1.md','docs/GENERAL_CHAT_EXECUTION.md','docs/content/DIRECT_AUTHORING_CONTRACT_20261012.md']){
    const text=await readFile(file,'utf8');
    assert.match(text,/direct\/SP1/u);
    assert.match(text,/Queue\/Ollama/u);
  }
});

test('food cannot enter Ollama authoring execution',()=>{
  assert.throws(()=>assertOllamaAuthoringAllowed({domain:'food',category:'음식'}),/E_OLLAMA_FOOD_DISABLED/);
  assert.doesNotThrow(()=>assertOllamaAuthoringAllowed({domain:'medicine',category:'약학'}));
});
