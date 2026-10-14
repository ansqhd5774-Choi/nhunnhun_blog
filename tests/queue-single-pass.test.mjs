import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { writingInstructions,writeSinglePassArticle,singlePassReceipt,NUTRIENT_EDITORIAL_EXTERNAL_ERROR } from '../authoring/queue-single-pass.mjs';
import { assertContentStandard } from '../publishing/content-standards.mjs';
import { checkUpdateSource } from '../publishing/update-core.mjs';

for(const [domain,sizes] of Object.entries({food:[250,400,400,400,400,400],medicine:[400,500,450,350,350,250],disease:[400,500,450,350,350,250]}))
  test(`${domain}: exact six question budgets`,()=>assert.deepEqual(writingInstructions(domain).map(s=>s.targetChars),sizes));

test('nutrient legacy writer instructions are disabled',()=>{
  assert.throws(()=>writingInstructions('nutrient'),new RegExp(NUTRIENT_EDITORIAL_EXTERNAL_ERROR));
});

const raw={title:'시험 정보',lead:'소개입니다.',summary:'핵심 요약입니다.',sections:Array.from({length:6},(_,i)=>({heading:`자유 제목 ${i}`,text:'독자가 읽을 본문입니다.\n\n다른 문단입니다.'}))};
const medicineItem={domain:'medicine',keyword:'시험',articleId:'999'};
const nutrientItem={domain:'nutrient',keyword:'시험 영양소',articleId:'998'};

test('legacy writer refuses nutrient before any model call',async()=>{
  let calls=0;
  await assert.rejects(writeSinglePassArticle(nutrientItem,{query:'test',sources:[]},{model:'fixture',fetcher:async()=>{calls++;throw Error('SHOULD_NOT_CALL');}}),new RegExp(NUTRIENT_EDITORIAL_EXTERNAL_ERROR));
  assert.equal(calls,0);
});

test('one writer call without plan, claim labels, emphasis or repair for supported legacy domain',async()=>{
  let calls=0;
  const article=await writeSinglePassArticle(medicineItem,{query:'test',sources:[]},{model:'fixture',fetcher:async(_url,request)=>{
    calls++;const input=JSON.parse(request.body);assert.equal(input.think,false);
    const prompt=JSON.parse(input.messages[1].content);
    assert.equal(prompt.instructions.reduce((n,s)=>n+s.targetChars,0),2300);
    assert.ok(prompt.instructions.every(s=>s.include.length>20));
    assert.ok(input.messages[0].content.includes('수치·단위'));
    assert.ok(input.messages[0].content.includes('확인되지 않은'));
    assert.ok(!JSON.stringify(input.format).includes('sourceIds'));
    return {ok:true,body:(async function*(){yield Buffer.from(JSON.stringify({done:true,message:{content:JSON.stringify(raw)}})+'\n');})()};}});
  assert.equal(calls,1);assert.equal(article.sections[0].heading,raw.sections[0].heading);
});

test('unparseable writer JSON stops once without repair',async()=>{
  let calls=0;
  await assert.rejects(writeSinglePassArticle(medicineItem,{query:'test',sources:[]},{model:'fixture',fetcher:async()=>{
    calls++;return {ok:true,body:(async function*(){yield Buffer.from(JSON.stringify({done:true,message:{content:'not JSON'}})+'\n');})()};}}),/E_OLLAMA_JSON/);
  assert.equal(calls,1);
});

test('SP1 legacy receipt remains operational for supported domain',()=>{
  const source={id:'auto-999-r55-20261008-12345678',articleId:'999',contentStandard:'SP1',category:'약학',bodyHtml:'<p>본문</p>',targetUrl:'https://nhunnhun.tistory.com/999',expectedCurrentTitle:'기존 제목',title:'새 제목',status:'ready',approved:true};
  const receipt=singlePassReceipt(source,medicineItem,{sources:[]});
  assert.equal(assertContentStandard(source,{manifest:receipt}).semanticVerification,'not-performed');
  assert.equal(assertContentStandard({...source,bodyHtml:'다름'},{manifest:receipt}).skipped,true);
  assert.equal(assertContentStandard(source,{manifest:receipt}).passed,null);
  assert.doesNotThrow(()=>checkUpdateSource(source,source.id+'.json'));
  assert.throws(()=>checkUpdateSource({...source,targetUrl:'https://evil.example/999'},source.id+'.json'),/E_UPDATE_URL/);
  assert.throws(()=>checkUpdateSource({...source,approved:false},source.id+'.json'),/E_UPDATE_APPROVAL/);
  assert.throws(()=>checkUpdateSource({...source,bodyHtml:'<script>alert(1)</script>'},source.id+'.json'));
});

test('nutrient legacy receipt is disabled',()=>{
  const source={id:'auto-998-r55-20261008-12345678',articleId:'998',contentStandard:'SP1',category:'영양소',bodyHtml:'<p>본문</p>'};
  assert.throws(()=>singlePassReceipt(source,nutrientItem,{sources:[]}),new RegExp(NUTRIENT_EDITORIAL_EXTERNAL_ERROR));
});

test('operational producer has no review or repair call',async()=>{
  const code=await readFile(new URL('../authoring/update-producer.mjs',import.meta.url),'utf8');
  for(const removed of ['finalizeReview','patchDraft','buildWritingContract','writeEfficientArticle'])assert.ok(!code.includes(removed));
});
