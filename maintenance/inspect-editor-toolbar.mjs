import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
const BLOG='https://nhunnhun.tistory.com', POST_ID='356';
for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) if(!process.env[k]) throw new Error('E_CONFIG_'+k);
const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({projectId:process.env.BROWSERBASE_PROJECT_ID,browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},timeout:300});
let browser;
try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0], page=await context.newPage();
  page.setDefaultTimeout(25000);
  await page.goto(BLOG+'/manage/post/'+POST_ID,{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
  await page.locator('#post-title-inp').waitFor({state:'visible'});
  await page.locator('#publish-layer-btn').click();
  await page.waitForTimeout(600);
  const data=await page.evaluate(()=>({
    text:(document.body.innerText||'').split('\n').filter(x=>/대표|이미지|썸네일|공개|발행|수정/.test(x)).slice(0,120),
    controls:[...document.querySelectorAll('button,[role="button"],label,input')].map((e,i)=>({
      i,tag:e.tagName,id:e.id,cls:String(e.className||'').slice(0,140),
      text:(e.innerText||e.textContent||'').trim().replace(/\s+/g,' ').slice(0,120),
      title:e.getAttribute('title'),aria:e.getAttribute('aria-label'),type:e.getAttribute('type'),
      accept:e.getAttribute('accept')
    })).filter(x=>/대표|이미지|썸네일|thumbnail|cover|발행|수정/.test([x.text,x.title,x.aria,x.id,x.cls,x.accept].join(' '))).slice(0,120),
    imgs:[...document.querySelectorAll('img')].map((e,i)=>({i,src:e.src,alt:e.alt,cls:String(e.className||'').slice(0,120),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})).filter(x=>x.w>0&&x.h>0).slice(-30)
  }));
  console.log('PUBLISH_PANEL '+JSON.stringify(data));
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
