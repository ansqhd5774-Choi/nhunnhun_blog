import test from 'node:test';
import assert from 'node:assert/strict';
import {articleUrl,ogAsset,checkMeasurements,assertImagePayload,verifyInternalLink} from '../publishing/verify-updated-public.mjs';
const e={images:3,h2:10,h3:3,tables:2,highlights:7,faq:5};
const m={overflowPx:0,wideImages:0,images:3,missingAlt:0,brokenImages:0,nonNativeImages:0,h2:10,h3:3,badHeadingStyles:0,tables:2,badTableWraps:0,highlights:7,highlightColors:4,hiddenHighlights:0,faqQ:5,faqA:5,heroPriority:true,badLazyImages:0};
test('only authorized numeric public article URLs',()=>{
  assert.equal(articleUrl('https://nhunnhun.tistory.com/112'),'https://nhunnhun.tistory.com/112');
  for(const s of ['https://nutriments.tistory.com/112','https://nhunnhun.tistory.com/manage','http://nhunnhun.tistory.com/112','https://nhunnhun.tistory.com/112?x=1']) assert.throws(()=>articleUrl(s));
});
test('unwrap trusted Open Graph proxy',()=>assert.equal(ogAsset('https://img1.daumcdn.net/thumb/R800x0/?fname=https%3A%2F%2Fblog.kakaocdn.net%2Fdna%2Fimage.jpg'),'https://blog.kakaocdn.net/dna/image.jpg'));
test('reject deceptive Open Graph hosts',()=>{for(const s of ['https://evil.test/?fname=https://blog.kakaocdn.net/a.jpg','https://blog.kakaocdn.net.evil.test/a.jpg','https://img1.daumcdn.net/?fname=https://evil.test/a.jpg'])assert.throws(()=>ogAsset(s));});
test('complete measurements pass',()=>assert.equal(checkMeasurements(m,e),true));
test('even one pixel document overflow fails',()=>assert.throws(()=>checkMeasurements({...m,overflowPx:1},e),/E_QA_OVERFLOW/));
test('broken or unlabelled image fails',()=>{for(const key of ['brokenImages','missingAlt','nonNativeImages','badLazyImages'])assert.throws(()=>checkMeasurements({...m,[key]:1},e));});
test('computed heading and table styles fail closed',()=>{for(const key of ['badHeadingStyles','badTableWraps'])assert.throws(()=>checkMeasurements({...m,[key]:1},e));});
test('single color and hidden emphasis fail',()=>{assert.throws(()=>checkMeasurements({...m,highlightColors:1},e));assert.throws(()=>checkMeasurements({...m,hiddenHighlights:1},e));});
test('octet-stream is accepted only for actual supported image signatures',()=>{
  const jpg=Buffer.from([255,216,255,224,0,16]);
  assert.equal(assertImagePayload('application/octet-stream',jpg),jpg);
  assert.equal(assertImagePayload('image/jpeg',jpg),jpg);
});
test('invalid bytes fail even with an image MIME type',()=>{
  for(const mime of ['image/jpeg','application/octet-stream']) assert.throws(()=>assertImagePayload(mime,Buffer.from('<html>not an image</html>')),/E_QA_IMAGE_SIGNATURE/);
});
test('HTML response is not allowed even with a copied signature',()=>assert.throws(()=>assertImagePayload('text/html',Buffer.from([255,216,255,224,0,16])),/E_QA_IMAGE_TYPE/));

test('internal-link verifier retries transient 503 and then passes',async()=>{
  let calls=0;
  const request={get:async()=>{calls++;return calls===1
    ? {ok:()=>false,status:()=>503,url:()=> 'https://nhunnhun.tistory.com/374'}
    : {ok:()=>true,status:()=>200,url:()=> 'https://nhunnhun.tistory.com/374'};}};
  assert.equal(await verifyInternalLink(request,'https://nhunnhun.tistory.com/374',async()=>{}),true);
  assert.equal(calls,2);
});
test('internal-link verifier still fails permanent 404',async()=>{
  const request={get:async()=>({ok:()=>false,status:()=>404,url:()=> 'https://nhunnhun.tistory.com/374'})};
  await assert.rejects(()=>verifyInternalLink(request,'https://nhunnhun.tistory.com/374',async()=>{}),/E_QA_INTERNAL_LINK/);
});
import { publishedUrls } from '../publishing/published-url.mjs';

test('publication discovery normalizes title whitespace and deduplicates numeric URLs', () => {
  assert.deepEqual(publishedUrls([
    {text:'은행\n 하루 몇 알',href:'https://nhunnhun.tistory.com/399?category=1'},
    {text:'은행 하루 몇 알',href:'https://nhunnhun.tistory.com/399#comments'},
    {text:'은행 하루 몇 알',href:'https://other.tistory.com/399'},
    {text:'다른 글',href:'https://nhunnhun.tistory.com/400'},
    {text:'은행 하루 몇 알',href:'https://nhunnhun.tistory.com/manage/post/399'}
  ], '은행 하루 몇 알'), ['https://nhunnhun.tistory.com/399']);
});
test('publication discovery keeps ambiguous and missing results unresolved', () => {
  const links=[399,400].map(id=>({text:'은행 하루 몇 알',href:`https://nhunnhun.tistory.com/${id}`}));
  assert.equal(publishedUrls(links,'은행 하루 몇 알').length,2);
  assert.deepEqual(publishedUrls(links,'없는 글'),[]);
  assert.deepEqual(publishedUrls(links,''),[]);
});
