import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com', POST_ID='356';
for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) if(!process.env[k]) throw new Error('E_CONFIG_'+k);

const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({
  projectId:process.env.BROWSERBASE_PROJECT_ID,
  browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},
  timeout:300
});
let browser;
try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0], page=await context.newPage();
  page.setDefaultTimeout(30000); page.on('dialog',async d=>{try{await d.accept();}catch{}});
  await page.goto(BLOG+'/manage/post/'+POST_ID,{waitUntil:'domcontentloaded'});
  await page.locator('#editor-mode-layer-btn-open').click(); await page.locator('#editor-mode-html').click();
  const cm=page.locator('.CodeMirror:visible'); await cm.waitFor({state:'visible'});
  let html=await cm.evaluate(el=>el?.CodeMirror?.getValue?.()||'');
  const old='1. 사과를 먹을 때 기대할 수 있는 점';
  const neu='1. 사과 효능, 실제로 어떤 점이 좋을까?';
  if(!html.includes(old)) throw new Error('E_TARGET_NOT_FOUND');
  html=html.replace(old,neu);
  const code=page.locator('.CodeMirror:visible .CodeMirror-code');
  await code.click(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(html);
  await page.waitForTimeout(500); await page.locator('#publish-layer-btn').click();
  let submit=null;
  for(const name of ['수정','변경사항 저장','완료','공개 발행']){
    const b=page.getByRole('button',{name,exact:true}); if(await b.count()){submit=b.last();break;}
  }
  if(!submit) throw new Error('E_SUBMIT');
  await submit.click(); await page.waitForTimeout(3500);
  const pub=await context.newPage(); await pub.goto(BLOG+'/'+POST_ID,{waitUntil:'domcontentloaded'});
  const t=await pub.locator('.contents_style').innerText();
  if(!t.includes(neu)) throw new Error('E_VERIFY');
  console.log('PASS_H2_COPY');
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
