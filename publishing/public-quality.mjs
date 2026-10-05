import {createHash} from 'node:crypto';import {chromium} from 'playwright-core';import {join} from 'node:path';
import {verificationContext} from './verification-context.mjs';import {articleUrl,ogAsset,checkMeasurements,assertImagePayload} from './verify-updated-public.mjs';import {checkPost,fingerprint} from './core.mjs';import {renderEditorialPost,editorialExpectations} from './editorial.mjs';
const normalize=s=>String(s||'').replace(/\s+/g,' ').trim();const hash=b=>createHash('sha256').update(b).digest('hex');
// Anonymous GET-only audit. Measurements and asset checks preserve the existing public verifier contract.
function qaRetryDelayMs(response,attempt) {
  const retryAfter=String(response.headers()['retry-after']||'').trim();
  if(retryAfter) {
    const seconds=Number(retryAfter);
    const ms=Number.isFinite(seconds)
      ? Math.max(0,seconds*1000)
      : Math.max(0,Date.parse(retryAfter)-Date.now());
    if(ms>120000) throw new Error('E_QA_RATE_LIMIT_LONG');
    if(ms>0) return ms;
  }
  return Math.min(30000,5000*(2**attempt));
}
async function bytes(request,url,role) {
  let response;
  for(let attempt=0;attempt<4;attempt++) {
    response=await request.get(url,{
      timeout:30000,
      headers:{
        'User-Agent':'NHUNNHUN-Tistory-Publisher/1.0 (https://nhunnhun.tistory.com/)',
        'Accept':'image/*'
      }
    });
    console.log('PUBLIC_QA_ASSET '+JSON.stringify({role,host:new URL(url).hostname,status:response.status(),mime:String(response.headers()['content-type']||'').replace(/[^a-z0-9/;= ._-]/gi,'').slice(0,100)}));
    if(response.ok()) break;
    if(![429,503].includes(response.status())) throw new Error('E_QA_IMAGE_FETCH');
    await new Promise(r=>setTimeout(r,qaRetryDelayMs(response,attempt)));
  }
  if(!response?.ok()) throw new Error('E_QA_IMAGE_FETCH');
  // Tistory .bin assets are served as octet-stream. Validate signatures, then
  // require exact SHA256 equality to the independently fetched image source.
  return assertImagePayload(response.headers()['content-type'],await response.body());
}
async function verify(browser,update,width,expected,rendered,assetChecks) {
  const context=await verificationContext(browser, {viewport:{width,height:width===390?844:1000}});
  try {
    const page=await context.newPage();
    const response=await page.goto(articleUrl(update.targetUrl),{waitUntil:'domcontentloaded',timeout:45000});
    if(!response?.ok() || articleUrl(page.url())!==update.targetUrl) throw new Error('E_QA_PUBLIC_RESPONSE');
    const canonical=await page.locator('link[rel="canonical"]').getAttribute('href');
    if(articleUrl(canonical)!==update.targetUrl) throw new Error('E_QA_CANONICAL');
    if(!(await page.locator('h1').allTextContents()).map(normalize).includes(update.title)) throw new Error('E_QA_TITLE');
    const root=page.locator('.contents_style');
    if(await root.count()!==1) throw new Error('E_QA_ROOT');
    const expectedText=await page.evaluate(html=>{
      const host=document.createElement('div');
      host.style.cssText='position:fixed;left:-100000px;top:0;width:800px;opacity:0;pointer-events:none';
      host.innerHTML=html;document.body.appendChild(host);
      const text=host.innerText||host.textContent||'';host.remove();return text;
    },rendered);
    if(normalize(await root.innerText())!==normalize(expectedText)) throw new Error('E_QA_BODY');
    const images=root.locator('img');
    for(let n=0;n<await images.count();n++) {
      const img=images.nth(n);
      await img.scrollIntoViewIfNeeded();
      await img.evaluate(async el=>{ if(!el.complete) await Promise.race([new Promise(r=>{el.addEventListener('load',r,{once:true});el.addEventListener('error',r,{once:true});}),new Promise(r=>setTimeout(r,15000))]); });
    }
    await page.evaluate(async()=>{await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,5000))]);scrollTo(0,0);});
    const metrics=await root.evaluate(el=>{
      const imgs=[...el.querySelectorAll('img')],h2=[...el.querySelectorAll('h2')],h3=[...el.querySelectorAll('h3')],tables=[...el.querySelectorAll('table')];
      const hi=[...el.querySelectorAll('span')].filter(n=>/linear-gradient\(transparent 45%,#[0-9a-f]{6} 45%\)/i.test(n.getAttribute('style')||''));
      const colors=new Set(hi.map(n=>(n.getAttribute('style').match(/#[0-9a-f]{6}/i)||[])[0]).filter(Boolean));
      const view=document.documentElement.clientWidth;
      return {
        viewport:view,overflowPx:Math.max(0,document.documentElement.scrollWidth-view),
        images:imgs.length,brokenImages:imgs.filter(n=>!n.complete||n.naturalWidth<=0).length,
        missingAlt:imgs.filter(n=>!n.getAttribute('alt')?.trim()).length,
        nonNativeImages:imgs.filter(n=>{try{const h=new URL(n.currentSrc||n.src).hostname;return !(h==='kakaocdn.net'||h.endsWith('.kakaocdn.net'));}catch{return true;}}).length,
        wideImages:imgs.filter(n=>{const r=n.getBoundingClientRect();return r.width>view||r.right>view+0.5||r.left< -0.5;}).length,
        heroPriority:imgs[0]?.getAttribute('loading')==='eager'&&imgs[0]?.getAttribute('fetchpriority')==='high',
        badLazyImages:imgs.slice(1).filter(n=>n.getAttribute('loading')!=='lazy').length,
        h2:h2.length,h3:h3.length,
        badHeadingStyles:h2.filter(n=>{const c=getComputedStyle(n);return c.fontSize!=='26px'||c.fontWeight!=='800';}).length+h3.filter(n=>{const c=getComputedStyle(n);return c.fontSize!=='20px'||c.fontWeight!=='800';}).length,
        tables:tables.length,badTableWraps:tables.filter(n=>!['auto','scroll'].includes(getComputedStyle(n.parentElement).overflowX)).length,
        highlights:hi.length,highlightColors:colors.size,hiddenHighlights:hi.filter(n=>getComputedStyle(n).backgroundImage==='none').length,
        faqQ:[...el.querySelectorAll('span')].filter(n=>n.textContent.trim()==='Q.').length,
        faqA:[...el.querySelectorAll('span')].filter(n=>n.textContent.trim()==='A.').length
      };
    });
    const layout=await root.evaluate(el=>{
      const h2=[...el.querySelectorAll('h2')],divs=[...el.querySelectorAll('div')];
      const summary=h2.find(n=>n.textContent.trim()==='핵심 정리'),related=h2.find(n=>n.textContent.trim()==='함께 보면 좋은 글'),sources=h2.find(n=>n.textContent.trim()==='자료 출처');
      let relatedCards=0;if(related){for(let n=related.nextElementSibling;n&&n.tagName!=='H2';n=n.nextElementSibling)if(n.querySelector?.('a[style*="text-decoration:none"]'))relatedCards++;}
      return {accents:divs.filter(n=>getComputedStyle(n).width==='34px'&&getComputedStyle(n).height==='4px').length,
        responsiveImages:[...el.querySelectorAll('img')].filter(n=>{
          const style=n.getAttribute('style')??'',computed=getComputedStyle(n);
          return /width:\s*100%/.test(style)&&/max-width:\s*720px/.test(style)&&['720px','100%'].includes(computed.maxWidth)&&n.getBoundingClientRect().width<=n.parentElement.getBoundingClientRect().width+.5;
        }).length,
        quickCards:[...el.querySelectorAll('p')].filter(n=>/이것만 먼저 보세요$/.test(n.textContent.trim())&&getComputedStyle(n.parentElement).backgroundColor==='rgb(247, 249, 252)').length,
        latestCards:divs.filter(n=>/최신 근거\s*·?\s*\d{4}/.test(n.textContent)&&getComputedStyle(n).backgroundColor==='rgb(251, 252, 254)').length,
        summaryBox:!!summary?.nextElementSibling&&getComputedStyle(summary.nextElementSibling).backgroundColor==='rgb(248, 250, 252)',
        relatedCards,sourcesStyled:sources?.nextElementSibling?.tagName==='UL'&&getComputedStyle(sources.nextElementSibling).fontSize==='14px'};
    });
    console.log('PUBLIC_QA_LAYOUT '+JSON.stringify({articleId:update.articleId,width,layout,expected}));
    if(layout.accents!==expected.h2||layout.responsiveImages!==expected.images||layout.quickCards!==expected.quick||layout.latestCards!==expected.latest||(expected.summary&&!layout.summaryBox)||(expected.related&&layout.relatedCards!==expected.relatedLinks)||(expected.sources&&!layout.sourcesStyled))throw new Error('E_QA_R3_LAYOUT');
    Object.assign(metrics,layout);
    console.log('PUBLIC_QA_METRICS '+JSON.stringify({articleId:update.articleId,width,...metrics}));
    checkMeasurements(metrics,expected);
    if(assetChecks) {
      const og=ogAsset(await page.locator('meta[property="og:image"]').getAttribute('content'));
      const hero=await images.first().getAttribute('src');
      const assets=await Promise.allSettled([bytes(context.request,hero,'hero'),bytes(context.request,og,'og'),bytes(context.request,update.representativeImageUrl,'source')]);
      if(assets.some(a=>a.status!=='fulfilled')) throw new Error('E_QA_IMAGE_FETCH');
      const [a,b,c]=assets.map(x=>x.value);
      if(hash(a)!==hash(b)||hash(a)!==hash(c)) throw new Error('E_QA_REPRESENTATIVE_CONTENT');
      metrics.representativeSourceMatch=true;
      metrics.ogNative=true;
      const originals=[...update.bodyHtml.matchAll(/<img\b[^>]*\bsrc=(["'])(.*?)\1/gi)].map(m=>m[2].replace(/&amp;/g,'&'));
      const nativeSources=await images.evaluateAll(nodes=>nodes.map(n=>n.currentSrc||n.src));
      if(originals.length!==nativeSources.length)throw new Error('E_QA_IMAGE_COUNT');
      for(let i=1;i<originals.length;i++){
        const pair=await Promise.all([bytes(context.request,nativeSources[i],'body-native'),bytes(context.request,originals[i],'body-source')]);
        if(hash(pair[0])!==hash(pair[1]))throw new Error('E_QA_BODY_IMAGE_CONTENT');
      }
      metrics.allImageSourcesMatch=true;
      const links=await root.locator('a').evaluateAll(nodes=>[...new Set(nodes.map(a=>a.href).filter(u=>/^https:\/\/nhunnhun\.tistory\.com\/\d+$/.test(u)))]);
      for(const url of links) {
        const r=await context.request.get(articleUrl(url),{timeout:30000});
        if(!r.ok()||articleUrl(r.url())!==url) throw new Error('E_QA_INTERNAL_LINK');
      }
      metrics.internalLinks=links.length;
    }
    if(assetChecks&&Array.isArray(update.tags)&&update.category){
      const observed=await page.evaluate(()=>({category:document.querySelector('a.p-category')?.textContent?.trim()??null,tags:[...document.querySelectorAll('.entry-tag a[href^="/tag/"]')].map(a=>a.textContent.trim())}));
      assertPublicMetadata(update,observed);metrics.categoryVerified=true;metrics.tagsVerified=true;
    }
    return metrics;
  } finally {await context.close();}
}

export async function publicAudit(post,url,{signal}={}){
checkPost(post,post.id+'.json');articleUrl(url);if(signal?.aborted)throw new Error('E_STOP_REQUESTED');
const browser=await chromium.launch({executablePath:process.env.TISTORY_CHROME_PATH??process.env.NH_CHROME??join(process.env.PROGRAMFILES??'C:\\Program Files','Google','Chrome','Application','chrome.exe'),headless:true});
const abort=()=>{void browser.close();};signal?.addEventListener('abort',abort,{once:true});
try{const target={...post,targetUrl:url,articleId:new URL(url).pathname.slice(1)},rendered=renderEditorialPost(post),expected=editorialExpectations(post.bodyHtml);const desktop=await verify(browser,target,1440,expected,rendered,true);const mobile=await verify(browser,target,390,expected,rendered,false);return {status:'PASS',url,post_fingerprint:fingerprint(post),expected,desktop,mobile,verified_at:new Date().toISOString(),mode:'ANONYMOUS_READ_ONLY'};}finally{signal?.removeEventListener('abort',abort);await browser.close();}}

export function assertPublicMetadata(expected,observed){if(normalize(observed.category)!==normalize(expected.category))throw new Error('E_QA_CATEGORY');const actual=(observed.tags??[]).map(normalize).sort(),desired=expected.tags.map(normalize).sort();if(JSON.stringify(actual)!==JSON.stringify(desired))throw new Error('E_QA_TAGS');}

export async function readPublicMetadata(url){
  articleUrl(url);
  const browser=await chromium.launch({executablePath:process.env.TISTORY_CHROME_PATH??process.env.NH_CHROME??join(process.env.PROGRAMFILES??'C:\\Program Files','Google','Chrome','Application','chrome.exe'),headless:true});
  try{
    const context=await verificationContext(browser,{viewport:{width:1440,height:1000}}),page=await context.newPage();
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    if(!response?.ok()||articleUrl(page.url())!==url)throw new Error('E_QA_TARGET');
    const metadata=await page.evaluate(()=>({category:document.querySelector('a.p-category')?.textContent?.trim()??null,tags:[...document.querySelectorAll('.entry-tag a[href^="/tag/"]')].map(a=>a.textContent.trim())}));
    if(!metadata.category)throw new Error('E_QA_CATEGORY');
    return metadata;
  }finally{await browser.close();}
}

export async function publicUpdateAudit(update,metadata){
  const {checkUpdateSource,updateFingerprint}=await import('./update-core.mjs');
  checkUpdateSource(update,update.id+'.json');
  if(!metadata?.category||!Array.isArray(metadata.tags))throw new Error('E_QA_METADATA_REQUIRED');
  const post={id:update.id,title:update.title,bodyHtml:update.bodyHtml,representativeImageUrl:update.representativeImageUrl,...(update.imageReview?{imageReview:update.imageReview}:{}),status:'ready',approved:true,category:metadata.category,tags:metadata.tags};
  const audit=await publicAudit(post,update.targetUrl);
  return {...audit,update_fingerprint:updateFingerprint(update),metadata_preserved:true};
}
