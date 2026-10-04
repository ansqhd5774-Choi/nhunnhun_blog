// Read-only, anonymous quality audit. No editor, credential export or ledger writes.
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const BLOG='https://nhunnhun.tistory.com';
const normalize=s=>String(s||'').replace(/\s+/g,' ').trim();
const hash=b=>createHash('sha256').update(b).digest('hex');

export function articleUrl(value) {
  const u=new URL(value);
  if(u.origin!==BLOG || !/^\/\d+$/.test(u.pathname) || u.search || u.hash || u.username || u.password) throw new Error('E_QA_TARGET');
  return u.href;
}
export function ogAsset(value) {
  let u=new URL(value);
  for(let n=0;n<3;n++) {
    if(u.protocol!=='https:' || u.username || u.password) throw new Error('E_QA_OG_HOST');
    if(u.hostname==='kakaocdn.net' || u.hostname.endsWith('.kakaocdn.net')) return u.href;
    if(!(u.hostname==='daumcdn.net' || u.hostname.endsWith('.daumcdn.net')) || !u.searchParams.has('fname')) throw new Error('E_QA_OG_HOST');
    u=new URL(u.searchParams.get('fname'));
  }
  throw new Error('E_QA_OG_HOST');
}
export function checkMeasurements(m,e) {
  if(m.overflowPx!==0 || m.wideImages!==0) throw new Error('E_QA_OVERFLOW');
  if(m.images!==e.images || m.images<3 || m.missingAlt || m.brokenImages || m.nonNativeImages) throw new Error('E_QA_IMAGES');
  if(m.h2!==e.h2 || m.h3!==e.h3 || m.badHeadingStyles) throw new Error('E_QA_HEADINGS');
  if(m.tables!==e.tables || m.badTableWraps) throw new Error('E_QA_TABLES');
  if(m.highlights!==e.highlights || (e.highlights>=2 && m.highlightColors<2) || m.hiddenHighlights) throw new Error('E_QA_HIGHLIGHTS');
  if(m.faqQ!==e.faq || m.faqA!==e.faq || !m.heroPriority || m.badLazyImages) throw new Error('E_QA_STRUCTURE');
  return true;
}
export function assertImagePayload(contentType,b) {
  const mime=String(contentType||'').split(';')[0].trim().toLowerCase();
  if(!/^image\//.test(mime)&&mime!=='application/octet-stream') throw new Error('E_QA_IMAGE_TYPE');
  if(!Buffer.isBuffer(b)||!b.length||b.length>12*1024*1024) throw new Error('E_QA_IMAGE_SIZE');
  const jpeg=b.length>3&&b[0]===255&&b[1]===216&&b[2]===255;
  const png=b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const gif=['GIF87a','GIF89a'].includes(b.subarray(0,6).toString('ascii'));
  const webp=b.length>=12&&b.subarray(0,4).toString('ascii')==='RIFF'&&b.subarray(8,12).toString('ascii')==='WEBP';
  if(!jpeg&&!png&&!gif&&!webp) throw new Error('E_QA_IMAGE_SIGNATURE');
  return b;
}
async function bytes(request,url,role) {
  const response=await request.get(url,{timeout:30000,headers:{'User-Agent':'Mozilla/5.0','Accept':'image/*'}});
  console.log('PUBLIC_QA_ASSET '+JSON.stringify({role,host:new URL(url).hostname,status:response.status(),mime:String(response.headers()['content-type']||'').replace(/[^a-z0-9/;= ._-]/gi,'').slice(0,100)}));
  if(!response.ok()) throw new Error('E_QA_IMAGE_FETCH');
  // Tistory .bin assets are served as octet-stream. Validate signatures, then
  // require exact SHA256 equality to the independently fetched image source.
  return assertImagePayload(response.headers()['content-type'],await response.body());
}
async function verify(browser,update,width,expected,rendered,assetChecks) {
  const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});
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
      const links=await root.locator('a').evaluateAll(nodes=>[...new Set(nodes.map(a=>a.href).filter(u=>/^https:\/\/nhunnhun\.tistory\.com\/\d+$/.test(u)))]);
      for(const url of links) {
        const r=await context.request.get(articleUrl(url),{timeout:30000});
        if(!r.ok()||articleUrl(r.url())!==url) throw new Error('E_QA_INTERNAL_LINK');
      }
      metrics.internalLinks=links.length;
    }
    return metrics;
  } finally {await context.close();}
}
async function main() {
  const [{loadUpdates,updateFingerprint},{UpdateLedger},{localBrowserConfig,openPublicBrowser},{renderEditorialPost,editorialExpectations}]=await Promise.all([
    import('./update-core.mjs'),import('./update-ledger.mjs'),import('./local-browser.mjs'),import('./editorial.mjs')
  ]);
  const ledger=new UpdateLedger(),updates=await loadUpdates();
  const selected=(process.env.PUBLIC_VERIFY_ARTICLE_IDS||'').split(',').filter(Boolean);
  if(selected.some(s=>!/^\d+$/.test(s))) throw new Error('E_QA_FILTER');
  const targets=updates.filter(u=>!selected.length||selected.includes(u.articleId));
  if(!targets.length || (selected.length && targets.length!==new Set(selected).size)) throw new Error('E_QA_TARGET_COUNT');
  let browser;
  try {
    browser=await openPublicBrowser(await localBrowserConfig());
    let failures=0;
    for(const update of targets) {
      try {
        const state=await ledger.read(update.id);
        if(state?.phase!=='updated'||state.url!==update.targetUrl||state.fingerprint!==updateFingerprint(update)) throw new Error('E_QA_LEDGER');
        const rendered=renderEditorialPost(update),expected=editorialExpectations(update.bodyHtml);
        const desktop=await verify(browser,update,1440,expected,rendered,true);
        const mobile=await verify(browser,update,390,expected,rendered,false);
        console.log('PUBLIC_QA_PASS '+JSON.stringify({articleId:update.articleId,url:update.targetUrl,title:update.title,desktop,mobile}));
      } catch(error) {
        failures++;
        console.log('PUBLIC_QA_FAIL '+JSON.stringify({articleId:update.articleId,code:/^E_QA_[A-Z_]+$/.test(error?.message||'')?error.message:'E_QA_RUNTIME'}));
      }
    }
    if(failures) throw new Error('E_QA_INCOMPLETE');
    console.log('PUBLIC_QA_COMPLETE '+targets.length);
  } finally {await browser?.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) main().catch(error=>{
  console.error(/^E_QA_[A-Z_]+$/.test(error?.message||'')?error.message:'E_QA_RUNTIME');process.exitCode=1;
});
