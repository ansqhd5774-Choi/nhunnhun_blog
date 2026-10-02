import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';

const BLOG='https://nhunnhun.tistory.com', POST_ID='356';
const IMAGE_URL='https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/Red_apple_fruits.jpg/960px-Red_apple_fruits.jpg';
for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) if(!process.env[k]) throw new Error('E_CONFIG_'+k);

const bytes=Buffer.from(await (await fetch(IMAGE_URL)).arrayBuffer());
await writeFile('/tmp/apple.jpg',bytes);

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
  await page.waitForTimeout(3000);

  const data=await page.evaluate(()=>({
    editors:[...document.querySelectorAll('iframe')].map((f,i)=>({
      i,id:f.id,cls:String(f.className||'').slice(0,120),title:f.title,src:f.src
    })),
    representative:[...document.querySelectorAll('button,[role="button"],label,input')].map((e,i)=>({
      i,tag:e.tagName,id:e.id,cls:String(e.className||'').slice(0,120),
      text:(e.innerText||e.textContent||'').trim().replace(/\s+/g,' ').slice(0,120),
      title:e.getAttribute('title'),aria:e.getAttribute('aria-label'),type:e.getAttribute('type')
    })).filter(x=>/대표|썸네일|thumbnail|representative/i.test([x.text,x.title,x.aria,x.id,x.cls].join(' '))),
    images:[...document.querySelectorAll('img')].map((e,i)=>({
      i,src:e.src,alt:e.alt,cls:String(e.className||'').slice(0,120),
      width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height
    })).filter(x=>/apple|blob|kakao|daumcdn/i.test(x.src)).slice(-20)
  }));
  console.log('AFTER_IMAGE_UPLOAD '+JSON.stringify(data));
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
