import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';

const BLOG='https://nhunnhun.tistory.com';
const POST_ID='356';
const post=JSON.parse(await readFile('posts/apple-benefits-20261002.json','utf8'));
const hero='https://upload.wikimedia.org/wikipedia/commons/0/06/Red_apple_fruits.jpg';
const sliced='https://upload.wikimedia.org/wikipedia/commons/9/92/Sliced_apple.jpg';
const imgStyle='width:100%;max-width:720px;height:auto;display:block;margin:16px auto;';

let html=post.bodyHtml;
const heroBlock='<p><img src="'+hero+'" alt="붉은 사과 두 개" style="'+imgStyle+'"></p>';
const slicedBlock='<p><img src="'+sliced+'" alt="반으로 자른 사과" style="'+imgStyle+'"></p>';
html=heroBlock+html;
html=html.replace('<h2>3. 사과는 하루에 얼마나 먹으면 좋을까?</h2>',slicedBlock+'<h2>3. 사과는 하루에 얼마나 먹으면 좋을까?</h2>');

for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) if(!process.env[k]) throw new Error('E_CONFIG');
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

  await page.goto(BLOG+'/manage/post/'+POST_ID,{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
  await page.locator('#post-title-inp').waitFor({state:'visible'});
  if((await page.locator('#post-title-inp').inputValue()).trim()!==post.title) throw new Error('E_WRONG_POST');

  await page.locator('#editor-mode-layer-btn-open').click();
  await page.locator('#editor-mode-html').click();
  const code=page.locator('.CodeMirror:visible .CodeMirror-code');
  await code.waitFor({state:'visible'});
  await code.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(html);

  await page.locator('#publish-layer-btn').click();
  let submit=null;
  for(const name of ['공개 발행','수정','변경사항 저장','완료']){
    const b=page.getByRole('button',{name,exact:true});
    if(await b.count()){submit=b.last();break;}
  }
  if(!submit) throw new Error('E_SUBMIT_BUTTON');
  await submit.click();
  await page.waitForTimeout(2500);

  async function verify(viewport){
    const p=await context.newPage();
    await p.setViewportSize(viewport);
    await p.goto(BLOG+'/'+POST_ID,{waitUntil:'domcontentloaded'});
    const result=await p.evaluate(()=>{
      const content=document.querySelector('.contents_style');
      const imgs=[...content.querySelectorAll('img')].filter(img=>/사과/.test(img.alt));
      return {
        contentWidth:content?.getBoundingClientRect().width||0,
        images:imgs.map(img=>({
          alt:img.alt,
          width:Math.round(img.getBoundingClientRect().width),
          height:Math.round(img.getBoundingClientRect().height),
          naturalWidth:img.naturalWidth,
          naturalHeight:img.naturalHeight,
          style:img.getAttribute('style')||''
        }))
      };
    });
    await p.close();
    if(result.images.length!==2) throw new Error('E_IMAGE_COUNT');
    for(const img of result.images){
      if(img.width>720.5 || img.width>result.contentWidth+1 || img.height<=0) throw new Error('E_SIZE_VERIFY');
    }
    return result;
  }

  const desktop=await verify({width:1440,height:1200});
  const mobile=await verify({width:390,height:900});
  console.log('PASS_IMAGE_SIZE '+JSON.stringify({desktop,mobile}));
} finally {
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
