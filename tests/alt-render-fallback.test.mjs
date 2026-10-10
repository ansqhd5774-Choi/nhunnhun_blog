import test from 'node:test';import assert from 'node:assert/strict';import {assertAltDeliveredRender,captureAltSnapshot} from '../publishing/alt-maintenance-public.mjs';
const source=[{src:'https://blog.kakaocdn.net/fixture',alt:null,filename:'fixture.webp'}];
test('observed legacy filename fallback is allowed only for absent or empty provider alt',()=>{assertAltDeliveredRender(source,[{src:source[0].src,alt:'fixture.webp'}]);assertAltDeliveredRender([{...source[0],alt:''}],[{src:source[0].src,alt:'fixture.webp'}]);assertAltDeliveredRender([{...source[0],alt:'explicit'}],[{src:source[0].src,alt:'explicit'}]);});
test('explicit alt change, different filename, count or src including signed query drift still fail',()=>{for(const [provider,image] of [[[{...source[0],alt:'explicit'}],{src:source[0].src,alt:'fixture.webp'}],[source,{src:source[0].src,alt:'other.webp'}],[source,{src:source[0].src+'?different=1',alt:'fixture.webp'}],[[{...source[0],filename:null}],{src:source[0].src,alt:'fixture.webp'}]])assert.throws(()=>assertAltDeliveredRender(provider,[image]),/SOURCE_RENDER_MISMATCH/);assert.throws(()=>assertAltDeliveredRender(source,[]),/SOURCE_RENDER_MISMATCH/);});

test('capture executes actual DOM extraction and accepts observed filename fallback end to end',async()=>{
 const keys=['document','DOMParser','innerWidth','scrollX','scrollY','scrollTo'];const old=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));let closed=0;
 const img=(alt)=>({complete:true,naturalWidth:20,loading:'lazy',decode:async()=>{},getAttribute:k=>({src:source[0].src,alt,'data-filename':'fixture.webp'}[k]??null),removeAttribute:()=>{}});
 const runtime=img('fixture.webp'),delivered=img(null);const clone={innerHTML:'provider markup without alt',querySelectorAll:()=>[delivered]};
 const body={getClientRects:()=>[{}],querySelectorAll:()=>[runtime]};
 const metadata={title:'title',representative:'https://blog.kakaocdn.net/cover'};
 globalThis.document={fonts:{ready:Promise.resolve()},documentElement:{scrollWidth:1440},querySelectorAll:selector=>selector==='.contents_style'?[body]:selector==='.hd .meta-cate a'?[{textContent:'food',getAttribute:()=>'/food'}]:selector==='.entry-tag a'?[{textContent:'#food',getAttribute:()=>'/tag'}]:[],querySelector:selector=>({content:selector.includes('og:title')?metadata.title:metadata.representative})};
 globalThis.DOMParser=class{parseFromString(){return {querySelectorAll:selector=>selector==='.contents_style'?[{cloneNode:()=>clone}]:[]};}};
 globalThis.innerWidth=1440;globalThis.scrollX=0;globalThis.scrollY=0;globalThis.scrollTo=()=>{};
 const images={count:async()=>1,nth:()=>({scrollIntoViewIfNeeded:async()=>{},evaluate:async(fn,arg)=>fn(runtime,arg)})};
 const page={goto:async()=>({ok:()=>true,text:async()=>'<synthetic>'}),url:()=> 'https://nhunnhun.tistory.com/352',locator:()=>({count:async()=>1,locator:()=>images,waitFor:async()=>{}}),evaluate:async(fn,arg)=>fn(arg)};
 const browser={newContext:async()=>({route:async()=>{},newPage:async()=>page,close:async()=>{closed++;}})};
 try{const snap=await captureAltSnapshot(browser,{articleId:'352',targetUrl:'https://nhunnhun.tistory.com/352',title:'title'},1440,null,{log:()=>{}});assert.equal(snap.images.length,1);assert.equal(snap.images[0].loaded,true);assert.match(snap.bodySha256,/^[a-f0-9]{64}$/);assert.equal(closed,1);}finally{for(const k of keys){if(old[k]===undefined)delete globalThis[k];else globalThis[k]=old[k];}}
});
