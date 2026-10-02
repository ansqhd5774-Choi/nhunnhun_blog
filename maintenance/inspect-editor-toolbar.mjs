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
  const selectors=['#editor-tistory','[class*="toolbar"]','[class*="ToolBar"]','[class*="image"]','[class*="photo"]','[data-ke-type]','button'];
  const out={};
  for(const sel of selectors){
    out[sel]=await page.locator(sel).evaluateAll(els=>els.slice(0,80).map((e,i)=>({
      i,tag:e.tagName,id:e.id,cls:String(e.className||'').slice(0,160),
      text:(e.innerText||e.textContent||'').trim().replace(/\s+/g,' ').slice(0,80),
      title:e.getAttribute('title'),aria:e.getAttribute('aria-label'),
      data:[...e.attributes].filter(a=>a.name.startsWith('data-')).reduce((o,a)=>(o[a.name]=a.value,o),{})
    })));
  }
  console.log('EDITOR_TOOLBAR '+JSON.stringify(out));
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}