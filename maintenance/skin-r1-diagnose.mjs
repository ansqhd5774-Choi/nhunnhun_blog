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
  page.on('dialog', async d => {
    console.log('DIALOG '+d.type()+' '+JSON.stringify(d.message()));
    if(d.type()==='confirm') await d.accept(); else await d.dismiss();
  });
  await page.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
  await page.locator('button.btn-edit-html').waitFor({state:'visible'});
  await page.locator('button.btn-edit-html').click();
  await page.waitForTimeout(2500);
  const out=await page.evaluate(()=>({
    url:location.href,title:document.title,body:(document.body?.innerText||'').slice(0,12000),
    codeMirror:document.querySelectorAll('.CodeMirror').length,
    ace:document.querySelectorAll('.ace_editor').length,
    monaco:document.querySelectorAll('.monaco-editor').length,
    textareas:[...document.querySelectorAll('textarea')].map(x=>({id:x.id,cls:x.className,name:x.name,valueLen:x.value?.length||0,display:getComputedStyle(x).display})),
    buttons:[...document.querySelectorAll('button')].map(x=>({t:(x.innerText||x.getAttribute('aria-label')||'').trim(),cls:x.className})).filter(x=>x.t).slice(0,100),
    tabs:[...document.querySelectorAll('[role="tab"],a,button')].map(x=>({t:(x.innerText||'').trim(),cls:x.className,href:x.href||''})).filter(x=>/html|css|파일|저장|적용/i.test(x.t)).slice(0,100)
  }));
  console.log('EDITOR_PROBE '+JSON.stringify(out));
} finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
