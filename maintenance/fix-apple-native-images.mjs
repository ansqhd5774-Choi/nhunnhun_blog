import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
import { readFile, writeFile } from 'node:fs/promises';

const BLOG='https://nhunnhun.tistory.com', POST_ID='356';
const post=JSON.parse(await readFile('posts/apple-benefits-20261002.json','utf8'));
const HERO_SRC='https://upload.wikimedia.org/wikipedia/commons/0/06/Red_apple_fruits.jpg';
const SLICED_SRC='https://upload.wikimedia.org/wikipedia/commons/9/92/Sliced_apple.jpg';

for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) if(!process.env[k]) throw new Error('E_CONFIG_'+k);

async function download(url,path){
  let last='';
  for(let i=0;i<4;i++){
    const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'}});
    if(r.ok){await writeFile(path,Buffer.from(await r.arrayBuffer()));return;}
    last='HTTP '+r.status;
    await new Promise(res=>setTimeout(res,700));
  }
  throw new Error('E_DOWNLOAD_'+last);
}
await download(HERO_SRC,'/tmp/apple-hero.jpg');
await download(SLICED_SRC,'/tmp/apple-sliced.jpg');

const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({
  projectId:process.env.BROWSERBASE_PROJECT_ID,
  browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},
  timeout:300
});
let browser;

async function clickVisible(page,selector){
  const ok=await page.evaluate(sel=>{
    const es=[...document.querySelectorAll(sel)];
    const e=es.find(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';})||es[0];
    if(!e)return false;e.click();return true;
  },selector);
  if(!ok) throw new Error('E_CLICK_'+selector);
}
async function switchHtml(page){
  await clickVisible(page,'#editor-mode-layer-btn-open');
  await page.waitForTimeout(150);
  await clickVisible(page,'#editor-mode-html');
  await page.locator('.CodeMirror:visible').waitFor({state:'visible'});
}
async function uploadOne(page,path){
  const frame=page.frames().find(f=>f!==page.mainFrame());
  const before=frame?await frame.locator('img').evaluateAll(es=>es.map(x=>x.src)):[];
  await page.evaluate(()=>document.querySelectorAll('#attach-layer-btn')[0]?.click());
  await page.locator('#attach-image').setInputFiles(path);
  await page.waitForTimeout(5500);
  const f=page.frames().find(x=>x!==page.mainFrame());
  if(!f) throw new Error('E_FRAME');
  const after=await f.locator('img').evaluateAll(es=>es.map(x=>x.src).filter(Boolean));
  const added=after.filter(x=>!before.includes(x));
  const src=added.at(-1)||after.at(-1);
  if(!src||!src.includes('kakaocdn.net')) throw new Error('E_UPLOAD_SRC_'+JSON.stringify({before,after}));
  return src;
}
function makeNativeBody(hero,sliced){
  let h=post.bodyHtml;
  // Remove any external image paragraphs from the approved source before inserting Tistory-native attachments.
  h=h.replace(/<p><img[^>]*alt="붉은 사과 두 개"[^>]*><\/p>/i,'');
  h=h.replace(/<p><img[^>]*alt="반으로 자른 사과"[^>]*><\/p>/i,'');
  const heroTag='<p><img src="'+hero+'" alt="붉은 사과 두 개" width="720" height="454" loading="eager" fetchpriority="high" decoding="async" style="width:100%;max-width:720px;height:auto;display:block;margin:16px auto;"></p>';
  const slicedTag='<p><img src="'+sliced+'" alt="반으로 자른 사과" width="720" height="480" loading="lazy" decoding="async" style="width:100%;max-width:720px;height:auto;display:block;margin:16px auto;"></p>';
  h=heroTag+h;
  h=h.replace('<h2>3. 사과는 하루에 얼마나 먹으면 좋을까?</h2>',slicedTag+'<h2>3. 사과는 하루에 얼마나 먹으면 좋을까?</h2>');
  return h;
}

try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0],page=await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('dialog',async d=>{if(d.type()==='confirm')await d.accept();else await d.dismiss();});

  await page.goto(BLOG+'/manage/post/'+POST_ID,{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
  await page.locator('#post-title-inp').waitFor({state:'visible'});
  if((await page.locator('#post-title-inp').inputValue()).trim()!==post.title) throw new Error('E_WRONG_POST');

  // Upload both through Tistory so they are first-party attachments.
  const heroUrl=await uploadOne(page,'/tmp/apple-hero.jpg');
  const slicedUrl=await uploadOne(page,'/tmp/apple-sliced.jpg');

  // Compose approved article with the two Tistory-native image URLs at the exact desired positions.
  await switchHtml(page);
  const body=makeNativeBody(heroUrl,slicedUrl);
  const code=page.locator('.CodeMirror:visible .CodeMirror-code');
  await code.waitFor({state:'visible'}); await code.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(body);
  await page.waitForTimeout(400);

  await page.locator('#publish-layer-btn').click();
  await page.waitForTimeout(450);
  if(await page.locator('.publish_editor .box_thumb').count()!==1) throw new Error('E_REP_MISSING');

  let submit=null;
  for(const name of ['수정','변경사항 저장','완료','공개 발행']){
    const b=page.getByRole('button',{name,exact:true});
    if(await b.count()){submit=b.last();break;}
  }
  if(!submit) throw new Error('E_SUBMIT');
  const submitText=(await submit.innerText()).trim();
  await submit.click();
  await page.waitForTimeout(3500);

  const pub=await context.newPage();
  await pub.goto(BLOG+'/'+POST_ID,{waitUntil:'domcontentloaded'});
  await pub.locator('.contents_style').waitFor({state:'visible'});
  const result=await pub.evaluate(()=>{
    const c=document.querySelector('.contents_style');
    const imgs=[...c.querySelectorAll('img')].map(x=>({alt:x.alt,src:x.src,width:x.getAttribute('width'),height:x.getAttribute('height')}));
    return {
      imgs,
      og:document.querySelector('meta[property="og:image"]')?.content||'',
      desc:document.querySelector('meta[name="description"]')?.content||'',
      text:(c.innerText||'').replace(/\s+/g,' ').trim().slice(0,220)
    };
  });
  const hero=result.imgs.find(x=>x.alt==='붉은 사과 두 개');
  const sliced=result.imgs.find(x=>x.alt==='반으로 자른 사과');
  if(!hero||!sliced) throw new Error('E_IMAGES_MISSING_'+JSON.stringify(result.imgs));
  if(!hero.src.includes('kakaocdn.net')||!sliced.src.includes('kakaocdn.net')) throw new Error('E_NOT_TISTORY_CDN');
  if(!result.og||result.og.includes('opengraph.png')) throw new Error('E_OG_DEFAULT');
  if(!result.desc.startsWith('사과 효능은')) throw new Error('E_DESC');
  if(!result.text.startsWith('사과 효능은')) throw new Error('E_TEXT');

  console.log('PASS_TISTORY_NATIVE_IMAGES '+JSON.stringify({submitText,heroUrl,slicedUrl,og:result.og,descPrefix:result.desc.slice(0,100)}));
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
