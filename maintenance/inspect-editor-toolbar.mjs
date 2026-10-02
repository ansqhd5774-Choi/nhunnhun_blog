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
  const captures=[];
  page.on('request',req=>{
    if(req.method()==='GET') return;
    const url=req.url();
    if(!/manage|post|entry|editor|publish/i.test(url)) return;
    const raw=req.postData()||'';
    let parsed=null;
    try{ parsed=JSON.parse(raw); }catch{}
    captures.push({
      method:req.method(),url,
      contentType:req.headers()['content-type']||'',
      keys:parsed&&typeof parsed==='object'?Object.keys(parsed):[],
      data:parsed&&typeof parsed==='object'?Object.fromEntries(Object.entries(parsed).map(([k,v])=>[k,typeof v==='string'?(v.length>300?v.slice(0,300)+'…':v):v])):raw.slice(0,1200)
    });
  });

  await page.goto(BLOG+'/manage/post/'+POST_ID,{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
  await page.locator('#post-title-inp').waitFor({state:'visible'});
  await page.locator('#publish-layer-btn').click();
  await page.waitForTimeout(500);
  const submit=page.getByRole('button',{name:'공개 발행',exact:true});
  if(!await submit.count()) throw new Error('E_PUBLISH_BUTTON');
  await submit.click();
  await page.waitForTimeout(2500);
  console.log('SAVE_REQUESTS '+JSON.stringify(captures));
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
