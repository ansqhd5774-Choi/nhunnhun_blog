import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com';
const MARK='<!-- ZG SEO PERF R6 -->';
const ICON_URL='https://fonts.googleapis.com/css?family=Material+Icons+Outlined&display=swap';
const HEAD_ADD=`
${MARK}
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<link rel="preconnect" href="https://t1.daumcdn.net" crossorigin>
<link rel="preconnect" href="https://edge.daumcdn.net" crossorigin>
<link rel="preconnect" href="https://tistory1.daumcdn.net" crossorigin>
<link rel="dns-prefetch" href="//t1.daumcdn.net">
<link rel="dns-prefetch" href="//edge.daumcdn.net">
<link rel="dns-prefetch" href="//tistory1.daumcdn.net">
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

try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0];
  const admin=await context.newPage();
  admin.setDefaultTimeout(25000);
  await admin.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
  if(new URL(admin.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
  original=await fetchSkin(admin);
  if(typeof original.html!=='string'||typeof original.css!=='string') throw new Error('E_SKIN_SHAPE');

  let html=original.html;

  // Remove duplicate generic skin meta tags. Tistory already emits page-specific title/description.
  html=html.replace(/\s*<meta\s+name=["']title["']\s+content=["']\[##_page_title_##\]["']\s*\/?\s*>/ig,'');
  html=html.replace(/\s*<meta\s+name=["']description["']\s+content=["']\[##_desc_##\]["']\s*\/?\s*>/ig,'');

  // R4 already made the icon stylesheet non-blocking; remove its preload so it no longer competes for early bandwidth.
  const iconPreload=new RegExp('\\s*<link\\s+rel=["\\\']preload["\\\']\\s+as=["\\\']style["\\\']\\s+href=["\\\']'+ICON_URL.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&')+'["\\\']\\s*\\/?\\s*>','ig');
  const iconPreloadAlt=new RegExp('\\s*<link\\s+as=["\\\']style["\\\']\\s+href=["\\\']'+ICON_URL.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&')+'["\\\']\\s+rel=["\\\']preload["\\\']\\s*\\/?\\s*>','ig');
  html=html.replace(iconPreload,'').replace(iconPreloadAlt,'');

  if(!html.includes(MARK)){
    if(!html.includes('<head>')) throw new Error('E_NO_HEAD');
    html=html.replace('<head>','<head>\n'+HEAD_ADD);
  }

  if(html!==original.html){
    const saved=await saveSkin(admin,html,original.css);
    if(!saved.ok) throw new Error('E_SAVE_'+saved.status);
    changed=true;
  }
  const now=await fetchSkin(admin);
  if(!now.html.includes(MARK)) throw new Error('E_MARK_NOT_PERSISTED');
  if(now.html.includes('name="description" content="[##_desc_##]"')) throw new Error('E_DUP_DESC_REMAINS');
  if(now.html.includes('rel="preload" as="style" href="'+ICON_URL+'"')) throw new Error('E_ICON_PRELOAD_REMAINS');
  console.log('PASS_R6 '+JSON.stringify({changed,htmlDelta:now.html.length-original.html.length}));
}catch(err){
  console.error('R6_FAIL '+(err?.stack||err));
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
