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
 const data=await page.evaluate(async()=>{
   const r=await fetch('/manage/design/skin/current.json',{credentials:'include'});
   const text=await r.text();
   let json=null; try{json=JSON.parse(text)}catch{}
   const summarize=(v)=>{
     if(typeof v==='string') return {type:'string',len:v.length,head:v.slice(0,500)};
     if(Array.isArray(v)) return {type:'array',len:v.length,head:v.slice(0,5)};
     if(v&&typeof v==='object') return {type:'object',keys:Object.keys(v).slice(0,100)};
     return {type:typeof v,value:v};
   };
   return {status:r.status,headers:Object.fromEntries([...r.headers.entries()].filter(([k])=>['content-type','etag','last-modified'].includes(k))),keys:json?Object.keys(json):[],summary:json?Object.fromEntries(Object.entries(json).map(([k,v])=>[k,summarize(v)])):null,rawHead:text.slice(0,3000)};
 });
 console.log('SKIN_CURRENT_JSON '+JSON.stringify(data));
} finally {
 try{await browser?.close();}catch{}
 try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}