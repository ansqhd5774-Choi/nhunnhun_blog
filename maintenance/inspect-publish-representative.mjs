import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
const BLOG='https://nhunnhun.tistory.com', POST_ID='356';
for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) if(!process.env[k]) throw new Error('E_CONFIG_'+k);
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
  await page.locator('#publish-layer-btn').click();
  await page.waitForTimeout(500);
  const files=await page.locator('input[type=file]').evaluateAll(els=>els.map((e,i)=>({i,id:e.id,cls:e.className,accept:e.accept,multiple:e.multiple})));
  const texts=await page.locator('button, label, span, div').evaluateAll(els=>els.map((e,i)=>({i,tag:e.tagName,id:e.id,cls:String(e.className||'').slice(0,100),text:(e.innerText||'').trim().replace(/\s+/g,' ').slice(0,100)})).filter(x=>/대표|썸네일|이미지|사진/.test(x.text)).slice(0,60));
  console.log('PUBLISH_REP '+JSON.stringify({files,texts}));
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}