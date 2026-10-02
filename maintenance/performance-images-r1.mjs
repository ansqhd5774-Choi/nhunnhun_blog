import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com';
const POST_ID='356';
const HERO='https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/Red_apple_fruits.jpg/960px-Red_apple_fruits.jpg';
const SLICED='https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Sliced_apple.jpg/960px-Sliced_apple.jpg';
const MARK='/* ZG apple image perf R1 */';
const CSS_PATCH=`
${MARK}
#tt-body-page .contents_style img[alt="붉은 사과 두 개"] {
  width:100% !important;
  max-width:720px !important;
  height:auto !important;
  aspect-ratio:960 / 605;
}
#tt-body-page .contents_style img[alt="반으로 자른 사과"] {
  width:100% !important;
  max-width:720px !important;
  height:auto !important;
  aspect-ratio:960 / 640;
}
`;

for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) if(!process.env[k]) throw new Error('E_CONFIG_'+k);

const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({
  projectId:process.env.BROWSERBASE_PROJECT_ID,
  browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},
  timeout:300
});

let browser;
let originalPost=null;
let originalSkin=null;
let postChanged=false;
let skinChanged=false;

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
function replaceKnownImageUrls(html){
  const oldHero='https://upload.wikimedia.org/wikipedia/commons/0/06/Red_apple_fruits.jpg';
  const oldSliced='https://upload.wikimedia.org/wikipedia/commons/9/92/Sliced_apple.jpg';
  let next=html.replaceAll(oldHero,HERO).replaceAll(oldSliced,SLICED);
  return next;
}
function addImageAttrs(html){
  const heroRe=/<img\b[^>]*alt=["']붉은 사과 두 개["'][^>]*>/i;
  const slicedRe=/<img\b[^>]*alt=["']반으로 자른 사과["'][^>]*>/i;
  if(!heroRe.test(html)) throw new Error('E_HERO_TAG_NOT_FOUND');
  if(!slicedRe.test(html)) throw new Error('E_SLICED_TAG_NOT_FOUND');
  html=html.replace(heroRe,tag=>{
    return tag
      .replace(/\swidth=["'][^"']*["']/ig,'')
      .replace(/\sheight=["'][^"']*["']/ig,'')
      .replace(/\sloading=["'][^"']*["']/ig,'')
      .replace(/\sfetchpriority=["'][^"']*["']/ig,'')
      .replace(/\sdecoding=["'][^"']*["']/ig,'')
      .replace(/>$/,' width="960" height="605" loading="eager" fetchpriority="high" decoding="async">');
  });
  html=html.replace(slicedRe,tag=>{
    return tag
      .replace(/\swidth=["'][^"']*["']/ig,'')
      .replace(/\sheight=["'][^"']*["']/ig,'')
      .replace(/\sloading=["'][^"']*["']/ig,'')
      .replace(/\sfetchpriority=["'][^"']*["']/ig,'')
      .replace(/\sdecoding=["'][^"']*["']/ig,'')
      .replace(/>$/,' width="960" height="640" loading="lazy" decoding="async">');
  });
  return html;
}
async function setPostHtml(page,html){
  const code=page.locator('.CodeMirror:visible .CodeMirror-code');
  await code.waitFor({state:'visible'});
  await code.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(html);
  await page.waitForTimeout(500);
  await page.locator('#publish-layer-btn').click();
  let submit=null;
  for(const name of ['공개 발행','수정','변경사항 저장','완료']){
    const b=page.getByRole('button',{name,exact:true});
    if(await b.count()){submit=b.last();break;}
  }
  if(!submit) throw new Error('E_SUBMIT_BUTTON');
  await submit.click();
  await page.waitForTimeout(3500);
}

async function verify(context,width,height){
  const p=await context.newPage();
  try{
    await p.setViewportSize({width,height});
    await p.goto(BLOG+'/'+POST_ID,{waitUntil:'domcontentloaded'});
    await p.locator('.contents_style').waitFor({state:'visible'});
    await p.waitForTimeout(1600);
    return await p.evaluate(()=>{
      const imgs=[...document.querySelectorAll('.contents_style img')];
      const one=alt=>{
        const img=imgs.find(x=>x.alt===alt);
        if(!img) return null;
        const r=img.getBoundingClientRect(), cs=getComputedStyle(img);
        return {
          src:img.getAttribute('src'),
          currentSrc:img.currentSrc,
          naturalWidth:img.naturalWidth,
          naturalHeight:img.naturalHeight,
          renderedWidth:Math.round(r.width),
          renderedHeight:Math.round(r.height),
          aspectRatio:cs.aspectRatio
        };
      };
      return {hero:one('붉은 사과 두 개'),sliced:one('반으로 자른 사과')};
    });
  } finally { await p.close(); }
}

try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0];

  const admin=await context.newPage();
  admin.setDefaultTimeout(25000);
  admin.on('dialog',async d=>{try{await d.accept();}catch{}});
  await admin.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
  if(new URL(admin.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED_SKIN');
  originalSkin=await fetchSkin(admin);
  let nextCss=originalSkin.css;
  if(!nextCss.includes(MARK)) nextCss+='\n\n'+CSS_PATCH+'\n';
  if(nextCss!==originalSkin.css){
    const s=await saveSkin(admin,originalSkin.html,nextCss);
    if(!s.ok) throw new Error('E_SAVE_SKIN_'+s.status);
    skinChanged=true;
  }

  const post=await context.newPage();
  post.setDefaultTimeout(25000);
  post.on('dialog',async d=>{try{await d.accept();}catch{}});
  originalPost=await openPostHtml(post);
  let next=replaceKnownImageUrls(originalPost);
  next=addImageAttrs(next);
  if(next!==originalPost){
    await setPostHtml(post,next);
    postChanged=true;
  }

  const desktop=await verify(context,1440,1000);
  const mobile=await verify(context,390,844);
  for(const v of [desktop,mobile]){
    if(!v.hero||!v.sliced) throw new Error('E_VERIFY_IMAGES');
    if(!v.hero.src.includes('/thumb/0/06/Red_apple_fruits.jpg/960px-Red_apple_fruits.jpg')) throw new Error('E_HERO_SRC');
    if(!v.sliced.src.includes('/thumb/9/92/Sliced_apple.jpg/960px-Sliced_apple.jpg')) throw new Error('E_SLICED_SRC');
    if(v.hero.naturalWidth>960||v.sliced.naturalWidth>960) throw new Error('E_OVERSIZED_IMAGE');
    if(v.hero.aspectRatio==='auto'||v.sliced.aspectRatio==='auto') throw new Error('E_ASPECT_RATIO');
    if(v.hero.renderedWidth<=0||v.sliced.renderedWidth<=0) throw new Error('E_RENDERED_SIZE');
  }
  console.log('PASS_APPLE_IMAGE_PERF_R1 '+JSON.stringify({postChanged,skinChanged,desktop,mobile}));
} catch(err){
  console.error('APPLE_IMAGE_PERF_R1_FAIL '+(err?.stack||err));
  try{
    if(browser){
      const context=browser.contexts()[0];
      if(postChanged&&originalPost){
        const p=await context.newPage();
        p.setDefaultTimeout(25000);
        p.on('dialog',async d=>{try{await d.accept();}catch{}});
        await openPostHtml(p);
        await setPostHtml(p,originalPost);
        await p.close();
        console.error('ROLLBACK_POST_OK');
      }
      if(skinChanged&&originalSkin){
        const a=await context.newPage();
        await a.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
        const rb=await saveSkin(a,originalSkin.html,originalSkin.css);
        console.error('ROLLBACK_SKIN '+JSON.stringify(rb));
        await a.close();
      }
    }
  }catch(rbErr){console.error('ROLLBACK_FAIL '+(rbErr?.stack||rbErr));}
  throw err;
} finally {
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
