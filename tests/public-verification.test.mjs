import test from 'node:test';
import assert from 'node:assert/strict';
import {articleUrl,ogAsset,checkMeasurements} from '../publishing/verify-updated-public.mjs';
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
