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
 await page.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
 if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
 const before=context.pages().map((p,i)=>({i,url:p.url(),title:null}));
 let popup=null;
 const popupPromise=context.waitForEvent('page',{timeout:4000}).catch(()=>null);
 await page.locator('button.btn-edit-html').click({force:true});
 popup=await popupPromise;
 await page.waitForTimeout(1500);
 const pages=context.pages();
 const pageInfo=[];
 for(let i=0;i<pages.length;i++){
   const p=pages[i];
   pageInfo.push({i,url:p.url(),title:await p.title().catch(()=>''),frames:p.frames().map((fr,j)=>({j,url:fr.url(),name:fr.name()}))});
 }
 const dom=await page.evaluate(()=>({
   bodyClass:document.body.className,
   iframes:[...document.querySelectorAll('iframe')].map((e,i)=>({i,id:e.id,cls:e.className,src:e.src,title:e.title})),
   editors:[...document.querySelectorAll('[class*="editor"],[id*="editor"],[class*="code"],[id*="code"],[class*="html"],[id*="html"]')].slice(0,100).map((e,i)=>({i,tag:e.tagName,id:e.id,cls:e.className,text:(e.innerText||'').slice(0,100)})),
   btn:document.querySelector('button.btn-edit-html')?.outerHTML
 }));
 console.log('SKIN_EDITOR_ROUTE '+JSON.stringify({before,pageInfo,dom,popup:!!popup}));
} finally {
 try{await browser?.close();}catch{}
 try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}