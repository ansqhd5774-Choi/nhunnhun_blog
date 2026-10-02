import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
const BLOG='https://nhunnhun.tistory.com';
for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) if(!process.env[k]) throw new Error('E_CONFIG');
const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({projectId:process.env.BROWSERBASE_PROJECT_ID,browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},timeout:300});
let browser;
try{
 browser=await chromium.connectOverCDP(session.connectUrl);
 const context=browser.contexts()[0];
 const page=await context.newPage();
 page.setDefaultTimeout(25000);
 const events=[];
 page.on('request',req=>{
   const rt=req.resourceType();
   if(['xhr','fetch','document'].includes(rt)) events.push({type:'request',rt,method:req.method(),url:req.url(),postData:(req.postData()||'').slice(0,1000)});
 });
 page.on('response',async res=>{
   const req=res.request(),rt=req.resourceType();
   if(['xhr','fetch','document'].includes(rt)){
     let body='';
     try{
       const ct=res.headers()['content-type']||'';
       if(/json|text|javascript|xml|html/.test(ct)) body=(await res.text()).slice(0,2500);
     }catch{}
     events.push({type:'response',rt,status:res.status(),url:res.url(),ct:res.headers()['content-type']||'',body});
   }
 });
 await page.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
 if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
 events.length=0;
 await page.locator('button.btn-edit-html').click({force:true});
 await page.waitForTimeout(3500);
 console.log('SKIN_EDIT_ALL_IO '+JSON.stringify(events));
} finally {
 try{await browser?.close();}catch{}
 try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}