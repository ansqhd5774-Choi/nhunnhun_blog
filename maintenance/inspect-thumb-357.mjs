import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com', POST_ID='357';
for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) if(!process.env[k]) throw new Error('E_CONFIG_'+k);
const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({
  projectId:process.env.BROWSERBASE_PROJECT_ID,
  browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},
  timeout:180
});
let browser;
try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const page=await browser.contexts()[0].newPage();
  page.setDefaultTimeout(30000);
  await page.goto(BLOG+'/manage/post/'+POST_ID,{waitUntil:'domcontentloaded'});
  await page.locator('#publish-layer-btn').click();
  await page.locator('.publish_editor').waitFor({state:'visible'});
  const info=await page.evaluate(()=>{
    const root=document.querySelector('.publish_editor');
    const thumbs=[...root.querySelectorAll('.box_thumb')].map((el,i)=>({
      i,
      cls:el.className,
      text:el.textContent.trim(),
      html:el.outerHTML.slice(0,2500)
    }));
    const controls=[...root.querySelectorAll('input,button,label')].map(el=>({
      tag:el.tagName,
      type:el.getAttribute('type'),
      id:el.id,
      cls:el.className,
      name:el.getAttribute('name'),
      text:el.textContent?.trim().slice(0,200),
      checked:'checked' in el?el.checked:undefined
    })).filter(x=>x.id||x.cls||x.name||x.text);
    return {thumbs,controls};
  });
  console.log('THUMB_DIAG '+JSON.stringify(info));
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
