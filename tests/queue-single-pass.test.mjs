import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { writingInstructions,writeSinglePassArticle,singlePassReceipt } from '../authoring/queue-single-pass.mjs';
import { assertContentStandard } from '../publishing/content-standards.mjs';
import { checkUpdateSource } from '../publishing/update-core.mjs';

for(const [domain,sizes] of Object.entries({food:[400,500,450,350,350,250],nutrient:[400,500,450,350,350,250],medicine:[400,500,450,350,350,250],disease:[400,500,450,350,350,250]}))
  test(`${domain}: exact six question budgets`,()=>assert.deepEqual(writingInstructions(domain).map(s=>s.targetChars),sizes));
const raw={title:'시험 식품 정보',lead:'식품 소개입니다.',summary:'핵심 요약입니다.',sections:Array.from({length:6},(_,i)=>({heading:`자유 제목 ${i}`,text:'독자가 읽을 본문입니다.\n\n다른 문단입니다.'}))};
const item={domain:'food',keyword:'시험',articleId:'999'};
test('one writer call without plan, claim labels, emphasis or repair',async()=>{
  let calls=0;
  const article=await writeSinglePassArticle(item,{query:'test',sources:[]},{model:'fixture',fetcher:async(_url,request)=>{
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
test('malformed writer response stops once without repair',async()=>{
  let calls=0;
  await assert.rejects(writeSinglePassArticle(item,{query:'test',sources:[]},{model:'fixture',fetcher:async()=>{
    calls++;return {ok:true,body:(async function*(){yield Buffer.from(JSON.stringify({done:true,message:{content:JSON.stringify({...raw,sections:[]})}})+'\n');})()};}}),/E_QUEUE_DRAFT_SCHEMA/);
  assert.equal(calls,1);
});
test('receipt states no semantic review and cannot authorize stale or unrelated sources',()=>{
  const source={id:'auto-999-r55-20261008-12345678',articleId:'999',contentStandard:'SP1',bodyHtml:'<p>본문</p>'};
  const receipt=singlePassReceipt(source,item,{sources:[]});
  assert.equal(assertContentStandard(source,{manifest:receipt}).semanticVerification,'not-performed');
  assert.throws(()=>assertContentStandard({...source,bodyHtml:'다름'},{manifest:receipt}),/E_CONTENT_RECEIPT_INVALID/);
  assert.throws(()=>assertContentStandard({...source,id:'unrelated'},{manifest:receipt}),/E_CONTENT_STANDARD_SCOPE/);
  assert.throws(()=>checkUpdateSource({...source,targetUrl:'https://evil.example/999'},source.id+'.json'));
});
test('operational producer has no review or repair call',async()=>{
  const code=await readFile(new URL('../authoring/update-producer.mjs',import.meta.url),'utf8');
  for(const removed of ['finalizeReview','patchDraft','buildWritingContract','writeEfficientArticle'])assert.ok(!code.includes(removed));
});
