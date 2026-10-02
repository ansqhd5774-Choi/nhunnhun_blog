import fs from 'node:fs';
import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com';
const POST_ID='356';
const post=JSON.parse(fs.readFileSync('posts/apple-benefits-20261002.json','utf8'));
for (const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) {
  if(!process.env[k]) throw new Error('E_CONFIG_'+k);
}
const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({
  projectId:process.env.BROWSERBASE_PROJECT_ID,
  browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},
  timeout:300
});
let browser;
async function publish(page, html){
  await page.goto(BLOG+'/manage/post/'+POST_ID,{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
  await page.locator('#editor-mode-layer-btn-open').click();
  await page.locator('#editor-mode-html').click();
  await page.locator('.CodeMirror:visible').waitFor({state:'visible'});
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
try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0];
  const page=await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('dialog',async d=>{try{await d.accept();}catch{}});
  await publish(page,post.bodyHtml);

  const pub=await context.newPage();
  await pub.goto(BLOG+'/'+POST_ID+'?finalize=1',{waitUntil:'domcontentloaded'});
  await pub.locator('.contents_style').waitFor({state:'visible'});
  const result=await pub.evaluate(()=>{
    const c=document.querySelector('.contents_style');
    const text=(c?.innerText||'').replace(/\s+/g,' ').trim();
    const h2=[...c.querySelectorAll('h2')];
    const h3=[...c.querySelectorAll('h3')];
    const latest=[...c.querySelectorAll('aside')].find(x=>x.textContent.includes('최신 근거 · 2026'));
    const related=[...c.querySelectorAll('a')].find(x=>x.textContent.includes('사과 품종·고르는 법·보관법·활용법 총정리'));
    return {
      hasLatest:!!latest,
      hasRelated:!!related,
      hasSummary:text.includes('핵심 정리')&&text.includes('기존 간식을 사과로 대체'),
      h2Count:h2.length,
      h3Count:h3.length,
      h3All20:h3.length>=3&&h3.every(x=>(x.getAttribute('style')||'').includes('font-size:20px')),
      originalH2:text.includes('1. 사과를 먹을 때 기대할 수 있는 점'),
      hasFAQ:text.includes('Q. 사과가 변비에 좋은가요?')&&text.includes('A. 식이섬유 섭취 측면에서는 도움이 될 수 있습니다.')
    };
  });
  if(!result.hasLatest||!result.hasRelated||!result.hasSummary||!result.h3All20||!result.originalH2||!result.hasFAQ||result.h2Count<10) {
    throw new Error('E_FINAL_VERIFY_'+JSON.stringify(result));
  }
  fs.mkdirSync('evidence',{recursive:true});
  fs.writeFileSync('evidence/post-356-finalize-r2.json',JSON.stringify({
    status:'PASS',
    postId:POST_ID,
    verifiedAt:new Date().toISOString(),
    result
  },null,2)+'\n');
  console.log('PASS_FINALIZE_356 '+JSON.stringify(result));
} finally {
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
