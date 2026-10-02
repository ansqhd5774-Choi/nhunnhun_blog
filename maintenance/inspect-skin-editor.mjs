import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com';
for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) if(!process.env[k]) throw new Error('E_CONFIG');

const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({
  projectId:process.env.BROWSERBASE_PROJECT_ID,
  browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},
  timeout:300
});
let browser;
try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0];
  const page=await context.newPage();
  page.setDefaultTimeout(25000);
  await page.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');

  const info=await page.evaluate(()=>{
    const all=[...document.querySelectorAll('*')];
    return {
      url:location.href,
      title:document.title,
      text:document.body.innerText.slice(0,10000),
      textareas:[...document.querySelectorAll('textarea')].map((e,i)=>({i,id:e.id,cls:e.className,name:e.name,ph:e.placeholder,len:e.value?.length||0})),
      inputs:[...document.querySelectorAll('input')].map((e,i)=>({i,id:e.id,cls:e.className,type:e.type,name:e.name,ph:e.placeholder,value:(e.value||'').slice(0,100)})),
      buttons:[...document.querySelectorAll('button')].map((e,i)=>({i,id:e.id,cls:e.className,text:(e.innerText||e.textContent||'').trim().slice(0,120),aria:e.getAttribute('aria-label')})).filter(x=>x.text||x.aria),
      codemirror:[...document.querySelectorAll('.CodeMirror')].map((e,i)=>({i,cls:e.className,hasCM:!!e.CodeMirror,len:e.CodeMirror?.getValue?.().length||0,head:(e.CodeMirror?.getValue?.()||'').slice(0,200)})),
      scripts:all.filter(e=>e.tagName==='SCRIPT').map(e=>e.src).filter(Boolean).slice(0,30)
    };
  });
  console.log('SKIN_EDITOR_INSPECT '+JSON.stringify(info));
} finally {
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
