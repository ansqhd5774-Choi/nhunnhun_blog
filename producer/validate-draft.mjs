import {chromium} from 'playwright-core';
import {readVerifiedArtifact,artifactPath} from './artifacts.mjs';
import {writeFile,access} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {join,dirname} from 'node:path';
import {renderEditorialPost,editorialExpectations} from '../publishing/editorial.mjs';
import {assertImageReview} from '../publishing/image-review.mjs';
import {reviewContent} from './content-review.mjs';
import {plainText} from '../publishing/core.mjs';
import {assertActiveSource} from './active-standard.mjs';
export async function validateDraft({job,runtime,signal}){
  const draft=await readVerifiedArtifact(runtime,job.job_id,'draft.json',job.metadata.draft_fingerprint);
  if(draft.source.approved!==false||draft.source.status!=='draft')throw new Error('E_DRAFT_APPROVAL');
  const evidence=await readVerifiedArtifact(runtime,job.job_id,'evidence.json',job.metadata.evidence_digest);
  assertActiveSource(draft.source,evidence);
  assertImageReview(draft.source);
  const rendered=renderEditorialPost(draft.source),expected=editorialExpectations(draft.source.bodyHtml);
  if(rendered!==draft.renderedHtml)throw new Error('E_RENDER_DRIFT');
  const title=draft.source.title.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const path=artifactPath(runtime,job.job_id,'preview.html');
  await writeFile(path,'<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><style>body{margin:0;font-family:Malgun Gothic,sans-serif;color:#374151}main{max-width:760px;padding:24px;margin:auto;box-sizing:border-box}p,li{line-height:1.8;overflow-wrap:anywhere}a{color:#2563eb}h1{font-size:28px;line-height:1.4}@media(max-width:500px){main{padding:18px}}</style><main><p>로컬 초안 · 사실/편집 검토 대기 · 공개 승인 없음</p><h1>'+title+'</h1>'+rendered+'</main></html>');
  const candidates=[process.env.NH_CHROME,join(process.env.PROGRAMFILES??'C:\\Program Files','Google','Chrome','Application','chrome.exe'),join(process.env['PROGRAMFILES(X86)']??'C:\\Program Files (x86)','Google','Chrome','Application','chrome.exe')].filter(Boolean);
  let executable;for(const p of candidates){try{await access(p);executable=p;break;}catch{}}
  if(!executable)throw new Error('E_PREVIEW_BROWSER');
  const browser=await chromium.launch({executablePath:executable,headless:true}),measurements=[];
  try{for(const width of [1440,390]){
    if(signal?.aborted)throw new Error('E_STOP_REQUESTED');
    const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
    await page.route('**/*',route=>{const u=new URL(route.request().url());return u.protocol==='file:'||route.request().resourceType()==='image'&&u.protocol==='https:'&&['upload.wikimedia.org','thumb.wikimedia.org'].includes(u.hostname)?route.continue():route.abort();});
    await page.goto(pathToFileURL(path).href,{waitUntil:'load',timeout:60000});
    const loading=await page.evaluate(()=>({heroLoading:document.images[0]?.getAttribute('loading'),badLazyImages:[...document.images].slice(1).filter(i=>i.getAttribute('loading')!=='lazy').length}));
    await page.evaluate(async()=>{for(const img of document.images){img.loading='eager';await img.decode().catch(()=>{});}});
    const m=await page.evaluate(()=>({width:innerWidth,overflowPx:Math.max(0,document.documentElement.scrollWidth-innerWidth),images:document.images.length,broken:[...document.images].filter(i=>!i.naturalWidth||!i.complete).length,missingAlt:[...document.images].filter(i=>!i.alt.trim()).length,h2:document.querySelectorAll('h2').length,badH2:[...document.querySelectorAll('h2')].filter(h=>getComputedStyle(h).fontSize!=='26px'||getComputedStyle(h).fontWeight!=='800').length,heroPriority:document.images[0]?.fetchPriority==='high',faq:[...document.querySelectorAll('span')].filter(s=>s.textContent==='Q.').length,highlightColors:new Set([...document.querySelectorAll('span')].filter(s=>s.style.background.includes('linear-gradient')).map(s=>s.style.background)).size}));
    const extra=await page.evaluate(()=>({h3:document.querySelectorAll('h3').length,badH3:[...document.querySelectorAll('h3')].filter(h=>getComputedStyle(h).fontSize!=='20px'||getComputedStyle(h).fontWeight!=='800').length,tables:document.querySelectorAll('table').length,badTableWraps:[...document.querySelectorAll('table')].filter(t=>!['auto','scroll'].includes(getComputedStyle(t.parentElement).overflowX)).length,wideImages:[...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width>document.documentElement.clientWidth||r.right>document.documentElement.clientWidth+.5||r.left<-.5}).length}));
    if(extra.badH3||extra.h3!==expected.h3||extra.tables!==expected.tables||extra.badTableWraps||extra.wideImages||loading.heroLoading!=='eager'||loading.badLazyImages||m.overflowPx||m.broken||m.missingAlt||m.badH2||m.images!==expected.images||m.h2!==expected.h2||!m.heroPriority||m.faq!==expected.faq||(expected.highlights>=2&&m.highlightColors<2))throw new Error('E_LOCAL_PREVIEW');
    await page.screenshot({path:join(dirname(path),'preview-'+width+'.png'),fullPage:true});measurements.push({...m,...extra,...loading});await context.close();
  }}finally{await browser.close();}
  const review=await reviewContent({job,runtime,signal});
  return {structural_validation:'PASS',viewport_measurements:measurements,...review,content_text:plainText(draft.source.bodyHtml),visual_review:'PASS_PRE_REVIEWED_IMAGE_MANIFEST',intent_review:'PENDING',source_current:'PENDING',draft_fingerprint:job.metadata.draft_fingerprint,public_validation:'NOT_TESTED',approved:false,ready_to_publish:false};
}
