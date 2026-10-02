import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com';
const MARK='/* ZG nonblocking material icons R4 */';
const ICON_URL='https://fonts.googleapis.com/css?family=Material+Icons+Outlined&display=swap';
const CSS_PATCH=`
${MARK}
.material-icons-outlined,
.material-icons-round,
.material-icon,
.toc-icon,
.floating-toc-icon{
  display:inline-block;
  min-width:1em;
  width:1em;
  line-height:1;
}
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
  let css=original.css;
  const linkRe=new RegExp('<link\\s+rel=["\\\']stylesheet["\\\']\\s+href=["\\\']'+ICON_URL.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&')+'["\\\']\\s*/?>','i');
  const altRe=new RegExp('<link\\s+href=["\\\']'+ICON_URL.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&')+'["\\\']\\s+rel=["\\\']stylesheet["\\\']\\s*/?>','i');

  if(linkRe.test(html)){
    html=html.replace(linkRe,`<link rel="stylesheet" href="${ICON_URL}" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="${ICON_URL}"></noscript>`);
  }else if(altRe.test(html)){
    html=html.replace(altRe,`<link rel="stylesheet" href="${ICON_URL}" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="${ICON_URL}"></noscript>`);
  }else if(!html.includes('media="print"') || !html.includes(ICON_URL)){
    throw new Error('E_ICON_STYLESHEET_NOT_FOUND');
  }

  if(!css.includes(MARK)) css+='\n\n'+CSS_PATCH+'\n';

  if(html!==original.html||css!==original.css){
    const s=await saveSkin(admin,html,css);
    if(!s.ok) throw new Error('E_SAVE_'+s.status);
    changed=true;
  }

  const now=await fetchSkin(admin);
  if(!now.css.includes(MARK)) throw new Error('E_CSS_NOT_PERSISTED');
  if(!now.html.includes(ICON_URL)||!now.html.includes('media="print"')) throw new Error('E_HTML_NOT_PERSISTED');

  console.log('PASS_PERF_R4 '+JSON.stringify({changed,htmlDelta:now.html.length-original.html.length,cssDelta:now.css.length-original.css.length}));
}catch(err){
  console.error('PERF_R4_FAIL '+(err?.stack||err));
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
