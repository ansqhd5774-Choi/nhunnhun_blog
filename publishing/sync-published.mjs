import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
import { renderEditorialPost, EDITORIAL_TEMPLATE_VERSION } from './editorial.mjs';
import { fingerprint } from './core.mjs';
import { Ledger } from './ledger.mjs';

const BLOG='https://nhunnhun.tistory.com';
const request=JSON.parse(fs.readFileSync('publishing/sync-request.json','utf8'));
if(!request?.id || !/^[a-z0-9][a-z0-9-]{2,79}$/.test(request.id)) throw new Error('E_SYNC_REQUEST');
const post=JSON.parse(fs.readFileSync('posts/'+request.id+'.json','utf8'));
const state=JSON.parse(fs.readFileSync('publishing/state/'+request.id+'.json','utf8'));
if(state.phase!=='published' || !/^https:\/\/nhunnhun\.tistory\.com\/\d+$/.test(state.url||'')) throw new Error('E_SYNC_STATE');
const previousFingerprint=state.fingerprint;
const nextFingerprint=fingerprint(post);
if(previousFingerprint!==nextFingerprint){
  if(request.mode!=='content-update' || request.expectedPublishedFingerprint!==previousFingerprint) throw new Error('E_SYNC_SOURCE_CHANGED');
}
const articleId=new URL(state.url).pathname.slice(1);
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const remoteMain=execFileSync('git',['ls-remote','origin','refs/heads/main'],{encoding:'utf8'}).trim().split(/\s+/)[0]||'';
if(!remoteMain || remoteMain!==sourceCommit) throw new Error('E_SOURCE_DRIFT');

for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID','GITHUB_TOKEN']) {
  if(!process.env[k]) throw new Error('E_CONFIG_'+k);
}
const ledger=new Ledger();
const liveState=await ledger.read(post.id);
if(!liveState || liveState.phase!=='published' || liveState.url!==state.url || liveState.fingerprint!==previousFingerprint) throw new Error('E_SYNC_STATE_DRIFT');

function imageMapByAlt(html){
  const map=new Map();
  for(const tag of html.match(/<img\b[^>]*>/gi)||[]){
    const alt=tag.match(/\balt=(["'])(.*?)\1/i)?.[2];
    const src=tag.match(/\bsrc=(["'])(.*?)\1/i)?.[2];
    if(alt && src) map.set(alt,src);
  }
  return map;
}
function preserveNativeImages(target,current){
  const native=imageMapByAlt(current);
  return target.replace(/<img\b[^>]*>/gi,tag=>{
    const alt=tag.match(/\balt=(["'])(.*?)\1/i)?.[2];
    const src=alt?native.get(alt):null;
    if(!src || !src.includes('kakaocdn.net')) return tag;
    return tag.replace(/\bsrc=(["'])(.*?)\1/i,'src="'+src+'"');
  });
}
async function materializedText(page,html){
  return page.evaluate(markup=>{
    const host=document.createElement('div');
    host.style.cssText='position:fixed;left:-100000px;top:0;width:800px;visibility:hidden;';
    host.innerHTML=markup;
    document.body.appendChild(host);
    const text=(host.innerText||host.textContent||'').replace(/\s+/g,' ').trim();
    host.remove();
    return text;
  },html);
}
async function openHtml(page){
  await page.goto(BLOG+'/manage/post/'+articleId,{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
  await page.locator('#post-title-inp').waitFor({state:'visible'});
  if((await page.locator('#post-title-inp').inputValue()).trim()!==post.title) throw new Error('E_TITLE_MISMATCH');
  await page.locator('#editor-mode-layer-btn-open').click();
  await page.locator('#editor-mode-html').click();
  const cm=page.locator('.CodeMirror:visible');
  await cm.waitFor({state:'visible'});
  return cm.evaluate(el=>el?.CodeMirror?.getValue?.()||'');
}
async function save(page,html){
  const code=page.locator('.CodeMirror:visible .CodeMirror-code');
  await code.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(html);
  await page.waitForTimeout(600);
  await page.locator('#publish-layer-btn').click();
  let submit=null;
  for(const name of ['변경사항 저장','수정','완료','공개 발행']){
    const b=page.getByRole('button',{name,exact:true});
    if(await b.count()){submit=b.last();break;}
  }
  if(!submit) throw new Error('E_SUBMIT');
  await submit.click();
  await page.waitForTimeout(4500);
}
async function verifyDesktop(browser,target){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  try{
    const page=await context.newPage();
    await page.goto(state.url+'?syncverify=desktop',{waitUntil:'domcontentloaded'});
    const content=page.locator('.contents_style');
    if(await content.count()!==1) throw new Error('E_PC_CONTENT');
    const actual=(await content.innerText()).replace(/\s+/g,' ').trim();
    const expected=await materializedText(page,target);
    if(!expected || actual!==expected) {
      let i=0;
      const max=Math.min(actual.length,expected.length);
      while(i<max && actual[i]===expected[i]) i++;
      const from=Math.max(0,i-120), to=i+220;
      console.error('E_PC_BODY_DIAG '+JSON.stringify({
        actualLength:actual.length,expectedLength:expected.length,firstDiff:i,
        actualContext:actual.slice(from,to),expectedContext:expected.slice(from,to)
      }));
      throw new Error('E_PC_BODY');
    }
    const og=await page.locator('meta[property="og:image"]').getAttribute('content').catch(()=>null);
    if(!og || og.includes('opengraph.png') || !og.includes('kakaocdn.net')) throw new Error('E_PC_OG');
    const metrics=await content.evaluate(root=>({
      h2:root.querySelectorAll('h2').length,
      h3:root.querySelectorAll('h3').length,
      accents:[...root.querySelectorAll('div[aria-hidden="true"]')].filter(x=>/width:\s*34px/.test(x.getAttribute('style')||'')).length,
      tables:root.querySelectorAll('table').length,
      tableWraps:[...root.querySelectorAll('table')].filter(t=>/overflow-x:\s*auto/.test(t.parentElement?.getAttribute('style')||'')).length,
      faqQ:[...root.querySelectorAll('span')].filter(x=>x.textContent.trim()==='Q.').length,
      faqA:[...root.querySelectorAll('span')].filter(x=>x.textContent.trim()==='A.').length,
      nativeImages:[...root.querySelectorAll('img')].filter(x=>x.src.includes('kakaocdn.net')).length,
      latest:/최신 근거\s*·?\s*\d{4}/.test(root.innerText),
      summary:root.innerText.includes('핵심 정리'),
      related:root.innerText.includes('함께 보면 좋은 글'),
      sources:root.innerText.includes('자료 출처')
    }));
    if(metrics.h2<4 || metrics.accents!==metrics.h2 || metrics.tables!==metrics.tableWraps || metrics.faqQ!==metrics.faqA || metrics.nativeImages<1 || !metrics.summary || !metrics.sources) throw new Error('E_PC_EDITORIAL');
    return metrics;
  } finally { await context.close(); }
}
async function verifyMobile(browser,target){
  const context=await browser.newContext({
    viewport:{width:390,height:844},
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  });
  try{
    const page=await context.newPage();
    await page.goto(state.url+'?syncverify=mobile',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1000);
    const body=(await page.locator('body').innerText()).replace(/\s+/g,' ').trim();
    const expected=await materializedText(page,target);
    if(!expected || !body.includes(expected)) throw new Error('E_MOBILE_BODY');
    const imageAlts=[...post.bodyHtml.matchAll(/<img\b[^>]*\balt=(["'])(.*?)\1/gi)].map(m=>m[2]);
    const metrics=await page.evaluate(alts=>{
      const imgs=[...document.querySelectorAll('img')].filter(x=>alts.includes(x.getAttribute('alt')||''));
      return {
        finalUrl:location.href,
        overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+4,
        wideImages:imgs.filter(x=>x.getBoundingClientRect().width>document.documentElement.clientWidth+4).length,
        latest:/최신 근거\s*·?\s*\d{4}/.test(document.body.innerText),
        faqQ:(document.body.innerText.match(/Q\./g)||[]).length,
        faqA:(document.body.innerText.match(/A\./g)||[]).length
      };
    },imageAlts);
    if(metrics.overflow || metrics.wideImages || !metrics.latest || metrics.faqQ!==metrics.faqA) throw new Error('E_MOBILE_EDITORIAL');
    return metrics;
  } finally { await context.close(); }
}

const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({
  projectId:process.env.BROWSERBASE_PROJECT_ID,
  browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},
  timeout:300
});
let browser,originalHtml='',changed=false;
try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0];
  const page=await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('dialog',async d=>{try{await d.accept();}catch{}});
  originalHtml=await openHtml(page);
  const rendered=renderEditorialPost(post);
  const target=preserveNativeImages(rendered,originalHtml);
  if(target!==originalHtml){
    await save(page,target);
    changed=true;
  }
  const desktop=await verifyDesktop(browser,target);
  const mobile=await verifyMobile(browser,target);
  const remoteMainAfter=execFileSync('git',['ls-remote','origin','refs/heads/main'],{encoding:'utf8'}).trim().split(/\s+/)[0]||'';
  if(!remoteMainAfter || remoteMainAfter!==sourceCommit) throw new Error('E_SOURCE_DRIFT');
  if(nextFingerprint!==previousFingerprint){
    await ledger.write(post.id,{phase:'published',fingerprint:nextFingerprint,url:state.url,editorialTemplateVersion:EDITORIAL_TEMPLATE_VERSION,timestamp:new Date().toISOString()},liveState.sha);
  }
  console.log('PASS_SYNC_PUBLISHED '+JSON.stringify({id:post.id,url:state.url,changed,contentUpdated:nextFingerprint!==previousFingerprint,desktop,mobile}));
}catch(err){
  console.error('SYNC_PUBLISHED_FAIL '+(err?.stack||err));
  if(changed&&browser&&originalHtml){
    try{
      const p=await browser.contexts()[0].newPage();
      p.setDefaultTimeout(30000);
      p.on('dialog',async d=>{try{await d.accept();}catch{}});
      await openHtml(p);
      await save(p,originalHtml);
      console.error('ROLLBACK_SYNC_PUBLISHED_OK');
    }catch(e){console.error('ROLLBACK_SYNC_PUBLISHED_FAIL '+(e?.stack||e));}
  }
  throw err;
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
