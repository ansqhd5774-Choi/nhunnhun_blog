import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com';
const MARK='<!-- ZG critical desktop stability R5 -->';
const PATCH=`
${MARK}
<style id="zg-critical-desktop-stability-r5">
@media only screen and (min-width:1023px){
  html{
    overflow-y:scroll;
    scrollbar-gutter:stable;
  }
  #wrap,
  #wrap #container{
    min-height:100vh;
  }
}
</style>
`;

for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']){
  if(!process.env[k]) throw new Error('E_CONFIG_'+k);
}
const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({
  projectId:process.env.BROWSERBASE_PROJECT_ID,
  browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},
  timeout:300
});
let browser,original=null,changed=false;

async function fetchSkin(page){
  return page.evaluate(async()=>{
    const r=await fetch('/manage/design/skin/html.json',{credentials:'include'});
    if(!r.ok) throw new Error('E_GET_SKIN_'+r.status);
    return r.json();
  });
}
async function saveSkin(page,html,css){
  return page.evaluate(async({html,css})=>{
    const r=await fetch('/manage/design/skin/html.json',{
      method:'POST',credentials:'include',headers:{'content-type':'application/json'},
      body:JSON.stringify({html,css,isPreview:false})
    });
    return {ok:r.ok,status:r.status,text:(await r.text()).slice(0,300)};
  },{html,css});
}
try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0];
  const admin=await context.newPage();
  admin.setDefaultTimeout(25000);
  await admin.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
  if(new URL(admin.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');

  original=await fetchSkin(admin);
  let html=original.html;
  if(!html.includes(MARK)){
    const anchor=html.indexOf('<!-- ZG critical desktop grid R4 -->');
    if(anchor>=0) html=html.slice(0,anchor)+PATCH+'\n'+html.slice(anchor);
    else {
      const firstStyle=html.search(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/i);
      if(firstStyle<0) throw new Error('E_INSERT_POINT');
      html=html.slice(0,firstStyle)+PATCH+'\n'+html.slice(firstStyle);
    }
  }

  if(html!==original.html){
    const s=await saveSkin(admin,html,original.css);
    if(!s.ok) throw new Error('E_SAVE_'+s.status);
    changed=true;
  }

  const now=await fetchSkin(admin);
  if(!now.html.includes(MARK)) throw new Error('E_NOT_PERSISTED');

  const p=await context.newPage();
  await p.setViewportSize({width:1440,height:1000});
  await p.goto(BLOG+'/356',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1000);
  const live=await p.evaluate(()=> {
    const c=document.querySelector('#container');
    const r=c?.getBoundingClientRect();
    return {
      title:document.title,
      container:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,
      htmlOverflowY:getComputedStyle(document.documentElement).overflowY,
      gutter:getComputedStyle(document.documentElement).scrollbarGutter
    };
  });
  await p.close();
  if(!live.container||live.container.height<900) throw new Error('E_CONTAINER_MINHEIGHT');
  console.log('PASS_DESKTOP_STABILITY_R5 '+JSON.stringify({changed,htmlDelta:now.html.length-original.html.length,live}));
}catch(err){
  console.error('DESKTOP_STABILITY_R5_FAIL '+(err?.stack||err));
  if(changed&&original&&browser){
    try{
      const context=browser.contexts()[0];
      const a=context.pages().find(p=>p.url().includes('/manage/design/skin/edit'))||await context.newPage();
      if(!a.url().includes('/manage/design/skin/edit')) await a.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
      console.error('ROLLBACK_DESKTOP_STABILITY_R5 '+JSON.stringify(await saveSkin(a,original.html,original.css)));
    }catch(e){console.error('ROLLBACK_R5_FAIL '+(e?.stack||e));}
  }
  throw err;
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
