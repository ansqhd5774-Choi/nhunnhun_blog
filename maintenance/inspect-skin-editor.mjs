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
 page.on('request',req=>{ if(/skin|design|editor|html|style|css/i.test(req.url())) events.push({type:'request',method:req.method(),url:req.url()}); });
 page.on('response',res=>{ if(/skin|design|editor|html|style|css/i.test(res.url())) events.push({type:'response',status:res.status(),url:res.url()}); });
 await page.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
 if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
 events.length=0;
 await page.locator('button.btn-edit-html').click({force:true});
 await page.waitForTimeout(2500);
 console.log('SKIN_EDIT_NETWORK '+JSON.stringify(events));
 console.log('SKIN_EDIT_STATE '+JSON.stringify({
   url:page.url(),
   bodyText:(await page.locator('body').innerText()).slice(0,12000),
   localStorage:await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),
   sessionStorage:await page.evaluate(()=>Object.fromEntries(Object.entries(sessionStorage)))
 }));
} finally {
 try{await browser?.close();}catch{}
 try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}