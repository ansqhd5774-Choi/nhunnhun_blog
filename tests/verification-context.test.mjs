import test from 'node:test';
import assert from 'node:assert/strict';
import {isMeasurementRequest, verificationContext} from '../publishing/verification-context.mjs';
test('광고와 측정 요청만 차단하고 본문과 이미지 요청은 유지한다', () => {
  for (const url of ['https://www.google-analytics.com/g/collect','https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js','https://wcs.naver.net/wcslog.js']) assert.equal(isMeasurementRequest(url),true);
  for (const url of ['https://nhunnhun.tistory.com/359','https://nutriments.tistory.com/4','https://blog.kakaocdn.net/image.jpg','https://google-analytics.com.example.org/image.jpg','invalid']) assert.equal(isMeasurementRequest(url),false);
});
test('페이지를 열기 전에 필터를 설치하고 차단과 허용을 각각 실행한다', async () => {
  let handler; let options; let closed = false;
  const context = {route:async(pattern, fn)=>{assert.equal(pattern,'**/*');handler=fn;},close:async()=>{closed=true;}};
  assert.equal(await verificationContext({newContext:async o=>{options=o;return context;}},{viewport:{width:390,height:844}}),context);
  assert.equal(options.serviceWorkers,'block'); assert.equal(options.viewport.width,390);
  const actions=[];
  for(const url of ['https://wcs.naver.net/wcslog.js','https://blog.kakaocdn.net/image.jpg']) await handler({request:()=>({url:()=>url}),abort:async()=>actions.push('blocked'),continue:async()=>actions.push('allowed')});
  assert.deepEqual(actions,['blocked','allowed']); assert.equal(closed,false);
});
test('필터 설치 실패 시 컨텍스트를 닫고 검증을 중단한다', async () => {
  let closed=false;
  await assert.rejects(verificationContext({newContext:async()=>({route:async()=>{throw new Error('route failure');},close:async()=>{closed=true;}})}),/route failure/);
  assert.equal(closed,true);
});
