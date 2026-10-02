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
  const data=await page.evaluate(()=>({
    buttons:[...document.querySelectorAll('button')].slice(0,120).map((e,i)=>({i,id:e.id,cls:String(e.className||'').slice(0,160),text:(e.innerText||e.textContent||'').trim().replace(/\s+/g,' ').slice(0,120),title:e.title,aria:e.getAttribute('aria-label'),data:Object.fromEntries([...e.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value]))})),
    inputs:[...document.querySelectorAll('input')].slice(0,80).map((e,i)=>({i,id:e.id,cls:String(e.className||'').slice(0,120),type:e.type,name:e.name,accept:e.accept,hidden:e.hidden,display:getComputedStyle(e).display})),
    iframes:[...document.querySelectorAll('iframe')].map((e,i)=>({i,id:e.id,cls:e.className,src:e.src,title:e.title}))
  }));
  console.log('EDITOR_UI '+JSON.stringify(data));
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}