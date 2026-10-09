// Offline integration proof for the actual direct/SP1 verifier; no live mutation.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {renderEditorialPost,editorialExpectations} from '../publishing/editorial.mjs';
import {verifyUpdatedPage} from '../publishing/verify-updated-public.mjs';
const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
const source={id:'direct-offline-preview',title:'검사 원고',targetUrl:'https://nhunnhun.tistory.com/272',contentStandard:'SP1',
 bodyHtml:'<p><img src="https://image.kakaocdn.net/fixture.png" alt="검사 사진"></p>'+['소개','영양','효과','궁합','주의','보관'].map(title=>`<h2>${title}</h2><p><strong>일반 강조</strong> <mark><strong>중요 강조</strong></mark> <mark><u><strong>행동 조건</strong></u></mark></p>`).join('')};
const rendered=renderEditorialPost(source),expected=editorialExpectations(source.bodyHtml,{version:'SP1'});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZkAAAAASUVORK5CYII=','base64');
let removeUnderline=false;
const browser=await chromium.launch({executablePath,headless:true});
const intercepted={newContext:async options=>{
 const context=await browser.newContext(options);
 const originalRoute=context.route.bind(context);
 const fixtureRoute=route=>route.request().resourceType()==='image'
  ?route.fulfill({status:200,contentType:'image/png',body:png})
  :route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:`<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="canonical" href="${source.targetUrl}"><meta property="og:title" content="${source.title.replaceAll('&','&amp;').replaceAll('"','&quot;')}">${removeUnderline?'<style>.nh-direct-v2 u{text-decoration:none!important}</style>':''}</head><body><h1>${source.title.replace('｜','<br>')}</h1><div class="contents_style">${rendered}</div></body></html>`});
 // Keep the offline fixture authoritative after the verifier installs tracker routing.
 context.route=async(...args)=>{await originalRoute(...args);await originalRoute('**/*',fixtureRoute);};
 await originalRoute('**/*',fixtureRoute);
 return context;
}};
try {
 for(const width of [1440,390]){
  const result=await verifyUpdatedPage(intercepted,source,width,expected,rendered,false);
  assert.equal(result.direct.marks,12);assert.equal(result.direct.underlinedMarks,6);assert.equal(result.images,1);assert.equal(result.overflowPx,0);
 }
 removeUnderline=true;
 await assert.rejects(verifyUpdatedPage(intercepted,source,390,expected,rendered,false),/E_DIRECT_PUBLIC_STYLE/);
 console.log('DIRECT_PUBLIC_PREVIEW_PASS desktop/mobile + missing underline rejected; offline only');
}finally{await browser.close();}
