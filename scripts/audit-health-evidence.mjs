import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseDocument, DomUtils } from 'htmlparser2';
import { locations } from './audit-search-foundation.mjs';

const BASE = 'https://nhunnhun.tistory.com';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const classHas = (node, name) => (node.attribs?.class ?? '').split(/\s+/).includes(name);
const text = node => DomUtils.textContent(node).replace(/\s+/g,' ').trim();
function all(node, predicate) { return DomUtils.findAll(predicate, node.children ?? []); }
function publicAddress(value, base) {
  try {
    const u = new URL(value,base);
    if (!['http:','https:'].includes(u.protocol) || u.username || u.password) return null;
    if ([...u.searchParams.keys()].some(k=>/token|signature|credential|authorization|apikey|api_key|password/i.test(k))) return null;
    return u.href;
  } catch { return null; }
}

export function extractEvidence(html, url) {
  const doc = parseDocument(html);
  const nodes = all(doc,n=>n.type==='tag' && classHas(n,'contents_style'));
  const roots = nodes.length ? nodes : all(doc,n=>n.type==='tag' && classHas(n,'article-body'));
  const anchors = roots.flatMap(root=>all(root,n=>n.name==='a' && n.attribs?.href));
  const external = anchors.flatMap(n=>{
    const href = publicAddress(n.attribs.href,url);
    if (!href || new URL(href).origin===BASE) return [];
    let context = n.parent;
    while (context?.parent && !['p','li','td','article'].includes(context.name)) context=context.parent;
    return [{sourceUrl:href,label:text(n).slice(0,160),context:text(context).slice(0,420),contentReview:'NOT_PERFORMED'}];
  });
  const images = roots.flatMap(root=>all(root,n=>n.name==='img')).flatMap(n=>{
    const raw=n.attribs.src;
    if (!raw || raw.startsWith('data:')) return [];
    let u; try {u=new URL(raw,url);} catch {return [];}
    // Request the actual public image while keeping signed URLs out of saved/output records.
    return [{key:hash(u.href),requestUrl:u.href,host:u.hostname,path:u.pathname,alt:n.attribs.alt??'',width:n.attribs.width??null,height:n.attribs.height??null}];
  });
  const headings=roots.flatMap(root=>all(root,n=>/^h[1-3]$/.test(n.name??''))).map(n=>text(n));
  const title=all(doc,n=>n.name==='title')[0];
  return {url,title:title?text(title):null,articleFound:roots.length>0,headings,external,images};
}

export function accessState(status, contentType, body='') {
  if ([404,410].includes(status)) return 'NOT_FOUND';
  if ([401,403,429].includes(status)) return 'ACCESS_RESTRICTED';
  if (status>=500) return 'SERVER_ERROR';
  if (status<200 || status>=300) return 'HTTP_OTHER';
  if (/html/i.test(contentType??'')) {
    const doc=parseDocument(body), title=all(doc,n=>n.name==='title')[0];
    const h1=all(doc,n=>n.name==='h1')[0];
    const lead=[title&&text(title),h1&&text(h1)].filter(Boolean).join(' ');
    if (/^(?:.*?\b)?(?:404|page not found|access denied|just a moment|robot check|verify you are human)(?:\b|$)/i.test(lead)) return 'SOFT_ERROR_CANDIDATE';
    if (!text(doc).trim()) return 'EMPTY_CONTENT';
  }
  return 'HTTP_ACCESSIBLE_CONTENT_UNREVIEWED';
}

export function reconcileSourceAccess(automated, browser) {
  // Keep transport evidence intact. A rendered cross-check is not clinical/content certification.
  if (!browser || browser.browserAccess !== 'CONTENT_DISPLAYED') return {...automated, runtimeAccess:'UNCONFIRMED'};
  return {...automated, runtimeAccess:'BROWSER_CONTENT_DISPLAYED', browserCheckedAt:browser.checkedAt,
    browserTitle:browser.title, discrepancy:automated.access!=='HTTP_ACCESSIBLE_CONTENT_UNREVIEWED',
    contentReview:browser.contentReview??'NOT_PERFORMED'};
}

export async function auditHealthEvidence(outDir, maxPages=0) {
  await fs.mkdir(outDir,{recursive:true});
  const file=path.join(outDir,'health-evidence-checkpoint.json');
  let state={pages:{},sources:{},images:{}};
  try {state=JSON.parse(await fs.readFile(file,'utf8'));} catch {}
  let writes=Promise.resolve();
  const persist=()=>{const snapshot=JSON.stringify(state,null,2);writes=writes.then(()=>fs.writeFile(file,snapshot));return writes;};
  const failedDomains=new Map();
  async function request(url, image=false) {
    try {
      const res=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'NH-Health-ReadOnly-Audit/1.0'}});
      const contentType=res.headers.get('content-type');
      let body='';
      if (!image && res.ok && !/pdf|image\//i.test(contentType??'')) body=(await res.text()).slice(0,6_000_000);
      else await res.body?.cancel();
      const final=publicAddress(res.url,url);
      return {status:res.status,contentType,finalUrl:final,checkedAt:new Date().toISOString(),access:accessState(res.status,contentType,body),body};
    } catch(err) { return {checkedAt:new Date().toISOString(),access:'FETCH_UNCONFIRMED',error:err.name}; }
  }
  const sitemap=await request(BASE+'/sitemap.xml');
  const urls=locations(sitemap.body??'').filter(u=>/^https:\/\/nhunnhun\.tistory\.com\/\d+$/.test(u));
  const selected=maxPages?urls.slice(0,maxPages):urls;
  let cursor=0;
  async function worker() {
    while(cursor<selected.length) {
      const url=selected[cursor++]; if (state.pages[url]) continue;
      const page=await request(url);
      const parsed=extractEvidence(page.body??'',url);
      const imageRequests=parsed.images;
      parsed.images=imageRequests.map(({requestUrl,...safe})=>safe);
      delete page.body;
      state.pages[url]={...page,...parsed};
      for (const image of imageRequests) {
        if (state.images[image.key]) continue;
        const img=await request(image.requestUrl,true); delete img.body; delete img.finalUrl;
        state.images[image.key]={...img,host:image.host,path:image.path,formatIsImage:/^image\//i.test(img.contentType??'')};
      }
      await persist();
      if (Object.keys(state.pages).length%25===0) console.log(`Public pages ${Object.keys(state.pages).length}/${selected.length}`);
      await new Promise(r=>setTimeout(r,350));
    }
  }
  await Promise.all([worker(),worker(),worker()]);
  const sourceUrls=[...new Set(selected.flatMap(url=>state.pages[url]?.external.map(e=>e.sourceUrl)??[]))];
  for(const url of sourceUrls) {
    if(state.sources[url]) continue;
    const domain=new URL(url).hostname;
    if((failedDomains.get(domain)??0)>=2) {
      state.sources[url]={access:'DOMAIN_CHECK_DEFERRED',checkedAt:null,reason:'Two restricted/server/unconfirmed results in this bounded pass',contentReview:'NOT_PERFORMED'};
      continue;
    }
    const result=await request(url); delete result.body;
    state.sources[url]={...result,contentReview:'NOT_PERFORMED'};
    if(['ACCESS_RESTRICTED','SERVER_ERROR','FETCH_UNCONFIRMED'].includes(result.access)) failedDomains.set(domain,(failedDomains.get(domain)??0)+1);
    await persist();
    if(Object.keys(state.sources).length%25===0) console.log(`Source access ${Object.keys(state.sources).length}/${sourceUrls.length}`);
    await new Promise(r=>setTimeout(r,250));
  }
  await persist();
  let crosschecks=[];
  try {crosschecks=JSON.parse(await fs.readFile(path.join(outDir,'source-browser-crosschecks.json'),'utf8'));} catch {}
  const browserByUrl=new Map(crosschecks.map(r=>[r.sourceUrl,r]));
  const sources=Object.fromEntries(sourceUrls.map(u=>[u,reconcileSourceAccess(state.sources[u],browserByUrl.get(u))]));
  const counts=rows=>rows.reduce((a,r)=>(a[r.access]=(a[r.access]??0)+1,a),{});
  const summary={checkedAt:new Date().toISOString(),sitemapStatus:sitemap.status,totalPublicUrls:urls.length,selected:selected.length,pagesChecked:selected.filter(u=>state.pages[u]).length,
    pageAccess:counts(selected.map(u=>state.pages[u])),uniqueSources:sourceUrls.length,sourceAccess:counts(sourceUrls.map(u=>state.sources[u])),uniqueImages:Object.keys(state.images).length,imageAccess:counts(Object.values(state.images)),
    missingAltImages:selected.flatMap(u=>state.pages[u]?.images??[]).filter(i=>!i.alt.trim()).length,
    browserCrosschecks:sourceUrls.filter(u=>sources[u].runtimeAccess==='BROWSER_CONTENT_DISPLAYED').length,
    sourceIssues:sourceUrls.filter(u=>state.sources[u].access!=='HTTP_ACCESSIBLE_CONTENT_UNREVIEWED').map(u=>({sourceUrl:u,...sources[u],affectedArticles:selected.filter(p=>state.pages[p]?.external.some(e=>e.sourceUrl===u))})),
    semanticReview:'NOT_PERFORMED',indexingVerification:'NOT_PERFORMED',imageLicenseReview:'NOT_PERFORMED'};
  await fs.writeFile(path.join(outDir,'health-evidence-summary.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify({...summary,sourceIssues:summary.sourceIssues.length}));
  return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) await auditHealthEvidence(process.argv[2]??'evidence/health-evidence',Number(process.argv[3]??0));
