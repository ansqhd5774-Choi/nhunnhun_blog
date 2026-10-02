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
  await page.locator('#mceu_0-open').click();
  await page.locator('#attach-image').click();
  await page.waitForTimeout(700);
  const data=await page.evaluate(()=>({
    fileInputs:[...document.querySelectorAll('input[type="file"]')].map((e,i)=>({
      i,id:e.id,name:e.name,accept:e.accept,multiple:e.multiple,
      cls:String(e.className||'').slice(0,140),outer:e.outerHTML.slice(0,500)
    })),
    dialogs:[...document.querySelectorAll('[role="dialog"],.mce-window')].filter(e=>getComputedStyle(e).display!=='none').map((e,i)=>({
      i,id:e.id,cls:String(e.className||'').slice(0,140),
      text:(e.innerText||e.textContent||'').trim().replace(/\s+/g,' ').slice(0,500)
    }))
  }));
  console.log('IMAGE_UPLOAD_UI '+JSON.stringify(data));
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}