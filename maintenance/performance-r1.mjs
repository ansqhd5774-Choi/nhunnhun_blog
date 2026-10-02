import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com';
const POST_ID='356';
const MARK='/* ZG performance stability R1 */';
const HERO='https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Red_apple_fruits.jpg/720px-Red_apple_fruits.jpg';
const SLICED='https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Sliced_apple.jpg/720px-Sliced_apple.jpg';

const CSS_PATCH=`
${MARK}
html,body,button,input,select,textarea {
  font-family: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo","Malgun Gothic",sans-serif !important;
}
#content,
#content.show {
  opacity: 1 !important;
  transition: none !important;
}
#tt-body-page .post-content img,
#tt-body-page .contents_style img {
  max-width: 100% !important;
  height: auto !important;
  box-sizing: border-box;
}
`;

for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) {
  if(!process.env[k]) throw new Error('E_CONFIG_'+k);
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
let skinOriginal=null;
let postOriginal=null;
let skinChanged=false;
let postChanged=false;

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
      method:'POST',
      credentials:'include',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({html,css,isPreview:false})
    });
    return {ok:r.ok,status:r.status,text:(await r.text()).slice(0,500)};
  },{html,css});
}

function stripMainFontLinks(html){
  return html
    .replace(/<link\b[^>]*href=["'][^"']*fonts\.googleapis\.com\/css2\?family=\[##_var_mainFont_##\][^"']*["'][^>]*>\s*/gi,'')
    .replace(/<link\b[^>]*href=["'][^"']*fonts\.googleapis\.com\/css2\?family=%5B##_var_mainFont_##%5D[^"']*["'][^>]*>\s*/gi,'');
}

async function openPostHtml(page){
  await page.goto(BLOG+'/manage/post/'+POST_ID,{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED_POST');
  await page.locator('#post-title-inp').waitFor({state:'visible'});
  const title=(await page.locator('#post-title-inp').inputValue()).trim();
  if(!title.includes('사과 효능')) throw new Error('E_WRONG_POST_'+title);
  await page.locator('#editor-mode-layer-btn-open').click();
  await page.locator('#editor-mode-html').click();
  const cm=page.locator('.CodeMirror:visible');
  await cm.waitFor({state:'visible'});
  return cm.evaluate(el=>el?.CodeMirror?.getValue?.()||'');
}

function optimizePostHtml(html){
  const heroTag='<img src="'+HERO+'" alt="붉은 사과 두 개" width="720" height="454" loading="eager" fetchpriority="high" decoding="async" style="width:100%;max-width:720px;height:auto;display:block;margin:16px auto;">';
  const slicedTag='<img src="'+SLICED+'" alt="반으로 자른 사과" width="720" height="480" loading="lazy" decoding="async" style="width:100%;max-width:720px;height:auto;display:block;margin:16px auto;">';
  if(!/<img\b[^>]*alt=["']붉은 사과 두 개["'][^>]*>/i.test(html)) throw new Error('E_HERO_NOT_FOUND');
  if(!/<img\b[^>]*alt=["']반으로 자른 사과["'][^>]*>/i.test(html)) throw new Error('E_SLICED_NOT_FOUND');
  return html
    .replace(/<img\b[^>]*alt=["']붉은 사과 두 개["'][^>]*>/i,heroTag)
    .replace(/<img\b[^>]*alt=["']반으로 자른 사과["'][^>]*>/i,slicedTag);
}

async function setPostHtml(page,html){
  const cm=page.locator('.CodeMirror:visible');
  await cm.waitFor({state:'visible'});
  await cm.evaluate((el,value)=>{
    if(!el?.CodeMirror) throw new Error('E_CODEMIRROR');
    el.CodeMirror.setValue(value);
    el.CodeMirror.save?.();
  },html);
  await page.locator('#publish-layer-btn').click();
  let submit=null;
  for(const name of ['공개 발행','수정','변경사항 저장','완료']){
    const b=page.getByRole('button',{name,exact:true});
    if(await b.count()){submit=b.last();break;}
  }
  if(!submit) throw new Error('E_SUBMIT_BUTTON');
  await submit.click();
  await page.waitForTimeout(3000);
}

async function verify(context,width,height){
  const page=await context.newPage();
  try{
    await page.setViewportSize({width,height});
    await page.goto(BLOG+'/'+POST_ID,{waitUntil:'domcontentloaded'});
    await page.locator('.contents_style').waitFor({state:'visible'});
    await page.waitForTimeout(2500);
    const result=await page.evaluate(()=>{
      const content=document.querySelector('.contents_style');
      const hero=[...document.querySelectorAll('.contents_style img')].find(x=>x.alt==='붉은 사과 두 개');
      const sliced=[...document.querySelectorAll('.contents_style img')].find(x=>x.alt==='반으로 자른 사과');
      const contentNode=document.querySelector('#content');
      const resources=performance.getEntriesByType('resource').map(x=>x.name);
      const pack=img=>img?{
        src:img.getAttribute('src'),
        currentSrc:img.currentSrc,
        widthAttr:img.getAttribute('width'),
        heightAttr:img.getAttribute('height'),
        loading:img.getAttribute('loading'),
        fetchpriority:img.getAttribute('fetchpriority'),
        naturalWidth:img.naturalWidth,
        naturalHeight:img.naturalHeight,
        renderedWidth:Math.round(img.getBoundingClientRect().width),
        renderedHeight:Math.round(img.getBoundingClientRect().height)
      }:null;
      return {
        viewport:{width:innerWidth,height:innerHeight},
        contentWidth:Math.round(content?.getBoundingClientRect().width||0),
        hero:pack(hero),
        sliced:pack(sliced),
        contentOpacity:contentNode?getComputedStyle(contentNode).opacity:null,
        contentTransition:contentNode?getComputedStyle(contentNode).transitionDuration:null,
        bodyFont:getComputedStyle(document.body).fontFamily,
        mainFontResource:resources.find(x=>/fonts\.googleapis\.com\/css2\?family=.*Hahmlet/i.test(x))||null
      };
    });
    if(!result.hero||!result.sliced) throw new Error('E_VERIFY_IMAGES');
    if(result.hero.widthAttr!=='720'||result.hero.heightAttr!=='454') throw new Error('E_HERO_DIMENSIONS');
    if(result.sliced.widthAttr!=='720'||result.sliced.heightAttr!=='480') throw new Error('E_SLICED_DIMENSIONS');
    if(result.hero.naturalWidth>900||result.sliced.naturalWidth>900) throw new Error('E_THUMB_NOT_USED');
    if(result.hero.renderedWidth>result.contentWidth+1||result.sliced.renderedWidth>result.contentWidth+1) throw new Error('E_IMAGE_OVERFLOW');
    if(result.contentOpacity!=='1') throw new Error('E_CONTENT_OPACITY');
    if(/Hahmlet/i.test(result.bodyFont)) throw new Error('E_FONT_STILL_HAHMLET');
    return result;
  } finally {
    await page.close();
  }
}

try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0];

  const admin=await context.newPage();
  admin.setDefaultTimeout(25000);
  admin.on('dialog',async d=>{try{await d.accept();}catch{}});

  await admin.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
  if(new URL(admin.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED_SKIN');

  skinOriginal=await fetchSkin(admin);
  if(typeof skinOriginal.html!=='string'||typeof skinOriginal.css!=='string') throw new Error('E_SKIN_SHAPE');

  let nextHtml=stripMainFontLinks(skinOriginal.html);
  let nextCss=skinOriginal.css;
  if(!nextCss.includes(MARK)) nextCss+='\n\n'+CSS_PATCH+'\n';

  if(nextHtml!==skinOriginal.html||nextCss!==skinOriginal.css){
    const saved=await saveSkin(admin,nextHtml,nextCss);
    if(!saved.ok) throw new Error('E_SAVE_SKIN_'+saved.status);
    skinChanged=true;
  }

  const reread=await fetchSkin(admin);
  if(!reread.css.includes(MARK)) throw new Error('E_SKIN_PATCH_NOT_PERSISTED');
  if(/fonts\.googleapis\.com\/css2\?family=\[##_var_mainFont_##\]/i.test(reread.html)) throw new Error('E_MAIN_FONT_LINK_PERSISTED');

  const postPage=await context.newPage();
  postPage.setDefaultTimeout(25000);
  postPage.on('dialog',async d=>{try{await d.accept();}catch{}});
  postOriginal=await openPostHtml(postPage);
  const postNext=optimizePostHtml(postOriginal);
  if(postNext!==postOriginal){
    await setPostHtml(postPage,postNext);
    postChanged=true;
  }

  const desktop=await verify(context,1440,1200);
  const mobile=await verify(context,390,900);

  console.log('PASS_PERFORMANCE_R1 '+JSON.stringify({
    skinChanged,
    postChanged,
    htmlFontLinksRemoved:skinOriginal.html.length-reread.html.length,
    cssLengthBefore:skinOriginal.css.length,
    cssLengthAfter:reread.css.length,
    desktop,
    mobile
  }));
} catch(err){
  console.error('PERFORMANCE_R1_FAIL '+(err?.stack||err));
  try{
    if(browser){
      const context=browser.contexts()[0];
      if(postChanged&&postOriginal){
        const p=await context.newPage();
        p.setDefaultTimeout(25000);
        p.on('dialog',async d=>{try{await d.accept();}catch{}});
        await openPostHtml(p);
        await setPostHtml(p,postOriginal);
        await p.close();
        console.error('ROLLBACK_POST_R1_OK');
      }
      if(skinChanged&&skinOriginal){
        const a=await context.newPage();
        await a.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
        const rb=await saveSkin(a,skinOriginal.html,skinOriginal.css);
        console.error('ROLLBACK_SKIN_R1 '+JSON.stringify(rb));
        await a.close();
      }
    }
  }catch(rbErr){
    console.error('ROLLBACK_R1_FAIL '+(rbErr?.stack||rbErr));
  }
  throw err;
} finally {
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
