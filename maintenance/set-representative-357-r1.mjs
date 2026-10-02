import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';

const BLOG='https://nhunnhun.tistory.com';
const POST_ID='357';
const REP='https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6c/Ripe-bananas.jpg/960px-Ripe-bananas.jpg';
for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) if(!process.env[k]) throw new Error('E_CONFIG_'+k);

async function download(url,path){
  const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'},signal:AbortSignal.timeout(20000)});
  if(!r.ok) throw new Error('E_DOWNLOAD_'+r.status);
  const type=(r.headers.get('content-type')||'').toLowerCase();
  if(!type.startsWith('image/')) throw new Error('E_TYPE_'+type);
  await writeFile(path,Buffer.from(await r.arrayBuffer()));
}

const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({
  projectId:process.env.BROWSERBASE_PROJECT_ID,
  browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},
  timeout:180
});
let browser;
try{
  const path='/tmp/banana-representative.jpg';
  await download(REP,path);
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0];
  const page=await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('dialog',async d=>{try{await d.accept();}catch{}});
  await page.goto(BLOG+'/manage/post/'+POST_ID,{waitUntil:'domcontentloaded'});
  await page.locator('#publish-layer-btn').click();
  const thumb=page.locator('.publish_editor .box_thumb');
  await thumb.waitFor({state:'visible'});
  const input=thumb.locator('input[type="file"]');
  if(await input.count()!==1) throw new Error('E_THUMB_INPUT');
  await input.setInputFiles(path);
  await page.waitForTimeout(1800);

  let submit=null;
  for(const name of ['변경사항 저장','수정','완료','공개 발행']){
    const b=page.getByRole('button',{name,exact:true});
    if(await b.count()){submit=b.last();break;}
  }
  if(!submit) throw new Error('E_SUBMIT');
  await submit.click();
  await page.waitForTimeout(4000);

  const pub=await context.newPage();
  await pub.goto(BLOG+'/'+POST_ID+'?ogverify=1',{waitUntil:'domcontentloaded'});
  const og=await pub.locator('meta[property="og:image"]').getAttribute('content').catch(()=>null);
  if(!og||og.includes('opengraph.png')) throw new Error('E_OG_NOT_SET_'+og);
  console.log('PASS_BANANA_REPRESENTATIVE '+og);
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
