import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com';
const HTML_MARK='<!-- ZG critical layout R3 -->';
const CSS_MARK='/* ZG performance layout R3 */';

const CRITICAL=`
${HTML_MARK}
<style id="zg-critical-layout-r3">
@media only screen and (min-width:1023px){
  #wrap #container{width:1200px;margin:0 auto;}
  #main.sidebarPosition.left{
    display:flex;
    flex-direction:row-reverse;
    margin:20px;
    padding-left:0;
  }
  #main.sidebarPosition.right{
    display:flex;
    margin:20px;
    padding-left:10px;
  }
  #container #main #content{
    flex:2.85;
    overflow:hidden;
    position:relative;
  }
  #container #main #sidebar{
    flex:1;
    max-width:302px;
    min-width:302px;
    height:fit-content;
  }
  #container #main #sidebar.left{margin-left:0;margin-right:45px;}
  #container #main #sidebar.right{margin-left:45px;margin-right:0;}
  .h-entry .content-width{max-width:810px;margin:0 auto;}
}
</style>
`;

const CSS_PATCH=`
${CSS_MARK}
/* The large inline auto-TOC is inserted after parsing and caused ~0.535 mobile CLS.
   Keep the floating TOC behavior, but remove the layout-affecting inline TOC on small screens. */
@media only screen and (max-width:600px){
  #tt-body-page .e-content.post-content > .toc-space{
    display:none !important;
  }
}
`;

for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']){
  if(!process.env[k]) throw new Error('E_CONFIG_'+k);
}
const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({
  projectId:process.env.BROWSERBASE_PROJECT_ID,
  browserSettings:{
    context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},
    recordSession:false,logSession:false,solveCaptchas:false
  },
  timeout:300
});
let browser, original=null, changed=false;

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
    return {ok:r.ok,status:r.status,text:(await r.text()).slice(0,400)};
  },{html,css});
}
async function verifyPublic(context,width,height){
  const p=await context.newPage();
  await p.setViewportSize({width,height});
  try{
    await p.goto(BLOG+'/356',{waitUntil:'domcontentloaded'});
    await p.locator('.contents_style').waitFor({state:'visible'});
    await p.waitForTimeout(1800);
    return await p.evaluate(()=> {
      const toc=document.querySelector('.e-content.post-content > .toc-space');
      const content=document.querySelector('#content');
      const main=document.querySelector('#main');
      const sidebar=document.querySelector('#sidebar');
      const cw=document.querySelector('.h-entry .content-width');
      const rect=e=>e?{
        x:Math.round(e.getBoundingClientRect().x*100)/100,
        y:Math.round(e.getBoundingClientRect().y*100)/100,
        width:Math.round(e.getBoundingClientRect().width*100)/100,
        height:Math.round(e.getBoundingClientRect().height*100)/100
      }:null;
      return {
        title:document.title,
        toc:toc?{display:getComputedStyle(toc).display,rect:rect(toc)}:null,
        content:content?{display:getComputedStyle(content).display,rect:rect(content)}:null,
        main:main?{display:getComputedStyle(main).display,flexDirection:getComputedStyle(main).flexDirection,rect:rect(main)}:null,
        sidebar:sidebar?{display:getComputedStyle(sidebar).display,rect:rect(sidebar)}:null,
        contentWidth:rect(cw)
      };
    });
  } finally { await p.close(); }
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

  if(!html.includes(HTML_MARK)){
    const firstStyleLink=html.search(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/i);
    if(firstStyleLink>=0) html=html.slice(0,firstStyleLink)+CRITICAL+'\n'+html.slice(firstStyleLink);
    else if(html.includes('</head>')) html=html.replace('</head>',CRITICAL+'\n</head>');
    else throw new Error('E_HEAD_INSERT_POINT');
  }
  if(!css.includes(CSS_MARK)) css+='\n\n'+CSS_PATCH+'\n';

  if(html!==original.html||css!==original.css){
    const s=await saveSkin(admin,html,css);
    if(!s.ok) throw new Error('E_SAVE_'+s.status);
    changed=true;
  }

  const now=await fetchSkin(admin);
  if(!now.html.includes(HTML_MARK)||!now.css.includes(CSS_MARK)) throw new Error('E_PATCH_NOT_PERSISTED');

  const mobile=await verifyPublic(context,390,844);
  const desktop=await verifyPublic(context,1440,1000);

  if(!mobile.title.includes('사과 효능')) throw new Error('E_PAGE_TITLE');
  if(mobile.toc && mobile.toc.display!=='none') throw new Error('E_MOBILE_TOC_VISIBLE');
  if(!desktop.main || desktop.main.display!=='flex') throw new Error('E_DESKTOP_MAIN_NOT_FLEX');
  if(!desktop.content || desktop.content.rect.width>830) throw new Error('E_DESKTOP_CONTENT_WIDTH');

  console.log('PASS_LAYOUT_R3 '+JSON.stringify({
    changed,
    htmlDelta:now.html.length-original.html.length,
    cssDelta:now.css.length-original.css.length,
    mobile,desktop
  }));
}catch(err){
  console.error('LAYOUT_R3_FAIL '+(err?.stack||err));
  if(changed&&original&&browser){
    try{
      const context=browser.contexts()[0];
      const a=context.pages().find(p=>p.url().includes('/manage/design/skin/edit'))||await context.newPage();
      if(!a.url().includes('/manage/design/skin/edit')) await a.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
      console.error('ROLLBACK_LAYOUT_R3 '+JSON.stringify(await saveSkin(a,original.html,original.css)));
    }catch(e){console.error('ROLLBACK_LAYOUT_R3_FAIL '+(e?.stack||e));}
  }
  throw err;
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
