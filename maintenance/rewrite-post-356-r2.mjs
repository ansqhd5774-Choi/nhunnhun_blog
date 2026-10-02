import fs from 'node:fs';
import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com';
const POST_ID='356';
const post=JSON.parse(fs.readFileSync('posts/apple-benefits-20261002.json','utf8'));

for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) if(!process.env[k]) throw new Error('E_CONFIG_'+k);
const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({
  projectId:process.env.BROWSERBASE_PROJECT_ID,
  browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},
  timeout:300
});
let browser,originalHtml='',changed=false;

async function openHtml(page){
  await page.goto(BLOG+'/manage/post/'+POST_ID,{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
  await page.locator('#post-title-inp').waitFor({state:'visible'});
  const title=(await page.locator('#post-title-inp').inputValue()).trim();
  if(title!==post.title) throw new Error('E_TITLE_MISMATCH_'+title);
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
  await page.waitForTimeout(700);
  await page.locator('#publish-layer-btn').click();
  let submit=null;
  for(const name of ['수정','변경사항 저장','완료','공개 발행']){
    const b=page.getByRole('button',{name,exact:true});
    if(await b.count()){submit=b.last();break;}
  }
  if(!submit) throw new Error('E_SUBMIT');
  await submit.click();
  await page.waitForTimeout(4000);
}
async function verify(context,w,h){
  const p=await context.newPage();
  try{
    await p.setViewportSize({width:w,height:h});
    await p.goto(BLOG+'/'+POST_ID,{waitUntil:'domcontentloaded'});
    await p.waitForTimeout(1500);
    return await p.evaluate(()=>{
      const text=document.body.innerText;
      const body=document.querySelector('.contents_style,.post-content');
      const hero=body?.querySelector('img[alt="붉은 사과 두 개"]');
      const link195=[...document.querySelectorAll('a')].some(a=>a.href==='https://nhunnhun.tistory.com/195');
      return {
        title:document.querySelector('h1')?.textContent?.trim()||document.title,
        hasQuick:text.includes('사과, 이것만 먼저 보세요'),
        has100g:text.includes('100g 기준'),
        hasTrend:text.includes('요즘 많이 묻는'),
        hasPairing:text.includes('무가당 그릭요거트')&&text.includes('견과류'),
        hasComparison:text.includes('통사과 vs 사과주스'),
        link195,
        hero:hero?{width:hero.getAttribute('width'),height:hero.getAttribute('height'),loading:hero.getAttribute('loading'),fetchpriority:hero.getAttribute('fetchpriority')}:null,
        secondAppleImages:body?[...body.querySelectorAll('img')].filter(x=>x.getAttribute('alt')==='반으로 자른 사과').length:null,
        tableCount:body?body.querySelectorAll('table').length:0,
        h2Count:body?body.querySelectorAll('h2').length:0
      };
    });
  }finally{await p.close();}
}
try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0];
  const page=await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('dialog',async d=>{try{await d.accept();}catch{}});
  originalHtml=await openHtml(page);
  if(originalHtml!==post.bodyHtml){
    await save(page,post.bodyHtml);
    changed=true;
  }
  const desktop=await verify(context,1440,1000);
  const mobile=await verify(context,390,844);
  for(const v of [desktop,mobile]){
    if(v.title!==post.title) throw new Error('E_VERIFY_TITLE');
    if(!v.hasQuick||!v.has100g||!v.hasTrend||!v.hasPairing||!v.hasComparison||!v.link195) throw new Error('E_VERIFY_BODY');
    if(!v.hero||v.hero.loading!=='eager'||v.hero.fetchpriority!=='high') throw new Error('E_VERIFY_HERO');
    if(v.secondAppleImages!==0) throw new Error('E_DECORATIVE_IMAGE_REMAINS');
    if(v.tableCount<2||v.h2Count<8) throw new Error('E_STRUCTURE');
  }
  console.log('PASS_APPLE_R2 '+JSON.stringify({changed,desktop,mobile}));
}catch(err){
  console.error('APPLE_R2_FAIL '+(err?.stack||err));
  if(changed&&browser&&originalHtml){
    try{
      const context=browser.contexts()[0];
      const p=await context.newPage();
      p.setDefaultTimeout(30000);
      p.on('dialog',async d=>{try{await d.accept();}catch{}});
      await openHtml(p);
      await save(p,originalHtml);
      console.error('ROLLBACK_APPLE_R2_OK');
    }catch(e){console.error('ROLLBACK_APPLE_R2_FAIL '+(e?.stack||e));}
  }
  throw err;
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
