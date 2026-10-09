// Offline contract preview only: not a live Tistory page or medical-content approval.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright-core';
import { fixture } from './fixtures/content-r1/factory.mjs';
import { renderEditorialPost } from '../publishing/editorial.mjs';
import { assertEmphasisContract, CALLOUTS } from '../publishing/content-emphasis.mjs';
const executablePath = [
  process.env.CHROME_PATH,
  process.env.ProgramFiles&&join(process.env.ProgramFiles,'Google','Chrome','Application','chrome.exe'),
  process.env['ProgramFiles(x86)']&&join(process.env['ProgramFiles(x86)'],'Google','Chrome','Application','chrome.exe'),
  process.env.LOCALAPPDATA&&join(process.env.LOCALAPPDATA,'Google','Chrome','Application','chrome.exe'),
  '/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'
].filter(Boolean).find(existsSync);
if (!executablePath) throw new Error('E_CONTENT_PREVIEW_BROWSER_REQUIRED');
const directory = process.env.CONTENT_PREVIEW_DIR || join(tmpdir(),'nhunnhun-content-preview');
mkdirSync(directory,{recursive:true});
const {source}=fixture('food');
source.title='R4 강조·가독성 미리보기 — 비발행 테스트';
const demo='<h2>강조와 선택 기준 미리보기</h2><p>이 화면은 <strong>프로그램 표시 검증용</strong>입니다. 의료정보나 실제 제품 추천이 아닙니다. <u>밑줄과 형광펜을 구분</u>하고 핵심만 표시합니다.</p><p><mark data-tone="key">기억할 핵심</mark>은 노란색입니다. <mark data-tone="action">실제로 확인할 행동</mark>은 별도로 구분합니다.</p><p><mark data-tone="info">설명을 돕는 기준</mark>, <mark data-tone="caution">먼저 확인할 조건</mark>, <mark data-tone="danger">놓치면 안 되는 위험</mark>도 구분합니다. <span data-tone="caution">색만으로 의미를 전달하지 않습니다.</span></p>'+Object.keys(CALLOUTS).map(k=>`<blockquote data-kind="${k}"><p>이것은 ${k} 표시 검증용 설명입니다. 중요한 정보는 색 외에 글자 라벨로도 구분합니다.</p></blockquote>`).join('')+'<table><thead><tr><th>확인할 항목</th><th>선택지 A</th><th>선택지 B</th><th>비교 기준</th></tr></thead><tbody><tr><td>라벨의 의미</td><td>일회분 기준</td><td>동일한 기준</td><td>조건을 맞춰 확인합니다.</td></tr></tbody></table>';
source.bodyHtml=source.bodyHtml.replace('<h2>',demo+'<h2>');
const rendered=renderEditorialPost(source);
const html='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>R4 local preview</title><style>html{font-family:Arial,"Noto Sans CJK KR",sans-serif;color:#111827;background:white}body{margin:0}main{max-width:760px;margin:0 auto;padding:16px;box-sizing:border-box;overflow-wrap:anywhere}p,li{font-size:16px;line-height:1.8}a{color:#1e3a8a}h1{font-size:24px}</style></head><body><main class="contents_style"><h1>'+source.title+'</h1>'+rendered+'</main></body></html>';
writeFileSync(join(directory,'preview.html'),html);
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
const reports=[];
try {
  for(const width of [1440,768,390]) {
    const context=await browser.newContext({viewport:{width,height:1000}});
    // No external calls: every image is an inline fixture, other URLs are aborted.
    await context.route('**/*',route=>route.request().resourceType()==='image'
      ? route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="720" height="120"><rect width="720" height="120" fill="#f1f5f9"/><text x="30" y="70" font-size="24">OFFLINE TEST IMAGE</text></svg>'})
      : route.abort());
    const page=await context.newPage();
    await page.setContent(html,{waitUntil:'load'});
    // Capture lazy/eager authoring contract, then eagerly load only these offline fixtures.
    assert.equal(await page.locator('img').first().getAttribute('loading'),'eager');
    await page.locator('img').evaluateAll(images=>images.forEach(img=>{img.loading='eager';}));
    await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
    assertEmphasisContract(await page.locator('main').innerHTML(),source.bodyHtml);
    const metrics=await page.evaluate(()=>({
      viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,
      underlines:[...document.querySelectorAll('u')].every(e=>getComputedStyle(e).textDecorationLine.includes('underline')),
      labels:[...document.querySelectorAll('[data-nh-callout]')].map(e=>e.firstElementChild.textContent),
      marks:document.querySelectorAll('[data-nh-mark]').length,
      imagesFit:[...document.images].every(e=>e.getBoundingClientRect().width<=innerWidth),
      tableContainers:[...document.querySelectorAll('table')].every(e=>getComputedStyle(e.parentElement).overflowX==='auto'),
      brokenImages:[...document.images].filter(e=>!e.complete||!e.naturalWidth).length
    }));
    assert.ok(metrics.pageWidth<=width+1,JSON.stringify(metrics));
    assert.equal(metrics.underlines,true);assert.equal(metrics.imagesFit,true);assert.equal(metrics.tableContainers,true);assert.equal(metrics.brokenImages,0);
    assert.deepEqual(metrics.labels,Object.values(CALLOUTS).map(c=>c.label));assert.equal(metrics.marks,5);
    await page.screenshot({path:join(directory,`preview-${width}.png`),fullPage:false});
    reports.push({width,passed:true,...metrics});await context.close();
  }
} finally {await browser.close();}
const report={kind:'offline-render-preview-not-live-tistory',network:'blocked-except-synthetic-images',reports};
writeFileSync(join(directory,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log('CONTENT_PREVIEW_PASS '+JSON.stringify(report));
await import('./general-chat-public-preview.mjs');
