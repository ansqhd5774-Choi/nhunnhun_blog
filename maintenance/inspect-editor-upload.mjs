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
  const attach=page.locator('#attach-layer-btn:visible').first();
  await attach.click();
  await page.waitForTimeout(500);
  const data=await page.evaluate(()=>({
    visibleText:[...document.querySelectorAll('body *')].filter(e=>{
      const cs=getComputedStyle(e),r=e.getBoundingClientRect();
      return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0&&/사진|이미지|파일|첨부|카메라|photo|image|file/i.test((e.innerText||e.textContent||'').trim());
    }).slice(0,80).map((e,i)=>({i,tag:e.tagName,id:e.id,cls:String(e.className||'').slice(0,150),text:(e.innerText||e.textContent||'').trim().replace(/\s+/g,' ').slice(0,220),outer:e.outerHTML.slice(0,500)})),
    inputs:[...document.querySelectorAll('input')].map((e,i)=>({i,id:e.id,cls:String(e.className||'').slice(0,120),type:e.type,name:e.name,accept:e.accept,hidden:e.hidden,display:getComputedStyle(e).display,outer:e.outerHTML.slice(0,500)}))
  }));
  console.log('ATTACH_MENU '+JSON.stringify(data));
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}