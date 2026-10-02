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
  page.setDefaultTimeout(20000);
  await page.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
  await page.waitForTimeout(2200);

  const btn=page.locator('button.btn-edit-html');
  await btn.waitFor({state:'visible'});
  console.log('HTML_BTN_OUTER '+JSON.stringify(await btn.evaluate(e=>e.outerHTML)));

  const beforeProbe=await page.evaluate(()=>{
    const e=document.querySelector('.btn-edit-html');
    const keys=e?Object.keys(e):[];
    const pk=keys.find(k=>k.startsWith('__reactProps'));
    const props=pk?e[pk]:null;
    return {
      reactKeys:keys.filter(k=>k.startsWith('__react')).slice(0,10),
      propKeys:props?Object.keys(props):[],
      onClick:props&&props.onClick?String(props.onClick).slice(0,3000):null
    };
  });
  console.log('REACT_PROBE_BEFORE '+JSON.stringify(beforeProbe));

  await btn.click();
  await page.waitForTimeout(1800);

  const after=await page.evaluate(()=>({
    url:location.href,
    codeMirror:document.querySelectorAll('.CodeMirror').length,
    ace:document.querySelectorAll('.ace_editor').length,
    monaco:document.querySelectorAll('.monaco-editor').length,
    textareas:[...document.querySelectorAll('textarea')].map(x=>({id:x.id,cls:x.className,name:x.name,display:getComputedStyle(x).display})),
    editables:[...document.querySelectorAll('[contenteditable="true"]')].map(x=>({tag:x.tagName,cls:x.className,id:x.id})).slice(0,20),
    body:(document.body?.innerText||'').slice(0,8000)
  }));
  console.log('EDITOR_AFTER '+JSON.stringify(after));

  const scripts=await page.locator('script[src]').evaluateAll(xs=>xs.map(x=>x.src).filter(Boolean));
  for(const src of scripts){
    try{
      const res=await page.request.get(src,{timeout:15000});
      if(!res.ok()) continue;
      const txt=await res.text();
      const i=txt.indexOf('btn-edit-html');
      if(i>=0) console.log('SCRIPT_MATCH '+src+' '+JSON.stringify(txt.slice(Math.max(0,i-1500),i+3000)));
    }catch{}
  }
} finally {
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
