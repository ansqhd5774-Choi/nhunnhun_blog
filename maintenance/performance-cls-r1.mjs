import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com';
const MARK='/* ZG CLS reserve R1 */';
const PATCH=`
${MARK}
#tt-body-page .contents_style img[alt="붉은 사과 두 개"]{
  aspect-ratio:960 / 605;
}
#tt-body-page .contents_style img[alt="반으로 자른 사과"]{
  aspect-ratio:960 / 640;
}
#tt-body-page .h-entry ins.adsbygoogle,
#tt-body-page .post-content ins.adsbygoogle,
#tt-body-page .ads-wrap{
  min-height:100px !important;
  contain-intrinsic-size:auto 100px;
}
`;

for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) {
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
async function verify(context,w,h){
  const p=await context.newPage();
  try{
    await p.setViewportSize({width:w,height:h});
    await p.goto(BLOG+'/356',{waitUntil:'domcontentloaded'});
    await p.locator('.contents_style').waitFor({state:'visible'});
    await p.waitForTimeout(1000);
    return await p.evaluate(()=>{
      const hero=document.querySelector('.contents_style img[alt="붉은 사과 두 개"]');
      const sliced=document.querySelector('.contents_style img[alt="반으로 자른 사과"]');
      const ads=[...document.querySelectorAll('.post-content .adsbygoogle, .ads-wrap')].map(el=>{
        const cs=getComputedStyle(el),r=el.getBoundingClientRect();
        return {className:el.className,minHeight:cs.minHeight,height:Math.round(r.height),display:cs.display};
      });
      return {
        hero:hero?{aspectRatio:getComputedStyle(hero).aspectRatio,width:hero.getAttribute('width'),height:hero.getAttribute('height')}:null,
        sliced:sliced?{aspectRatio:getComputedStyle(sliced).aspectRatio,width:sliced.getAttribute('width'),height:sliced.getAttribute('height')}:null,
        ads
      };
    });
  } finally {await p.close();}
}

try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0];
  const admin=await context.newPage();
  admin.setDefaultTimeout(25000);
  await admin.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
  if(new URL(admin.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');

  original=await fetchSkin(admin);
  if(typeof original.css!=='string') throw new Error('E_SKIN_SHAPE');
  let css=original.css;
  if(!css.includes(MARK)) css+='\n\n'+PATCH+'\n';

  if(css!==original.css){
    const s=await saveSkin(admin,original.html,css);
    if(!s.ok) throw new Error('E_SAVE_'+s.status);
    changed=true;
  }

  const now=await fetchSkin(admin);
  if(!now.css.includes(MARK)) throw new Error('E_PATCH_NOT_PERSISTED');

  const desktop=await verify(context,1440,1000);
  const mobile=await verify(context,390,844);
  console.log('PASS_CLS_RESERVE_R1 '+JSON.stringify({
    changed,
    note:'Skin source persisted; public CDN verification is intentionally external to avoid false rollback during propagation.',
    desktop,
    mobile
  }));
}catch(err){
  console.error('CLS_RESERVE_R1_FAIL '+(err?.stack||err));
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
