import fs from 'node:fs';
import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com';
const POST_ID='357';
const post=JSON.parse(fs.readFileSync('posts/banana-ripeness-blood-sugar-20261003.json','utf8'));

for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) {
  if(!process.env[k]) throw new Error('E_CONFIG_'+k);
}

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
  const title=(await page.locator('#post-title-inp').inputValue()).trim();
  if(title!==post.title) throw new Error('E_TITLE_MISMATCH_'+title);
  await page.locator('#editor-mode-layer-btn-open').click();
  await page.locator('#editor-mode-html').click();
  const cm=page.locator('.CodeMirror:visible');
  await cm.waitFor({state:'visible'});
  return cm.evaluate(el=>el?.CodeMirror?.getValue?.()||'');
}

function imageMapFromHtml(html){
  const map=new Map();
  for(const m of html.matchAll(/<img\b[^>]*\balt=(["'])(.*?)\1[^>]*\bsrc=(["'])(.*?)\3[^>]*>|<img\b[^>]*\bsrc=(["'])(.*?)\5[^>]*\balt=(["'])(.*?)\7[^>]*>/gi)){
    if(m[2]&&m[4]) map.set(m[2],m[4]);
    else if(m[6]&&m[8]) map.set(m[8],m[6]);
  }
  return map;
}

function preserveNativeImages(targetHtml,currentHtml){
  const map=imageMapFromHtml(currentHtml);
  return targetHtml.replace(/<img\b[^>]*>/gi, tag=>{
    const alt=tag.match(/\balt=(["'])(.*?)\1/i)?.[2];
    const current=alt?map.get(alt):null;
    if(!current||!current.includes('kakaocdn.net')) return tag;
    return tag.replace(/\bsrc=(["'])(.*?)\1/i, 'src="'+current+'"');
  });
}

async function save(page,html){
  const code=page.locator('.CodeMirror:visible .CodeMirror-code');
  await code.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(html);
  await page.waitForTimeout(700);
  await page.locator('#publish-layer-btn').click();

  let submit=null;
  for(const name of ['수정','변경사항 저장','완료','공개 발행']){
    const b=page.getByRole('button',{name,exact:true});
    if(await b.count()){submit=b.last();break;}
  }
  if(!submit) throw new Error('E_SUBMIT');
  await submit.click();
  await page.waitForTimeout(4500);
}

async function verify(context,w,h){
  const p=await context.newPage();
  try{
    await p.setViewportSize({width:w,height:h});
    await p.goto(BLOG+'/'+POST_ID+'?designverify='+w,{waitUntil:'domcontentloaded'});
    await p.locator('.contents_style').waitFor({state:'visible'});
    return await p.evaluate(()=>{
      const c=document.querySelector('.contents_style');
      const html=c?.innerHTML||'';
      const text=(c?.innerText||'').replace(/\s+/g,' ');
      const imgs=[...c.querySelectorAll('img')];
      return {
        quick:text.includes('바나나, 이것만 먼저 보세요'),
        accent:(html.match(/width:\s*34px;\s*height:\s*4px/g)||[]).length,
        h2:c.querySelectorAll('h2').length,
        h3:c.querySelectorAll('h3').length,
        latest:text.includes('최신 근거 · 2026'),
        faq:text.includes('바나나는 하루에 몇 개가 적당한가요?')&&text.includes('정해진 의학적 권장 개수는 없습니다.'),
        summary:text.includes('핵심 정리')&&text.includes('기존 간식을 바나나로 대체'),
        related:text.includes('바나나 효능 전반 정리')&&text.includes('사과 효능·영양성분·부작용 총정리'),
        tables:c.querySelectorAll('table').length,
        nativeImages:imgs.filter(x=>x.src.includes('kakaocdn.net')).length,
        sourceRows:text.includes('Harvard T.H. Chan · Bananas')&&text.includes('ADA · 과일과 당뇨병')
      };
    });
  }finally{await p.close();}
}

try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0];
  const page=await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('dialog',async d=>{try{await d.accept();}catch{}});

  originalHtml=await openHtml(page);
  const target=preserveNativeImages(post.bodyHtml,originalHtml);
  if(target!==originalHtml){
    await save(page,target);
    changed=true;
  }

  const desktop=await verify(context,1440,1000);
  const mobile=await verify(context,390,844);
  for(const v of [desktop,mobile]){
    if(!v.quick||v.accent<8||v.h2<9||v.h3<3||!v.latest||!v.faq||!v.summary||!v.related||v.tables<2||v.nativeImages<2||!v.sourceRows){
      throw new Error('E_VERIFY_'+JSON.stringify(v));
    }
  }
  console.log('PASS_BANANA_EDITORIAL_R1 '+JSON.stringify({changed,desktop,mobile}));
}catch(err){
  console.error('BANANA_EDITORIAL_R1_FAIL '+(err?.stack||err));
  if(changed&&browser&&originalHtml){
    try{
      const context=browser.contexts()[0];
      const p=await context.newPage();
      p.setDefaultTimeout(30000);
      p.on('dialog',async d=>{try{await d.accept();}catch{}});
      await openHtml(p);
      await save(p,originalHtml);
      console.error('ROLLBACK_BANANA_EDITORIAL_R1_OK');
    }catch(e){
      console.error('ROLLBACK_BANANA_EDITORIAL_R1_FAIL '+(e?.stack||e));
    }
  }
  throw err;
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
