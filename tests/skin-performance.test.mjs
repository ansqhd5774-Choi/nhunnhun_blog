import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {optimizeHtml,optimizeImages,stabilizeDesktop,IMAGE_SCRIPT} from '../scripts/optimize-skin-performance.mjs';

test('performance patch preserves body and existing stylesheet while fixing ordered jQuery bridge',()=>{
  const html='<html><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /><head><script>var ASYNC_SCRIPTS=["tiara.min.js","common.js","kakao.min.js"];window.jQuery = tjQuery;</script><link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Example&display=swap"><link rel="stylesheet" href="./style.css"></head><body><p>본문</p><img src="native"></body></html>';
  const changed=stabilizeDesktop(optimizeImages(optimizeHtml(html)));
  assert.equal(changed.slice(changed.indexOf('<body>')),html.slice(html.indexOf('<body>')));
  assert(changed.includes('window.jQuery = window.$ = tjQuery;'));
  assert(changed.includes('ASYNC_SCRIPTS=["tiara.min.js","common.js","kakao.min.js"]'));
  assert(changed.includes('<link rel="stylesheet" href="./style.css">'));
  assert.equal((changed.match(/rel="preconnect"/g)||[]).length,5);
  assert.equal(stabilizeDesktop(optimizeImages(optimizeHtml(changed))),changed);
  assert(!changed.includes('<noscript><noscript>'));
});

test('image optimization preserves native src, reserves observed ratio, and falls back without changing source',()=>{
  const attrs=new Map([['src','https://blog.kakaocdn.net/dna/bW7T4l/example/tfile.bin'],['style','width:100%;max-width:720px;height:auto;']]);
  let onError;
  const img={closest:()=>({}),getAttribute:key=>attrs.get(key),hasAttribute:key=>attrs.has(key),setAttribute:(key,value)=>attrs.set(key,String(value)),removeAttribute:key=>attrs.delete(key),addEventListener:(_type,fn)=>{onError=fn;}};
  const code=IMAGE_SCRIPT.replace(/^<script[^>]*>\n/,'').replace(/\n<\/script>$/,'');
  runInNewContext(code,{location:{pathname:'/6'},WeakSet,MutationObserver:class{observe(){}disconnect(){}},document:{documentElement:{},querySelectorAll:()=>[img],addEventListener:(_name,fn)=>fn()}});
  assert.equal(attrs.get('src'),'https://blog.kakaocdn.net/dna/bW7T4l/example/tfile.bin');
  assert.equal(attrs.get('width'),'640');
  assert.equal(attrs.get('height'),'480');
  assert(attrs.get('srcset').includes('R960x0.fwebp.q85/'));
  onError();
  assert(!attrs.has('srcset'));
  assert(!attrs.has('sizes'));
  assert(attrs.get('src').startsWith('https://blog.kakaocdn.net/'));
});

test('other pages do not install image observers',()=>{
  runInNewContext(IMAGE_SCRIPT.replace(/^<script[^>]*>\n/,'').replace(/\n<\/script>$/,''),{location:{pathname:'/366'},MutationObserver:class{constructor(){throw Error('unexpected observer');}}});
});

test("system font avoids a late body font swap and icon space is reserved",()=>{
 const html='<html><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=[##_var_mainFont_##]&display=swap"><link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Material+Icons+Outlined"><link rel="stylesheet" href="./style.css"></head><body>본문</body></html>';
 const changed=optimizeHtml(html);
 assert(!changed.includes("css2?family=[##_var_mainFont_##]"));
 assert(changed.includes("Material+Icons+Outlined"));
 assert(changed.includes("width:1em;max-width:1em;overflow:hidden"));
 assert.equal(optimizeHtml(changed),changed);
});
