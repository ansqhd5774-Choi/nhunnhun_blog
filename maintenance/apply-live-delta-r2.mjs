import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com';
const A11Y='/* BLOG A11Y R1 LIVE */';
const CRAWL='/* BLOG CRAWL UI R1 LIVE */';

for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) if(!process.env[k]) throw new Error('E_CONFIG_'+k);
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
    return {ok:r.ok,status:r.status,text:(await r.text()).slice(0,200)};
  },{html,css});
}
async function inspect(context,url,w,h){
  const p=await context.newPage();
  try{
    await p.setViewportSize({width:w,height:h});
    await p.goto(url,{waitUntil:'domcontentloaded'});
    await p.waitForTimeout(1200);
    return await p.evaluate(()=>({
      title:document.title,
      input:(()=>{const e=document.querySelector('#search-input'); if(!e)return null; const r=e.getBoundingClientRect(),s=getComputedStyle(e); return {h:Math.round(r.height),aria:e.getAttribute('aria-label'),display:s.display}})(),
      btn:(()=>{const e=document.querySelector('button.search-icon'); if(!e)return null; const r=e.getBoundingClientRect(); return {w:Math.round(r.width),h:Math.round(r.height),aria:e.getAttribute('aria-label')}})(),
      oldFooter:document.body.innerText.includes('쭈미로운 생활')||document.body.innerText.includes('Designed by'),
      crawlerNoise:['format_list_bulleted','textsms','navigate_before','navigate_next'].some(x=>document.body.innerText.includes(x))
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

  let html=original.html;
  let css=original.css;

  if(html.includes('dns-preferch')) html=html.replace(/dns-preferch/g,'dns-prefetch');
  html=html.replace(/\s*<meta name=["']title["'] content=["']\[##_page_title_##\]["']\s*\/?>/ig,'');
  html=html.replace(/\s*<meta name=["']description["'] content=["']\[##_desc_##\]["']\s*\/?>/ig,'');

  if(!html.includes('max-image-preview:large')){
    html=html.replace(/<meta name=["']viewport["']/, '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">\n<meta name="viewport"');
  }

  html=html.replace(/<button class=["']search-icon["'][^>]*aria-label=["'][^"']*["']/, m=>m.replace(/aria-label=["'][^"']*["']/,'aria-label="검색"'));
  if(!/id=["']search-input["'][^>]*aria-label=["']검색어 입력["']/i.test(html)){
    html=html.replace(/(<input\b[^>]*id=["']search-input["'])([^>]*>)/i,'$1 aria-label="검색어 입력"$2');
  }
  html=html.replace(/<button class=["']search-close-icon["'](?![^>]*aria-label)/i,'<button type="button" class="search-close-icon" aria-label="검색 닫기"');
  html=html.replace(/<button class=["']search-icon["']/i,'<button type="button" class="search-icon"');
  html=html.replace(/<button class=["']btn_topMenu["']([^>]*)aria-label=["'][^"']*["']/i,'<button type="button" class="btn_topMenu"$1aria-label="메뉴 열기"');

  html=html.replace('<p class="post_text"> [##_article_rep_summary_##]','<p class="post_text">[##_article_rep_summary_##]</p>');
  html=html.replace('<ui id="duplicateWordsContainer"></ui>','<ul id="duplicateWordsContainer"></ul>');

  html=html.replace(/<span class=["']material-icons-outlined["'] style=["']padding-bottom: 1px;["']>format_list_bulleted<\/span>/i,'<svg class="meta-svg" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path d="M4 6h2v2H4V6Zm4 0h12v2H8V6ZM4 11h2v2H4v-2Zm4 0h12v2H8v-2ZM4 16h2v2H4v-2Zm4 0h12v2H8v-2Z"/></svg>');
  html=html.replace(/<span class=["']material-icons-outlined["']>textsms<\/span>/i,'<svg class="meta-svg" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path d="M4 4h16v12H7l-3 3V4Zm2 2v8.17L6.17 14H18V6H6Z"/></svg>');
  html=html.replace(/<span class=["']material-icons-outlined page-icon["']>navigate_before<\/span>/i,'<svg class="page-icon" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path d="m14.5 5-7 7 7 7 1.5-1.5L10.5 12 16 6.5 14.5 5Z"/></svg>');
  html=html.replace(/<span class=["']material-icons-outlined page-icon["']>navigate_next<\/span>/i,'<svg class="page-icon" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path d="m9.5 5 7 7-7 7L8 17.5l5.5-5.5L8 6.5 9.5 5Z"/></svg>');

  html=html.replace(/<div class=["']ft-al["']>Copyright © <a href=["']https:\/\/toyou101\.tistory\.com["']>쭈미로운 생활<\/a> All rights reserved\.<\/div>\s*<div class=["']ft-ac["']>Designed by <a href=["']https:\/\/toyou101\.tistory\.com["']>JJuum<\/a><\/div>/i,'<div class="ft-al">Copyright © [##_title_##] All rights reserved.</div>');

  if(!css.includes(A11Y)) css += '\n\n'+A11Y+'\n#search-bar .input-text{min-height:48px;line-height:48px}\n#search-bar .search-icon,#search-bar .search-close-icon{min-width:48px;min-height:48px}\n.post-reply .tt_box_namecard .tt_desc,.post-reply .tt_box_namecard a.tt_desc{color:#333!important}\n';
  if(!css.includes(CRAWL)) css += '\n'+CRAWL+'\n.meta-svg,.page-icon{display:inline-block;vertical-align:middle;fill:currentColor;flex:0 0 auto}\n.post_list .meta-svg{margin-right:3px}\n#footer{justify-content:center}\n';

  if(html!==original.html||css!==original.css){
    const s=await saveSkin(admin,html,css);
    if(!s.ok) throw new Error('E_SAVE_'+s.status);
    changed=true;
  }

  const now=await fetchSkin(admin);
  if(!now.css.includes(A11Y)||!now.css.includes(CRAWL)) throw new Error('E_CSS_PERSIST');
  if(!/id=["']search-input["'][^>]*aria-label=["']검색어 입력["']/i.test(now.html)) throw new Error('E_HTML_PERSIST');

  const checks=[
    await inspect(context,BLOG+'/',1440,1000),
    await inspect(context,BLOG+'/356',1440,1000),
    await inspect(context,BLOG+'/356',390,844),
    await inspect(context,BLOG+'/category/Healthy%20Life/%EC%9D%8C%EC%8B%9D',390,844)
  ];
  for(const x of checks){
    if(!x.title) throw new Error('E_TITLE');
    if(x.input && x.input.display!=='none' && x.input.h<48) throw new Error('E_INPUT_HEIGHT');
    if(x.btn && (x.btn.w<48||x.btn.h<48)) throw new Error('E_BTN_SIZE');
    if(x.oldFooter||x.crawlerNoise) throw new Error('E_PUBLIC_NOISE');
  }
  console.log('PASS_LIVE_DELTA_R2 '+JSON.stringify({changed,checks}));
}catch(err){
  console.error('LIVE_DELTA_R2_FAIL '+(err?.stack||err));
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
