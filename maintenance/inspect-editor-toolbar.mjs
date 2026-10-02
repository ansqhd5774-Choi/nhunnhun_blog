import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';

const BLOG='https://nhunnhun.tistory.com', POST_ID='356';
const IMAGE_URL='https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/Red_apple_fruits.jpg/960px-Red_apple_fruits.jpg';
for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) if(!process.env[k]) throw new Error('E_CONFIG_'+k);
await writeFile('/tmp/apple.jpg',Buffer.from(await (await fetch(IMAGE_URL)).arrayBuffer()));

const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({projectId:process.env.BROWSERBASE_PROJECT_ID,browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},timeout:300});
let browser;
try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0], page=await context.newPage();
  page.setDefaultTimeout(25000);
  await page.goto(BLOG+'/manage/post/'+POST_ID,{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
  await page.locator('#post-title-inp').waitFor({state:'visible'});

  await page.locator('#mceu_0-open').click();
  const chooserPromise=page.waitForEvent('filechooser',{timeout:5000});
  await page.locator('#attach-image').click();
  const chooser=await chooserPromise;
  await chooser.setFiles('/tmp/apple.jpg');

  const frame=page.frameLocator('#editor-tistory_ifr');
  await frame.locator('img').last().waitFor({state:'visible',timeout:15000});
  const count=await frame.locator('img').count();
  const last=frame.locator('img').nth(count-1);
  const imgInfo=await last.evaluate(e=>({
    src:e.getAttribute('src'),dataFilename:e.getAttribute('data-filename'),alt:e.getAttribute('alt'),
    outer:e.outerHTML.slice(0,1200),parent:e.parentElement?.outerHTML?.slice(0,2200)
  }));
  await last.click();
  await page.waitForTimeout(600);

  const controls=await page.evaluate(()=>[...document.querySelectorAll('button,[role="button"],label,input,span,a')].map((e,i)=>({
    i,tag:e.tagName,id:e.id,cls:String(e.className||'').slice(0,140),
    text:(e.innerText||e.textContent||'').trim().replace(/\s+/g,' ').slice(0,120),
    title:e.getAttribute('title'),aria:e.getAttribute('aria-label'),type:e.getAttribute('type')
  })).filter(x=>/대표|썸네일|thumbnail|cover/i.test([x.text,x.title,x.aria,x.id,x.cls].join(' '))).slice(0,80));

  console.log('UPLOADED_IMAGE '+JSON.stringify({imgInfo,controls}));
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
