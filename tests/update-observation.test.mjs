import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {observeUpdateStage} from '../publishing/update-observation.mjs';import {openPublishDialog} from '../publishing/publish-dialog.mjs';
test('slow editor observation reports pending and still awaits one action without retry or cancellation',async()=>{
 const logs=[];let calls=0,resolve;const pending=new Promise(r=>resolve=r);const work=observeUpdateStage('dialog-open-click',()=>{calls++;return pending;},{log:x=>logs.push(x),slowMs:5});await new Promise(r=>setTimeout(r,15));assert.equal(calls,1);assert.ok(logs.some(x=>x.includes('OBSERVATION_PENDING')));assert.ok(!logs.some(x=>x.includes('error')));resolve('ready');assert.equal(await work,'ready');assert.equal(calls,1);
});
test('only explicit read-only operations can use bounded rejection; errors never expose private text',async()=>{
 let calls=0;const logs=[];await assert.rejects(observeUpdateStage('dialog-open-click',()=>{calls++;},{timeoutMs:5}),/CONTRACT/);assert.equal(calls,0);
 await assert.rejects(observeUpdateStage('dialog-readiness',()=>new Promise(()=>{}),{safeReadOnly:true,timeoutMs:5,log:x=>logs.push(x)}),/READ_ONLY_OBSERVATION_TIMEOUT/);
 await assert.rejects(observeUpdateStage('dialog-readiness',()=>{throw Error('private secret');},{log:x=>logs.push(x)}),/private secret/);assert.ok(!logs.join().includes('private secret'));
});
function fixture({blockedRead=false,failWait=false}={}){
 const calls=[];const state={titlePresent:true,titleMatches:true,titleEmpty:false,titleInvalid:false,tagsMatch:true,tagInputEmpty:true,buttonVisible:true,buttonEnabled:true,buttonCovered:false};
 return {calls,page:{evaluate:async()=>blockedRead?new Promise(()=>{}):state,locator:selector=>({isVisible:async()=>false,click:async options=>calls.push({selector,options}),waitFor:async()=>{if(failWait)throw Error('timeout');}})}};
}
test('alt observer traces each dialog step, bounds only read calls and opens exactly once',async()=>{
 const f=fixture(),steps=[];await openPublishDialog(f.page,{title:'hidden'},()=>{},'E_ALT_DIALOG',{clickTimeoutMs:25000,observe:async(stage,action,options)=>{steps.push({stage,options});return action();}});
 assert.deepEqual(steps.map(x=>x.stage),['dialog-existing-visible','dialog-readiness','dialog-open-click','dialog-visible-wait']);assert.equal(steps[2].options,undefined);assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0],{selector:'#publish-layer-btn',options:{timeout:25000}});
});
test('a stalled read-only readiness rejects before dialog click and never retries',async()=>{
 const f=fixture({blockedRead:true});await assert.rejects(openPublishDialog(f.page,{title:'hidden'},()=>{},'E_ALT_DIALOG',{observe:(stage,action,options)=>observeUpdateStage(stage,action,{...options,timeoutMs:options?5:0,log:()=>{}})}),/READ_ONLY_OBSERVATION_TIMEOUT/);assert.deepEqual(f.calls,[]);
});
test('dialog visibility failure has one open click, bounded diagnostic and no final publication action',async()=>{
 const f=fixture({failWait:true}),steps=[];await assert.rejects(openPublishDialog(f.page,{title:'hidden'},()=>{},'E_ALT_DIALOG',{observe:async(stage,action)=>{steps.push(stage);return action();}}),/E_ALT_DIALOG/);assert.equal(f.calls.length,1);assert.ok(steps.includes('dialog-failure-readiness'));assert.ok(f.calls.every(x=>x.selector==='#publish-layer-btn'));
});
test('standard dialog callers retain default click timeout and only alt runner opts into observed bound',async()=>{
 const f=fixture();await openPublishDialog(f.page,{title:'hidden'},()=>{});assert.deepEqual(f.calls[0].options,{});
 const runner=readFileSync('publishing/alt-maintenance-runner.mjs','utf8');assert.ok(runner.includes('clickTimeoutMs:25000'));const observer=readFileSync('publishing/update-observation.mjs','utf8');assert.ok(!/\.click\(|process\.kill\(|browser\.close\(|page\.close\(/.test(observer));
});
