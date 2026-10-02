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
let browser, originalHtml='', changed=false;

async function openHtml(page){
  await page.goto(BLOG+'/manage/post/'+POST_ID,{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
  await page.locator('#post-title-inp').waitFor({state:'visible'});
  await page.locator('#editor-mode-layer-btn-open').click();
  await page.locator('#editor-mode-html').click();
  const cm=page.locator('.CodeMirror:visible');
  await cm.waitFor({state:'visible'});
  return cm.evaluate(el=>el?.CodeMirror?.getValue?.()||'');
}
async function save(page,html){
  const code=page.locator('.CodeMirror:visible .CodeMirror-code');
  await code.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(html);
  await page.waitForTimeout(500);
  await page.locator('#publish-layer-btn').click();
  let submit=null;
  for(const name of ['수정','변경사항 저장','완료','공개 발행']){
    const b=page.getByRole('button',{name,exact:true});
    if(await b.count()){submit=b.last();break;}
  }
  if(!submit) throw new Error('E_SUBMIT');
  await submit.click();
  await page.waitForTimeout(4000);
}
const mark=s=>'<span style="background:#fff3a3;padding:0 3px;">'+s+'</span>';
try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0], page=await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('dialog',async d=>{try{await d.accept();}catch{}});
  originalHtml=await openHtml(page);
  let html=originalHtml;

  const pairs=[
    ['130 kcal',mark('130 kcal')],
    ['식이섬유 5g','식이섬유 '+mark('5g')],
    ['주스보다 통사과',mark('주스보다 통사과')],
    ['중간 크기 사과 1개 안팎',mark('중간 크기 사과 1개 안팎')],
    ['기존 간식을 통사과로 바꾸는 것',mark('기존 간식을 통사과로 바꾸는 것')],
    ['‘총 섭취량’과 ‘내 몸의 반응’',mark('‘총 섭취량’과 ‘내 몸의 반응’')],
    ['적은 양부터',mark('적은 양부터')],
    ['호흡곤란·전신 부종',mark('호흡곤란·전신 부종')],
    ['흐르는 물에서 손으로 충분히 문질러 씻는 것',mark('흐르는 물에서 손으로 충분히 문질러 씻는 것')]
  ];
  let n=0;
  for(const [a,b] of pairs){
    if(html.includes(a) && !html.includes(b)){ html=html.replace(a,b); n++; }
  }
  if(n<6) throw new Error('E_HIGHLIGHT_COUNT_'+n);
  await save(page,html); changed=true;

  const pub=await context.newPage();
  await pub.goto(BLOG+'/'+POST_ID,{waitUntil:'domcontentloaded'});
  await pub.locator('.contents_style').waitFor({state:'visible'});
  const result=await pub.evaluate(()=>{
    const c=document.querySelector('.contents_style');
    const spans=[...c.querySelectorAll('span')].filter(x=>{
      const bg=(x.getAttribute('style')||'').replace(/\s/g,'').toLowerCase();
      return bg.includes('background:#fff3a3')||bg.includes('background-color:#fff3a3');
    });
    return {count:spans.length,texts:spans.map(x=>x.textContent.trim())};
  });
  if(result.count<6) throw new Error('E_PUBLIC_HIGHLIGHTS_'+JSON.stringify(result));
  console.log('PASS_HIGHLIGHTS '+JSON.stringify(result));
}catch(err){
  console.error('HIGHLIGHTS_FAIL '+(err?.stack||err));
  if(changed&&browser&&originalHtml){
    try{
      const context=browser.contexts()[0], p=await context.newPage();
      p.setDefaultTimeout(30000);
      p.on('dialog',async d=>{try{await d.accept();}catch{}});
      await openHtml(p); await save(p,originalHtml);
      console.error('ROLLBACK_HIGHLIGHTS_OK');
    }catch(e){console.error('ROLLBACK_HIGHLIGHTS_FAIL '+(e?.stack||e));}
  }
  throw err;
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
