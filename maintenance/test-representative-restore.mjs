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
async function clickVisible(page, selector){
  const ok=await page.evaluate(sel=>{
    const els=[...document.querySelectorAll(sel)];
    const e=els.find(x=>{
      const r=x.getBoundingClientRect(),s=getComputedStyle(x);
      return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
    })||els[0];
    if(!e) return false;
    e.click();
    return true;
  },selector);
  if(!ok) throw new Error('E_VISIBLE_CLICK_'+selector);
}

try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0], page=await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('dialog',async d=>{ if(d.type()==='confirm') await d.accept(); else await d.dismiss(); });
  await page.goto(BLOG+'/manage/post/'+POST_ID,{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
  await page.locator('#post-title-inp').waitFor({state:'visible'});

  // Capture current body in HTML mode.
  await clickVisible(page,'#editor-mode-layer-btn-open');
  await page.waitForTimeout(150);
  await clickVisible(page,'#editor-mode-html');
  const cm=page.locator('.CodeMirror:visible');
  await cm.waitFor({state:'visible'});
  const original=await cm.evaluate(el=>el?.CodeMirror?.getValue?.()||'');
  if(original.length<500) throw new Error('E_ORIGINAL_TOO_SHORT');

  // Return to basic mode.
  await clickVisible(page,'#editor-mode-layer-btn-open');
  await page.waitForTimeout(150);
  const switched=await page.evaluate(()=>{const els=[...document.querySelectorAll('*')].filter(e=>(e.textContent||'').trim()==='기본모드');const e=els.find(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';});if(e){e.click();return true;}return false;});
  if(!switched) throw new Error('E_BASIC_MODE');
  await page.waitForTimeout(600);

  // Upload; this creates a Tistory/Kakao attachment and provisional representative thumbnail.
  await page.evaluate(()=>document.querySelectorAll('#attach-layer-btn')[0]?.click());
  await page.locator('#attach-image').setInputFiles(file);
  await page.waitForTimeout(6000);

  await page.locator('#publish-layer-btn').click();
  await page.waitForTimeout(500);
  const thumbBefore=await page.locator('.publish_editor .box_thumb').count();
  const thumbImgBefore=await page.locator('.publish_editor .box_thumb img').getAttribute('src').catch(()=>null);
  // Close publish layer without saving.
  const close=page.locator('.layer_publish .btn_close, .publish_layer .btn_close, .layer_body .btn_close').first();
  if(await close.count()) await close.click(); else await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Restore exact body; representative attachment should survive independently.
  await clickVisible(page,'#editor-mode-layer-btn-open');
  await page.waitForTimeout(150);
  await clickVisible(page,'#editor-mode-html');
  const code=page.locator('.CodeMirror:visible .CodeMirror-code');
  await code.waitFor({state:'visible'}); await code.click();
  await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(original);
  await page.waitForTimeout(400);

  await page.locator('#publish-layer-btn').click();
  await page.waitForTimeout(500);
  const thumbAfter=await page.locator('.publish_editor .box_thumb').count();
  const thumbImgAfter=await page.locator('.publish_editor .box_thumb img').getAttribute('src').catch(()=>null);
  console.log('REP_RESTORE_TEST '+JSON.stringify({originalLength:original.length,thumbBefore,thumbImgBefore,thumbAfter,thumbImgAfter}));
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
