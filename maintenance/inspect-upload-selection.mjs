import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';

const BLOG='https://nhunnhun.tistory.com', POST_ID='356';
const HERO='https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/Red_apple_fruits.jpg/960px-Red_apple_fruits.jpg';
for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) if(!process.env[k]) throw new Error('E_CONFIG_'+k);

const resp=await fetch(HERO); if(!resp.ok) throw new Error('E_IMAGE_FETCH');
const file='/tmp/apple-hero.jpg'; await writeFile(file,Buffer.from(await resp.arrayBuffer()));

const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({projectId:process.env.BROWSERBASE_PROJECT_ID,browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},timeout:300});
let browser;
try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0], page=await context.newPage();
  page.setDefaultTimeout(30000);
  await page.goto(BLOG+'/manage/post/'+POST_ID,{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
  await page.locator('#post-title-inp').waitFor({state:'visible'});

  await page.evaluate(()=>document.querySelectorAll('#attach-layer-btn')[0]?.click());
  await page.locator('#attach-image').setInputFiles(file);
  await page.waitForTimeout(6000);

  const frame=page.frames().find(f=>f!==page.mainFrame() && f.url()==='about:blank') || page.frames().find(f=>f!==page.mainFrame());
  if(!frame) throw new Error('E_EDITOR_FRAME');
  const imgs=await frame.locator('img').evaluateAll(els=>els.map((e,i)=>({i,src:e.src,alt:e.alt,cls:e.className,dataFilename:e.getAttribute('data-filename'),dataOriginWidth:e.getAttribute('data-origin-width'),dataOriginHeight:e.getAttribute('data-origin-height')})));
  console.log('FRAME_IMAGES '+JSON.stringify(imgs));
  if(imgs.length){
    await frame.locator('img').last().click();
    await page.waitForTimeout(500);
  }
  const reps=await page.locator('button,span,div,label,a').evaluateAll(els=>els.map((e,i)=>({
    i,tag:e.tagName,id:e.id,cls:String(e.className||'').slice(0,160),
    text:(e.innerText||e.textContent||'').trim().replace(/\s+/g,' ').slice(0,140),
    title:e.getAttribute('title'),aria:e.getAttribute('aria-label')
  })).filter(x=>/대표|썸네일|원본|삭제|정렬|크기/.test([x.text,x.title,x.aria].join(' '))).slice(0,120));
  console.log('IMAGE_SELECTED_UI '+JSON.stringify(reps));
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
