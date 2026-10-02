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
  await page.goto(BLOG+'/manage',{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
  const snap=async label=>{
    const data=await page.evaluate(()=>({
      url:location.href,
      title:document.title,
      body:(document.body?.innerText||'').slice(0,12000),
      links:[...document.querySelectorAll('a')].map(a=>({t:(a.innerText||'').trim(),h:a.href})).filter(x=>/스킨|꾸미기|html|css|디자인/i.test(x.t+' '+x.h)).slice(0,100),
      buttons:[...document.querySelectorAll('button')].map(b=>(b.innerText||b.getAttribute('aria-label')||'').trim()).filter(Boolean).slice(0,100),
      textareas:[...document.querySelectorAll('textarea')].map(x=>({id:x.id,cls:x.className,name:x.name})),
      codeMirrors:document.querySelectorAll('.CodeMirror').length,
      iframes:[...document.querySelectorAll('iframe')].map(x=>({src:x.src,title:x.title,name:x.name})).slice(0,20)
    }));
    console.log('SNAP_'+label+' '+JSON.stringify(data));
  };
  await snap('MANAGE');

  await page.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2500);
  await snap('DIRECT_EDIT');

  const htmlBtn=page.getByText('html 편집',{exact:true});
  if(await htmlBtn.count()){
    const el=htmlBtn.first();
    console.log('HTML_BTN_OUTER '+JSON.stringify(await el.evaluate(e=>e.outerHTML)));
    const before=context.pages().length;
    await el.click();
    await page.waitForTimeout(1800);
    const pages=context.pages();
    console.log('PAGE_COUNT '+before+'->'+pages.length);
    for(let i=0;i<pages.length;i++){
      const p=pages[i];
      console.log('PAGE_'+i+' '+p.url());
      try{
        const info=await p.evaluate(()=>({title:document.title,body:(document.body?.innerText||'').slice(0,5000),cms:document.querySelectorAll('.CodeMirror').length,textareas:[...document.querySelectorAll('textarea')].map(x=>({id:x.id,cls:x.className,name:x.name}))}));
        console.log('PAGE_INFO_'+i+' '+JSON.stringify(info));
      }catch{}
    }
    await snap('AFTER_HTML_EDIT');
  } else {
    console.log('NO_HTML_EDIT_BUTTON');
  }
} finally {
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
