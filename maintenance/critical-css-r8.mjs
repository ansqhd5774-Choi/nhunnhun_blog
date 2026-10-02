import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com';
const MARK='<!-- ZG critical css R8 -->';
const CRITICAL=`
${MARK}
<style>
html,body{margin:0;padding:0;min-width:320px;color:#3A4954;background:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo","Malgun Gothic",sans-serif}
*{box-sizing:border-box}
#content,#content.show{opacity:1!important}
#header_wrap{width:100%;position:fixed;top:0;left:0;z-index:99;background:rgba(255,255,255,.96);line-height:85px;min-width:300px}
#header_wrap #header_gnb{max-width:1200px;margin:5px auto 0;display:flex;align-items:center}
#header_wrap #header_gnb #header-title{padding-left:30px;margin-right:auto}
#header_wrap #header_gnb #header-title a{font-size:19px;font-weight:600;color:inherit;text-decoration:none}
#wrap{width:100%;position:relative;min-height:100vh;margin-top:92px;display:inline-block}
#wrap #container{width:min(1200px,100%);margin:0 auto;min-height:100vh}
#main{min-width:0}
#container #main #content{min-width:0;overflow:hidden;position:relative}
.h-entry{max-width:100%;width:100%;margin:0 auto}
.h-entry .content-width{width:100%;max-width:810px;margin:0 auto}
.hd{border-bottom:2px dotted #dadce0}
.hd .hd-heading{display:inline-block;margin:5px 0 10px;font-size:1.5rem}
.hd .sub-info{font-size:14px;color:#667}
.post-content,.contents_style{max-width:100%;margin-top:20px;font-size:16px;overflow-wrap:anywhere}
.post-content p,.contents_style p{line-height:1.9}
.post-content h2,.contents_style h2{margin:22px 0 14px;font-size:1.2rem;padding-left:.75rem;border-left:5px solid #b5d5e8}
.post-content h3,.contents_style h3{margin:20px 0 12px;font-size:1.1rem}
.post-content img,.contents_style img{display:block;max-width:100%!important;height:auto!important;margin-left:auto;margin-right:auto}
.post-content figure,.contents_style figure{max-width:100%;margin:15px auto}
.post-content table,.contents_style table{max-width:100%;width:100%;border-collapse:collapse}
.post-content ul,.post-content ol,.contents_style ul,.contents_style ol{padding-left:1.4rem}
.post-content a,.contents_style a{color:#0052B3;text-decoration:underline}
#container #main #sidebar{max-width:302px;min-width:302px}
@media(min-width:1023px){
 #main.sidebarPosition.right{display:flex;margin:20px;padding-left:10px}
 #main.sidebarPosition.left{display:flex;flex-direction:row-reverse;margin:20px}
 #container #main #sidebar.right{margin-left:45px}
 #container #main #sidebar.left{margin-right:45px}
}
@media(max-width:1023px){
 .h-entry{padding:0 20px 0 24px}
 #sidebar{margin:0!important;padding:20px 20px 20px 10px;max-width:none!important;min-width:0!important}
}
@media(max-width:450px){
 #header_wrap{line-height:63px}
 #header_wrap #header_gnb #header-title{padding-left:18px}
 #header_wrap #header_gnb #header-title a{font-size:17px}
 #wrap{margin-top:70px}
 .h-entry{padding:0 14px 0 18px}
 .hd .hd-heading{font-size:1.4rem}
}
</style>
`;

for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) if(!process.env[k]) throw new Error('E_CONFIG_'+k);
const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({projectId:process.env.BROWSERBASE_PROJECT_ID,browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},timeout:300});
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
    const r=await fetch('/manage/design/skin/html.json',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({html,css,isPreview:false})});
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
 if(!html.includes(MARK)){
   if(!html.includes('</head>')) throw new Error('E_NO_HEAD');
   html=html.replace('</head>',CRITICAL+'\n</head>');
 }
 // Keep preload priority, but make the full skin stylesheet non-render-blocking.
 html=html.replace(/<link([^>]*href=["'][^"']*style\.css[^"']*["'][^>]*)rel=["']stylesheet["']([^>]*)>/i,
   '<link$1rel="stylesheet"$2 media="print" onload="this.media=\'all\'"><noscript><link$1rel="stylesheet"$2></noscript>');
 html=html.replace(/<link\s+rel=["']stylesheet["']([^>]*href=["'][^"']*style\.css[^"']*["'][^>]*)>/i,
   '<link rel="stylesheet"$1 media="print" onload="this.media=\'all\'"><noscript><link rel="stylesheet"$1></noscript>');
 if(html!==original.html){
   const s=await saveSkin(admin,html,original.css);
   if(!s.ok) throw new Error('E_SAVE_'+s.status);
   changed=true;
 }
 const now=await fetchSkin(admin);
 if(!now.html.includes(MARK)) throw new Error('E_CRITICAL_NOT_PERSISTED');
 if(!/style\.css[^>]*media=["']print["']/i.test(now.html) && !/media=["']print["'][^>]*style\.css/i.test(now.html)) throw new Error('E_NONBLOCKING_STYLE_NOT_PERSISTED');
 console.log('PASS_CRITICAL_R8 '+JSON.stringify({changed,htmlDelta:now.html.length-original.html.length}));
}catch(err){
 console.error('CRITICAL_R8_FAIL '+(err?.stack||err));
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
