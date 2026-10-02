import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const BLOG='https://nhunnhun.tistory.com';
for (const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) {
  if (!process.env[k]) throw new Error('E_CONFIG');
}
const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({
  projectId:process.env.BROWSERBASE_PROJECT_ID,
  browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},
  timeout:300
});
let browser;
try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0];
  const page=await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('dialog',async d=>{ if(d.type()==='confirm') await d.accept(); else await d.dismiss(); });
  await page.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');

  // Find the CodeMirror instance that contains the skin CSS.
  await page.waitForFunction(() => document.querySelectorAll('.CodeMirror').length > 0);
  const found = await page.evaluate(() => {
    const editors=[...document.querySelectorAll('.CodeMirror')].map((el,i)=>({i,cm:el.CodeMirror,value:el.CodeMirror?.getValue?.()||''}));
    const css=editors.find(x=>x.value.includes('@charset') && x.value.includes('.post-content'));
    return css ? {index:css.i,length:css.value.length} : null;
  });
  if(!found) throw new Error('E_CSS_EDITOR_NOT_FOUND');

  const marker='/* ZG responsive article images */';
  await page.evaluate(({index,marker})=>{
    const el=document.querySelectorAll('.CodeMirror')[index];
    const cm=el.CodeMirror;
    let css=cm.getValue();
    if(!css.includes(marker)){
      css += '\n\n'+marker+'\n.post-content img, .contents_style img {\n  max-width: 100% !important;\n  height: auto !important;\n}\n.post-content p > img, .contents_style p > img {\n  display: block;\n  margin-left: auto;\n  margin-right: auto;\n}\n';
      cm.setValue(css);
      cm.save?.();
    }
  },{index:found.index,marker});

  // Save/apply. Try exact common labels first, then any visible save-like button.
  const labels=['적용','저장','변경사항 저장'];
  let clicked=false;
  for(const label of labels){
    const b=page.getByRole('button',{name:label,exact:true});
    if(await b.count()){ await b.last().click(); clicked=true; break; }
  }
  if(!clicked){
    const b=page.locator('button').filter({hasText:/적용|저장/});
    if(await b.count()){ await b.last().click(); clicked=true; }
  }
  if(!clicked) throw new Error('E_SAVE_BUTTON');
  await page.waitForTimeout(2500);

  // Verify live post image computed width never exceeds article content width.
  const pub=await context.newPage();
  await pub.goto(BLOG+'/356',{waitUntil:'domcontentloaded'});
  const result=await pub.evaluate(()=>{
    const content=document.querySelector('.contents_style');
    const imgs=[...content.querySelectorAll('img')];
    return {
      contentWidth:content?.getBoundingClientRect().width||0,
      images:imgs.map(img=>({alt:img.alt,width:img.getBoundingClientRect().width,naturalWidth:img.naturalWidth,maxWidth:getComputedStyle(img).maxWidth,height:getComputedStyle(img).height}))
    };
  });
  const bad=result.images.filter(x=>x.width>result.contentWidth+1);
  if(!result.images.length || bad.length) throw new Error('E_SIZE_VERIFY');
  console.log('PASS_RESPONSIVE_IMAGES '+JSON.stringify(result));
} finally {
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
