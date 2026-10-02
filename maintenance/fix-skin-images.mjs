import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com';
const MARK='/* ZG article media responsive R1 */';
const PATCH=`
${MARK}
#tt-body-page .post-content img,
#tt-body-page .contents_style img {
  max-width: 100% !important;
  height: auto !important;
  box-sizing: border-box;
}
#tt-body-page .post-content figure,
#tt-body-page .contents_style figure {
  max-width: 100%;
}
`;

for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) {
  if(!process.env[k]) throw new Error('E_CONFIG');
}

const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({
  projectId:process.env.BROWSERBASE_PROJECT_ID,
  browserSettings:{
    context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},
    recordSession:false,
    logSession:false,
    solveCaptchas:false
  },
  timeout:300
});

let browser;
let original=null;
let applied=false;

async function fetchSkin(page){
  return page.evaluate(async()=>{
    const r=await fetch('/manage/design/skin/html.json',{credentials:'include'});
    if(!r.ok) throw new Error('E_GET_SKIN_'+r.status);
    return r.json();
  });
}

async function postSkin(page,html,css){
  return page.evaluate(async({html,css})=>{
    const r=await fetch('/manage/design/skin/html.json',{
      method:'POST',
      credentials:'include',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({html,css,isPreview:false})
    });
    const text=await r.text();
    return {ok:r.ok,status:r.status,text:text.slice(0,500)};
  },{html,css});
}

async function verifyViewport(context,width,height,url){
  const p=await context.newPage();
  await p.setViewportSize({width,height});
  await p.goto(url,{waitUntil:'domcontentloaded'});
  await p.locator('.contents_style').waitFor({state:'visible'});
  const result=await p.evaluate(()=>{
    const content=document.querySelector('.contents_style');
    const cw=content?.getBoundingClientRect().width||0;
    const imgs=[...content.querySelectorAll('img')].map(img=>{
      const r=img.getBoundingClientRect();
      const cs=getComputedStyle(img);
      return {
        alt:img.alt||'',
        width:Math.round(r.width*100)/100,
        height:Math.round(r.height*100)/100,
        naturalWidth:img.naturalWidth,
        naturalHeight:img.naturalHeight,
        maxWidth:cs.maxWidth,
        cssHeight:cs.height
      };
    });
    return {contentWidth:Math.round(cw*100)/100,images:imgs};
  });
  await p.close();
  if(!result.images.length) throw new Error('E_NO_IMAGES');
  if(result.images.some(x=>x.width>result.contentWidth+1)) throw new Error('E_IMAGE_OVERFLOW');
  return result;
}

try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0];
  const admin=await context.newPage();
  admin.setDefaultTimeout(25000);
  await admin.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
  if(new URL(admin.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');

  original=await fetchSkin(admin);
  if(typeof original.html!=='string' || typeof original.css!=='string') throw new Error('E_SKIN_SHAPE');

  const beforeHash=await admin.evaluate(async({html,css})=>{
    const enc=new TextEncoder();
    const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
    return {html:await digest(html),css:await digest(css)};
  },{html:original.html,css:original.css});

  let nextCss=original.css;
  if(!nextCss.includes(MARK)) nextCss += '\n\n'+PATCH+'\n';

  if(nextCss!==original.css){
    const save=await postSkin(admin,original.html,nextCss);
    if(!save.ok) throw new Error('E_SAVE_SKIN_'+save.status);
    applied=true;
  }

  // Re-read live source to confirm the marker is persisted.
  const now=await fetchSkin(admin);
  if(!now.css.includes(MARK)) throw new Error('E_PATCH_NOT_PERSISTED');

  const desktop356=await verifyViewport(context,1440,1200,BLOG+'/356');
  const mobile356=await verifyViewport(context,390,900,BLOG+'/356');
  const desktop354=await verifyViewport(context,1440,1200,BLOG+'/354');
  const mobile354=await verifyViewport(context,390,900,BLOG+'/354');

  console.log('PASS_SKIN_IMAGE_R1 '+JSON.stringify({
    beforeHash,
    changed:nextCss!==original.css,
    cssLengthBefore:original.css.length,
    cssLengthAfter:now.css.length,
    desktop356,mobile356,desktop354,mobile354
  }));
} catch(err){
  if(applied && original && browser){
    try{
      const context=browser.contexts()[0];
      const admin=context.pages().find(p=>p.url().includes('/manage/design/skin/edit'))||await context.newPage();
      if(!admin.url().includes('/manage/design/skin/edit')) await admin.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
      const rb=await postSkin(admin,original.html,original.css);
      console.error('ROLLBACK_SKIN_IMAGE_R1 '+JSON.stringify(rb));
    }catch{}
  }
  throw err;
} finally {
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
