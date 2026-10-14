import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertOllamaAuthoringAllowed} from '../authoring/ollama.mjs';

const ACTIVE_FOOD_FILES=[
  'AGENTS.md',
  'docs/project-instructions/PROJECT_INSTRUCTIONS_FOOD_R8.1.txt',
  'docs/content/FOOD_CONTENT_QUALITY_R1.md',
  'docs/content/DIRECT_AUTHORING_R1.md',
  'authoring/prepare-direct-source.mjs',
  'authoring/food-axis-review.mjs'
];
const LOCKED_TOPICS=['소개','영양소·핵심 성분','꾸준 섭취 변화','궁합·시너지','주의사항','고르는 법·보관법'];
const RESEARCH_NEGATIVE_ENUM=/연구\S{0,3}부족|근거\S{0,3}부족|미확인|일반화\S{0,3}(?:불가|어렵)/u;
const EXPERT_FRAMING=/연구자|대학원생|논문\s*해설|근거평가|연구평가/u;

test('active food authoring inputs do not enumerate expert-review fallback wording',async()=>{
  for(const file of ACTIVE_FOOD_FILES){
    const text=await readFile(file,'utf8');
    assert.doesNotMatch(text,RESEARCH_NEGATIVE_ENUM,`${file} must stay reader-first`);
  }
});

test('food editorial standards stay general-reader-first rather than expert-review-first',async()=>{
  for(const file of ['AGENTS.md','docs/project-instructions/PROJECT_INSTRUCTIONS_FOOD_R8.1.txt','docs/content/FOOD_CONTENT_QUALITY_R1.md','docs/content/DIRECT_AUTHORING_R1.md']){
    const text=await readFile(file,'utf8');
    assert.doesNotMatch(text,EXPERT_FRAMING,`${file} must not restore expert-review framing`);
  }
});

test('active food authoring inputs retain the user-locked six topics',async()=>{
  for(const file of ACTIVE_FOOD_FILES){
    const text=await readFile(file,'utf8');
    for(const topic of LOCKED_TOPICS) assert.match(text,new RegExp(topic.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'u'));
  }
});

test('food direct standards explicitly exclude Queue and Ollama authoring',async()=>{
  for(const file of ['AGENTS.md','docs/project-instructions/PROJECT_INSTRUCTIONS_FOOD_R8.1.txt','docs/content/DIRECT_AUTHORING_R1.md']){
    const text=await readFile(file,'utf8');
    assert.match(text,/direct\/SP1/u);
    assert.match(text,/Queue\/Ollama/u);
  }
});

test('food cannot enter Ollama authoring execution',()=>{
  assert.throws(()=>assertOllamaAuthoringAllowed({domain:'food',category:'음식'}),/E_OLLAMA_FOOD_DISABLED/);
  assert.doesNotThrow(()=>assertOllamaAuthoringAllowed({domain:'medicine',category:'약학'}));
});
