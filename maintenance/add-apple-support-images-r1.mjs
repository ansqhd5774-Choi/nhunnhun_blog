import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com', POST_ID='356';
const IMAGES=[
  {
    alt:'먹기 좋게 자른 사과',
    marker:'2. 요즘 많이 묻는',
    src:'https://upload.wikimedia.org/wikipedia/commons/9/92/Sliced_apple.jpg',
    source:'https://commons.wikimedia.org/wiki/File:Sliced_apple.jpg',
    credit:'Wikimedia Commons · Public Domain'
  },
  {
    alt:'사과주스가 담긴 유리잔',
    marker:'3. 통사과 vs 사과주스',
    src:'https://upload.wikimedia.org/wikipedia/commons/0/00/Apple_juice_glass.jpg',
    source:'https://commons.wikimedia.org/wiki/File:Apple_juice_glass.jpg',
    credit:'Wikimedia Commons · CC BY 4.0 · JeanBono'
  },
  {
    alt:'흐르는 물에 사과를 씻는 모습',
    marker:'7. 사과는 어떻게 씻으면',
    src:'https://upload.wikimedia.org/wikipedia/commons/9/9d/Washing_apples_with_water_in_a_sink_%2815042552883%29.jpg',
    source:'https://commons.wikimedia.org/wiki/File:Washing_apples_with_water_in_a_sink_(15042552883).jpg',
    credit:'Wikimedia Commons · CC BY 2.0 · Personal Creations'
  }
];

for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) if(!process.env[k]) throw new Error('E_CONFIG_'+k);
const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({
  projectId:process.env.BROWSERBASE_PROJECT_ID,
  browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},
  timeout:300
});
let browser, originalHtml='', changed=false;

async function openHtml(page){
  await page.goto(BLOG+'/manage/post/'+POST_ID,{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
  await page.locator('#post-title-inp').waitFor({state:'visible'});
  if(!(await page.locator('#post-title-inp').inputValue()).includes('사과')) throw new Error('E_WRONG_POST');
  await page.locator('#editor-mode-layer-btn-open').click();
  await page.locator('#editor-mode-html').click();
  const cm=page.locator('.CodeMirror:visible');
  await cm.waitFor({state:'visible'});
  return cm.evaluate(el=>el?.CodeMirror?.getValue?.()||'');
}
function strip(s){return s.replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim();}
function insertAfterHeading(html,marker,fragment){
  const re=/<h2\b[^>]*>[\s\S]*?<\/h2>/gi;
  for(const m of html.matchAll(re)){
    if(strip(m[0]).includes(marker)){
      const i=m.index+m[0].length;
      return html.slice(0,i)+fragment+html.slice(i);
    }
  }
  throw new Error('E_HEADING_'+marker);
}
function figure(im){
  return '<figure class="apple-support-image" style="margin:22px auto 26px;max-width:720px;text-align:center;">'
    +'<img src="'+im.src+'" alt="'+im.alt+'" loading="lazy" decoding="async" style="width:100%;height:auto;display:block;border-radius:8px;">'
    +'<figcaption style="margin-top:7px;font-size:12px;line-height:1.5;color:#777;">사진: <a href="'+im.source+'" target="_blank" rel="noopener noreferrer">'+im.credit+'</a></figcaption>'
    +'</figure>';
}
async function save(page,html){
  const code=page.locator('.CodeMirror:visible .CodeMirror-code');
  await code.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(html);
  await page.waitForTimeout(500);
  await page.locator('#publish-layer-btn').click();
  let submit=null;
  for(const name of ['수정','변경사항 저장','완료','공개 발행']){
    const b=page.getByRole('button',{name,exact:true});
    if(await b.count()){submit=b.last();break;}
  }
  if(!submit) throw new Error('E_SUBMIT');
  await submit.click();
  await page.waitForTimeout(4000);
}
async function verify(context,w,h){
  const p=await context.newPage();
  try{
    await p.setViewportSize({width:w,height:h});
    await p.goto(BLOG+'/'+POST_ID,{waitUntil:'domcontentloaded'});
    await p.locator('.contents_style').waitFor({state:'visible'});
    return await p.evaluate(()=>{
      const c=document.querySelector('.contents_style');
      const imgs=[...c.querySelectorAll('img')].map(x=>({alt:x.alt,src:x.src}));
      return {
        supportCount:c.querySelectorAll('figure.apple-support-image').length,
        sliced:imgs.some(x=>x.alt==='먹기 좋게 자른 사과'&&x.src.includes('wikimedia.org')),
        juice:imgs.some(x=>x.alt==='사과주스가 담긴 유리잔'&&x.src.includes('wikimedia.org')),
        wash:imgs.some(x=>x.alt==='흐르는 물에 사과를 씻는 모습'&&x.src.includes('wikimedia.org')),
        hasQuick:(c.innerText||'').includes('사과, 이것만 먼저 보세요'),
        hasBlood:(c.innerText||'').includes('혈당 스파이크'),
        hasCompare:(c.innerText||'').includes('통사과 vs 사과주스'),
        hasWash:(c.innerText||'').includes('사과는 어떻게 씻으면 될까?')
      };
    });
  }finally{await p.close();}
}

try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0], page=await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('dialog',async d=>{try{await d.accept();}catch{}});
  originalHtml=await openHtml(page);
  let html=originalHtml.replace(/<figure class="apple-support-image"[\s\S]*?<\/figure>/gi,'');
  for(const im of IMAGES) html=insertAfterHeading(html,im.marker,figure(im));
  if(html===originalHtml) throw new Error('E_NO_CHANGE');
  await save(page,html);
  changed=true;

  const desktop=await verify(context,1440,1000);
  const mobile=await verify(context,390,844);
  for(const v of [desktop,mobile]){
    if(!v.sliced||!v.juice||!v.wash||v.supportCount!==3) throw new Error('E_VERIFY_IMAGES_'+JSON.stringify(v));
    if(!v.hasQuick||!v.hasBlood||!v.hasCompare||!v.hasWash) throw new Error('E_VERIFY_BODY_'+JSON.stringify(v));
  }
  console.log('PASS_APPLE_SUPPORT_IMAGES '+JSON.stringify({desktop,mobile}));
}catch(err){
  console.error('APPLE_SUPPORT_IMAGES_FAIL '+(err?.stack||err));
  if(changed&&browser&&originalHtml){
    try{
      const context=browser.contexts()[0], p=await context.newPage();
      p.setDefaultTimeout(30000);
      p.on('dialog',async d=>{try{await d.accept();}catch{}});
      await openHtml(p);
      await save(p,originalHtml);
      console.error('ROLLBACK_APPLE_SUPPORT_IMAGES_OK');
    }catch(e){console.error('ROLLBACK_APPLE_SUPPORT_IMAGES_FAIL '+(e?.stack||e));}
  }
  throw err;
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
