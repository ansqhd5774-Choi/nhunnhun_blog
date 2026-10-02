import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com';
const POST_ID='356';
const HERO_330='https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/Red_apple_fruits.jpg/330px-Red_apple_fruits.jpg';
const HERO_960='https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/Red_apple_fruits.jpg/960px-Red_apple_fruits.jpg';
const SLICED_330='https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Sliced_apple.jpg/330px-Sliced_apple.jpg';
const SLICED_960='https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Sliced_apple.jpg/960px-Sliced_apple.jpg';

for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']){
  if(!process.env[k]) throw new Error('E_CONFIG_'+k);
}
const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({
  projectId:process.env.BROWSERBASE_PROJECT_ID,
  browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},
  timeout:300
});
let browser,originalHtml=null,changed=false;

async function openPostHtml(page){
  await page.goto(BLOG+'/manage/post/'+POST_ID,{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
  await page.locator('#post-title-inp').waitFor({state:'visible'});
  const title=(await page.locator('#post-title-inp').inputValue()).trim();
  if(!title.includes('사과 효능')) throw new Error('E_WRONG_POST_'+title);
  await page.locator('#editor-mode-layer-btn-open').click();
  await page.locator('#editor-mode-html').click();
  const cm=page.locator('.CodeMirror:visible');
  await cm.waitFor({state:'visible'});
  return cm.evaluate(el=>el?.CodeMirror?.getValue?.()||'');
}
function patchTag(html,alt,{src,srcset,sizes,width,height,loading,fetchpriority}){
  const re=new RegExp('<img\\b[^>]*alt=["\\\']'+alt.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&')+'["\\\'][^>]*>','i');
  if(!re.test(html)) throw new Error('E_IMG_NOT_FOUND_'+alt);
  return html.replace(re,tag=>{
    let t=tag
      .replace(/\ssrc=["'][^"']*["']/ig,'')
      .replace(/\ssrcset=["'][^"']*["']/ig,'')
      .replace(/\ssizes=["'][^"']*["']/ig,'')
      .replace(/\swidth=["'][^"']*["']/ig,'')
      .replace(/\sheight=["'][^"']*["']/ig,'')
      .replace(/\sloading=["'][^"']*["']/ig,'')
      .replace(/\sfetchpriority=["'][^"']*["']/ig,'')
      .replace(/\sdecoding=["'][^"']*["']/ig,'');
    const attrs=[
      ' src="'+src+'"',
      ' srcset="'+srcset+'"',
      ' sizes="'+sizes+'"',
      ' width="'+width+'"',
      ' height="'+height+'"',
      ' loading="'+loading+'"',
      fetchpriority?' fetchpriority="'+fetchpriority+'"':'',
      ' decoding="async"'
    ].join('');
    return t.replace(/>$/,attrs+'>');
  });
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

try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0];
  const page=await context.newPage();
  page.setDefaultTimeout(25000);
  page.on('dialog',async d=>{try{await d.accept();}catch{}});

  originalHtml=await openPostHtml(page);
  let next=originalHtml;
  next=patchTag(next,'붉은 사과 두 개',{
    src:HERO_960,
    srcset:HERO_330+' 330w, '+HERO_960+' 960w',
    sizes:'(max-width: 600px) 330px, 720px',
    width:'960',height:'605',loading:'eager',fetchpriority:'high'
  });
  next=patchTag(next,'반으로 자른 사과',{
    src:SLICED_960,
    srcset:SLICED_330+' 330w, '+SLICED_960+' 960w',
    sizes:'(max-width: 600px) 330px, 720px',
    width:'960',height:'640',loading:'lazy',fetchpriority:null
  });

  if(next!==originalHtml){
    await setPostHtml(page,next);
    changed=true;
  }

  const pub=await context.newPage();
  await pub.setViewportSize({width:390,height:844});
  await pub.goto(BLOG+'/'+POST_ID,{waitUntil:'domcontentloaded'});
  await pub.locator('.contents_style img[alt="붉은 사과 두 개"]').waitFor({state:'visible'});
  await pub.waitForTimeout(1200);
  const check=await pub.evaluate(()=>{
    const read=alt=>{
      const x=document.querySelector('.contents_style img[alt="'+alt+'"]');
      return x?{
        src:x.getAttribute('src'),
        srcset:x.getAttribute('srcset'),
        sizes:x.getAttribute('sizes'),
        currentSrc:x.currentSrc,
        width:x.getAttribute('width'),
        height:x.getAttribute('height'),
        loading:x.getAttribute('loading'),
        fetchpriority:x.getAttribute('fetchpriority')
      }:null;
    };
    return {hero:read('붉은 사과 두 개'),sliced:read('반으로 자른 사과')};
  });
  if(!check.hero?.srcset?.includes('330w')||!check.hero?.srcset?.includes('960w')) throw new Error('E_HERO_SRCSET');
  if(!check.sliced?.srcset?.includes('330w')||!check.sliced?.srcset?.includes('960w')) throw new Error('E_SLICED_SRCSET');
  console.log('PASS_PERF_R5 '+JSON.stringify(check));
}catch(err){
  console.error('PERF_R5_FAIL '+(err?.stack||err));
  if(changed&&originalHtml&&browser){
    try{
      const context=browser.contexts()[0];
      const p=await context.newPage();
      p.setDefaultTimeout(25000);
      p.on('dialog',async d=>{try{await d.accept();}catch{}});
      await openPostHtml(p);
      await setPostHtml(p,originalHtml);
      console.error('ROLLBACK_POST_R5_OK');
    }catch(e){console.error('ROLLBACK_POST_R5_FAIL '+(e?.stack||e));}
  }
  throw err;
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
