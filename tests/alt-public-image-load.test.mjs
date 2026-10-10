import test from 'node:test';import assert from 'node:assert/strict';import {loadAltPublicImages,observeAltImageLoad,normalizeAltObservationError} from '../publishing/alt-public-image-load.mjs';
test('actual sequence exposes each lazy image before observing load and restores position',async()=>{
 const events=[],logs=[];const images={count:async()=>2,nth:index=>({scrollIntoViewIfNeeded:async({timeout})=>{assert.ok(timeout>0);events.push('scroll'+index);},evaluate:async(fn,args)=>{events.push('read'+index);return fn({complete:true,naturalWidth:20,loading:'lazy',decode:async()=>{}},args);}})};
 const page={locator:()=>({count:async()=>1,locator:()=>images}),evaluate:async(fn,args)=>{if(args){events.push('restore');assert.deepEqual(args,{x:2,y:3});}else return {x:2,y:3};}};
 assert.deepEqual(await loadAltPublicImages(page,{log:x=>logs.push(x)}),{imageCount:2});assert.deepEqual(events,['scroll0','read0','scroll1','read1','restore']);assert.ok(logs.every(x=>!x.includes('https')));
});
test('broken images and pending decode fail; no relaxed natural width guard',async()=>{
 await assert.rejects(observeAltImageLoad({complete:true,naturalWidth:0},{timeoutMs:5}),/IMAGE_LOAD_FAILED/);
 await assert.rejects(observeAltImageLoad({complete:true,naturalWidth:1,decode:()=>new Promise(()=>{})},{timeoutMs:5}),/ASSET_OBSERVATION_TIMEOUT/);
 const wrapped=Error('locator.evaluate: Error: E_ALT_PUBLIC_ASSET_OBSERVATION_TIMEOUT');assert.equal(normalizeAltObservationError(wrapped).message,'E_ALT_PUBLIC_ASSET_OBSERVATION_TIMEOUT');const unknown=Error('unknown');assert.equal(normalizeAltObservationError(unknown),unknown);
});
test('budget expiry stops before scrolling and still restores isolated page',async()=>{
 let ticks=0,scrolled=0,restored=0;const page={locator:()=>({count:async()=>1,locator:()=>({count:async()=>1,nth:()=>({scrollIntoViewIfNeeded:async()=>{scrolled++;}})})}),evaluate:async(_,arg)=>arg?restored++:{x:0,y:0}};
 await assert.rejects(loadAltPublicImages(page,{budgetMs:35,now:()=>ticks++*10,log:()=>{}}),/ASSET_OBSERVATION_TIMEOUT/);assert.equal(scrolled,0);assert.equal(restored,1);
});
