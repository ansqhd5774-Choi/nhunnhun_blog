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

  await page.locator('#publish-layer-btn').click();
  await page.waitForTimeout(700);

  const files=await page.locator('input[type=file]').evaluateAll(els=>els.map((e,i)=>({i,id:e.id,cls:e.className,accept:e.accept,multiple:e.multiple})));
  const items=await page.locator('button,a,label,span,div,img').evaluateAll(els=>els.map((e,i)=>{
    const cs=getComputedStyle(e),r=e.getBoundingClientRect();
    return {i,tag:e.tagName,id:e.id,cls:String(e.className||'').slice(0,180),text:(e.innerText||e.textContent||'').trim().replace(/\s+/g,' ').slice(0,140),title:e.getAttribute('title'),aria:e.getAttribute('aria-label'),src:e.getAttribute('src'),visible:cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0};
  }).filter(x=>x.visible&&(/대표|썸네일|cover|thumbnail|image|photo|사진|삭제/.test([x.id,x.cls,x.text,x.title,x.aria].join(' ')))).slice(0,150));
  console.log('PUBLISH_AFTER_UPLOAD '+JSON.stringify({files,items}));
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
