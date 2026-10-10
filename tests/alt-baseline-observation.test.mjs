import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {waitAltPublicAssets} from '../publishing/alt-public-assets.mjs';
import {captureAltSnapshot,captureAltBaseline,assertAltPublicSnapshot} from '../publishing/alt-maintenance-public.mjs';
import {runAltMaintenance} from '../publishing/alt-maintenance-runner.mjs';
const documentFixture=(fonts,images)=>({fonts:{ready:fonts},querySelectorAll:()=>[{getClientRects:()=>[{}],querySelectorAll:()=>images}]});
async function withDocument(doc,action){const old=globalThis.document;globalThis.document=doc;try{return await action();}finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}}
test('font wait and image decode each stop with observation timeout; never treat pending as loaded',async()=>{
 await withDocument(documentFixture(new Promise(()=>{}),[]),()=>assert.rejects(waitAltPublicAssets({fontTimeoutMs:5,imageTimeoutMs:5}),/ASSET_OBSERVATION_TIMEOUT/));
 await withDocument(documentFixture(Promise.resolve(),[{decode:()=>new Promise(()=>{})}]),()=>assert.rejects(waitAltPublicAssets({fontTimeoutMs:5,imageTimeoutMs:5}),/ASSET_OBSERVATION_TIMEOUT/));
});
test('settled decode only completes observation and existing loaded assertion still rejects broken images',async()=>{
 await withDocument(documentFixture(Promise.resolve(),[{decode:async()=>{throw Error('broken');}}]),async()=>assert.deepEqual(await waitAltPublicAssets({fontTimeoutMs:5,imageTimeoutMs:5}),{fontsSettled:true,imageCount:1}));
 const baseline={bodySha256:'body',metadataSha256:'meta',images:[{srcSha256:'src',altSha256:'alt',loaded:true}],overflowPx:0};assert.throws(()=>assertAltPublicSnapshot({...baseline,images:[{...baseline.images[0],loaded:false}]},baseline,[]),/IMAGE_DRIFT/);
});
test('capture identifies read-only asset wait failure and closes only its owned anonymous context once',async()=>{
 let creates=0,closes=0;const logs=[];const page={goto:async()=>({ok:()=>true,text:async()=>'<div>private</div>'}),url:()=> 'https://nhunnhun.tistory.com/352',locator:()=>({waitFor:async()=>{}}),evaluate:async()=>{throw Error('E_ALT_PUBLIC_ASSET_OBSERVATION_TIMEOUT');}};
 const context={route:async()=>{},newPage:async()=>page,close:async()=>{closes++;}};const browser={newContext:async()=>{creates++;return context;}};
 await assert.rejects(captureAltSnapshot(browser,{articleId:'352',targetUrl:'https://nhunnhun.tistory.com/352'},390,null,{log:x=>logs.push(x)}),/ASSET_OBSERVATION_TIMEOUT/);assert.equal(creates,1);assert.equal(closes,1);assert.ok(logs.some(x=>x.includes('public-390-font-wait')));assert.ok(logs.some(x=>x.includes('context-close')));assert.ok(!logs.join().includes('nhunnhun.tistory.com'));assert.ok(!logs.join().includes('private'));
});
test('baseline observation timeout prevents editor content input, checkpoint and final click',async()=>{
 const events=[];const locator=selector=>({count:async()=>1,isEnabled:async()=>true,and(){return this;},waitFor:async()=>{},click:async()=>events.push(selector)});
 const page={locator,getByRole:(_,{name})=>locator(name),keyboard:{press:async()=>events.push('press'),insertText:async()=>events.push('input')}};
 const metadata={title:'기존 제목',category:'음식',tags:['식품'],representativeImage:'style',visibility:'20'};
 await assert.rejects(runAltMaintenance({page,source:{id:'example-alt',title:metadata.title},originalHtml:'not staged',selectMode:async()=>{},ledger:{read:async()=>null,write:async()=>events.push('checkpoint')},assertSource:()=>{},capturePublicBaseline:async()=>{throw Error('E_ALT_PUBLIC_ASSET_OBSERVATION_TIMEOUT');},finalize:async()=>events.push('finalize'),prepare:async()=>{},open:async()=>{},observe:async()=>({metadata}),log:()=>{}}),/ASSET_OBSERVATION_TIMEOUT/);
 assert.deepEqual(events,['취소']);
});
test('metadata and DOM reads are bounded, mutation and context creation/close have no race or retry',()=>{
 const runner=readFileSync('publishing/alt-maintenance-runner.mjs','utf8');assert.ok(runner.includes("observeUpdateStage('alt-metadata-before'"));assert.ok(runner.includes("observeUpdateStage('alt-metadata-after'"));assert.ok(!runner.includes('Promise.race'));assert.ok(runner.includes('await submit.click();'));
 const pub=readFileSync('publishing/alt-maintenance-public.mjs','utf8');assert.ok(pub.includes("step('response-text'"));assert.ok(pub.includes("step('dom-observe'"));assert.ok(pub.includes("step('context-close',()=>context.close())"));assert.ok(!pub.includes('Promise.race'));
 const update=readFileSync('publishing/update.mjs','utf8');assert.ok(update.includes("observeUpdateStage('alt-anonymous-launch'"));
});

test('font and image phases are independent so logs can identify the pending wait',async()=>{
 let decode=0;await withDocument(documentFixture(Promise.resolve(),[{decode:async()=>{decode++;}}]),async()=>{assert.deepEqual(await waitAltPublicAssets({phase:'font'}),{fontsSettled:true,imageCount:null});assert.equal(decode,0);});
 await withDocument(documentFixture(new Promise(()=>{}),[{decode:async()=>{decode++;}}]),async()=>{assert.equal((await waitAltPublicAssets({phase:'images',imageTimeoutMs:5})).imageCount,1);assert.equal(decode,1);});
});

test('real baseline executes four captures preserving body metadata and images',async()=>{
 const widths=[];let closes=0;
 const image={src:'https://example.test/image.jpg',alt:'existing',loaded:true};
 const metadata={title:'title',representative:'https://blog.kakaocdn.net/fixture-cover.jpg',category:['food','/category/food'],tags:[['#food','/tag/food']]};
 const editorMetadata={title:'title',category:'food',tags:['food'],representativeImage:'background-image: url(https://blog.kakaocdn.net/fixture-cover.jpg)',visibility:'20'};
 const browser={newContext:async({viewport})=>{widths.push(viewport.width);return {route:async()=>{},close:async()=>{closes++;},newPage:async()=>({goto:async()=>({ok:()=>true,text:async()=>'<article>fixture</article>'}),url:()=> 'https://nhunnhun.tistory.com/352',locator:()=>({waitFor:async()=>{}}),evaluate:async(fn,args)=>fn.name==='waitAltPublicAssets'?{fontsSettled:true,imageCount:1}:{body:'preserved provider body',metadata,deliveredImages:[image],images:[image],editorImages:args.original?[{src:image.src}]:null,overflowPx:0}})};}};
 const source={articleId:'352',targetUrl:'https://nhunnhun.tistory.com/352',title:'title',maintenance:{patches:[{imageIndex:0,newAlt:'new'}]}};
 const baseline=await captureAltBaseline(browser,'<img src="https://example.test/image.jpg">',source,editorMetadata);
 assert.deepEqual(widths,[1440,390,1440,390]);assert.equal(closes,4);
 assert.equal(baseline.desktop.bodySha256,baseline.mobile.bodySha256);assert.equal(baseline.desktop.metadataSha256,baseline.mobile.metadataSha256);
 assert.deepEqual(baseline.desktop.images,baseline.mobile.images);assert.equal(baseline.desktop.images[0].loaded,true);assert.match(baseline.desktop.images[0].srcSha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(baseline.patches,[{publicIndex:0,newAlt:'new'}]);
});
