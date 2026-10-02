import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com';
const MARK='<!-- NHUNNHUN INLINE CSS R7 -->';

for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']){
  if(!process.env[k]) throw new Error('E_CONFIG_'+k);
}
const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({
  projectId:process.env.BROWSERBASE_PROJECT_ID,
  browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},
  timeout:300
});
let browser,original,changed=false;

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
      method:'POST',credentials:'include',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({html,css,isPreview:false})
    });
    return {ok:r.ok,status:r.status,text:(await r.text()).slice(0,300)};
  },{html,css});
}
async function verify(context,url,width,height){
  const p=await context.newPage();
  try{
    await p.setViewportSize({width,height});
    await p.goto(url,{waitUntil:'domcontentloaded'});
    await p.waitForTimeout(1200);
    return await p.evaluate(()=>({
      title:document.title,
      bodyDisplay:getComputedStyle(document.body).display,
      contentDisplay:getComputedStyle(document.querySelector('#content')||document.body).display,
      headerPosition:getComputedStyle(document.querySelector('#header_wrap')||document.body).position,
      skinLinks:[...document.querySelectorAll('link[rel="stylesheet"]')].map(x=>x.href).filter(x=>x.includes('/skin/style.css')),
      inlineMarker:!!document.querySelector('style[data-nhun-r7="1"]'),
      bodyFont:getComputedStyle(document.body).fontFamily
    }));
  }finally{await p.close();}
}

try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0];
  const admin=await context.newPage();
  admin.setDefaultTimeout(25000);
  await admin.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
  if(new URL(admin.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');

  original=await fetchSkin(admin);
  if(typeof original.html!=='string'||typeof original.css!=='string') throw new Error('E_SKIN_SHAPE');
  if(original.css.length<10000) throw new Error('E_CSS_TOO_SMALL');

  let html=original.html;

  // Remove existing external skin CSS preload / stylesheet references.
  html=html.replace(/\s*<link\b[^>]*rel=["']preload["'][^>]*href=["']\.\/style\.css["'][^>]*>\s*/ig,'\n');
  html=html.replace(/\s*<link\b[^>]*href=["']\.\/style\.css["'][^>]*rel=["']preload["'][^>]*>\s*/ig,'\n');
  html=html.replace(/\s*<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']\.\/style\.css["'][^>]*>\s*/ig,'\n');
  html=html.replace(/\s*<link\b[^>]*href=["']\.\/style\.css["'][^>]*rel=["']stylesheet["'][^>]*>\s*/ig,'\n');

  // Replace previous R7 block if this script is rerun.
  html=html.replace(/\s*<!-- NHUNNHUN INLINE CSS R7 -->[\s\S]*?<style data-nhun-r7=["']1["']>[\s\S]*?<\/style>\s*/i,'\n');

  const safeCss=original.css.replace(/<\/style/gi,'<\\/style');
  const block='\n'+MARK+'\n<style data-nhun-r7="1">'+safeCss+'</style>\n';
  if(!html.includes('</head>')) throw new Error('E_NO_HEAD');
  html=html.replace('</head>',block+'</head>');

  if(html!==original.html){
    const saved=await saveSkin(admin,html,original.css);
    if(!saved.ok) throw new Error('E_SAVE_'+saved.status);
    changed=true;
  }

  const now=await fetchSkin(admin);
  if(!now.html.includes(MARK)||!now.html.includes('data-nhun-r7="1"')) throw new Error('E_INLINE_NOT_PERSISTED');
  if(/href=["']\.\/style\.css["']/i.test(now.html)) throw new Error('E_EXTERNAL_SKIN_LINK_REMAINS');

  const checks=[
    await verify(context,BLOG+'/',1440,1000),
    await verify(context,BLOG+'/356',1440,1000),
    await verify(context,BLOG+'/356',390,844),
    await verify(context,BLOG+'/354',390,844)
  ];
  for(const c of checks){
    if(!c.title||c.bodyDisplay==='none'||c.contentDisplay==='none'||c.skinLinks.length) throw new Error('E_PUBLIC_VERIFY');
  }
  console.log('PASS_INLINE_CSS_R7 '+JSON.stringify({changed,cssBytes:original.css.length,htmlBefore:original.html.length,htmlAfter:now.html.length,checks}));
}catch(err){
  console.error('INLINE_CSS_R7_FAIL '+(err?.stack||err));
  if(changed&&original&&browser){
    try{
      const context=browser.contexts()[0];
      const a=context.pages().find(p=>p.url().includes('/manage/design/skin/edit'))||await context.newPage();
      if(!a.url().includes('/manage/design/skin/edit')) await a.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
      console.error('ROLLBACK '+JSON.stringify(await saveSkin(a,original.html,original.css)));
    }catch(e){console.error('ROLLBACK_FAIL '+(e?.stack||e));}
  }
  throw err;
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
