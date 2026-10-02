import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
import { createHash } from 'node:crypto';

const BLOG='https://nhunnhun.tistory.com';
const START='/* NHUNNHUN_SKIN_R1_FOUNDATION_20261002 */';
const END='/* /NHUNNHUN_SKIN_R1_FOUNDATION_20261002 */';
const PATCH=`
${START}
:where(a,button,input,select,textarea,[tabindex]):focus-visible {
  outline: 2px solid #0052B3 !important;
  outline-offset: 2px !important;
}
#content { opacity: 1; }

.post-content img,
.contents_style img,
.post-content figure,
.contents_style figure {
  max-width: 100%;
  box-sizing: border-box;
}
.post-content img,
.contents_style img { height: auto !important; }
.post-content p > img,
.contents_style p > img {
  display: block;
  margin-left: auto;
  margin-right: auto;
}

.post-content ul,
.contents_style ul { list-style: disc outside !important; }
.post-content ol,
.contents_style ol { list-style: decimal outside !important; }
.post-content ul,
.post-content ol,
.contents_style ul,
.contents_style ol { padding-left: 1.4rem; }
.post-content ul li,
.post-content ol li,
.contents_style ul li,
.contents_style ol li { margin-left: .5rem; }

.post-content a,
.contents_style a {
  text-decoration: underline !important;
  text-underline-offset: 2px;
}
.post-content a:hover,
.contents_style a:hover {
  font-weight: inherit !important;
  text-decoration-thickness: 2px !important;
}

.post-content,
.contents_style { overflow-wrap: anywhere; }
.post-content table,
.contents_style table {
  max-width: 100%;
  box-sizing: border-box;
  border-collapse: collapse;
}
@media only screen and (max-width: 600px) {
  .post-content table,
  .contents_style table {
    display: block;
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .post-content th,
  .post-content td,
  .contents_style th,
  .contents_style td { min-width: 8rem; }
}
${END}
`;

function sha(v){return createHash('sha256').update(v).digest('hex');}
for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']){
  if(!process.env[k]) throw new Error('E_CONFIG');
}
const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({
  projectId:process.env.BROWSERBASE_PROJECT_ID,
  browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},
  timeout:300
});
let browser;
let beforeCss='';
let changed=false;

async function enterEditor(page){
  await page.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
  await page.locator('button.btn-edit-html').waitFor({state:'visible'});
  await page.locator('button.btn-edit-html').click();
  await page.waitForFunction(()=>location.hash==='#/source/html' && window.monaco?.editor?.getModels?.().length>0,{timeout:25000});
  await page.getByText('CSS',{exact:true}).click();
  await page.waitForFunction(()=>window.monaco?.editor?.getModels?.().some(m=>m.getLanguageId()==='css'),{timeout:25000});
  await page.waitForTimeout(700);
  return await page.evaluate(()=>window.monaco.editor.getModels().findIndex(m=>m.getLanguageId()==='css'));
}
async function save(page){
  await page.locator('button.btn-save').click();
  await page.waitForTimeout(3200);
}
async function audit(width,height){
  const ctx=await browser.newContext({viewport:{width,height}});
  const page=await ctx.newPage();
  await page.setExtraHTTPHeaders({'Cache-Control':'no-cache','Pragma':'no-cache'});
  await page.goto(BLOG+'/356?skin-r1-r2='+Date.now(),{waitUntil:'domcontentloaded'});
  await page.locator('.contents_style').waitFor({state:'visible'});
  const x=await page.evaluate(()=>{
    const c=document.querySelector('.contents_style');
    const imgs=[...c.querySelectorAll('img')].filter(i=>/사과/.test(i.alt));
    const ul=c.querySelector('ul'), ol=c.querySelector('ol');
    const a=c.querySelector('a[href^="https://www.fda.gov"],a[href^="https://nutritionsource"]');
    const table=c.querySelector('table');
    return {
      viewport:innerWidth,
      documentWidth:document.documentElement.scrollWidth,
      contentWidth:Math.round(c.getBoundingClientRect().width),
      images:imgs.map(i=>({width:Math.round(i.getBoundingClientRect().width),maxWidth:getComputedStyle(i).maxWidth,height:Math.round(i.getBoundingClientRect().height)})),
      ul:getComputedStyle(ul).listStyleType,
      ol:getComputedStyle(ol).listStyleType,
      link:getComputedStyle(a).textDecorationLine,
      table:getComputedStyle(table).display,
      tableWidth:Math.round(table.getBoundingClientRect().width),
      opacity:getComputedStyle(document.querySelector('#content')).opacity
    };
  });
  await ctx.close();
  const imagesOk=x.images.length===2 && x.images.every(i=>i.width<=x.contentWidth+1 && i.width<=720.5 && i.height>0);
  const ok=imagesOk && x.ul!=='none' && x.ol!=='none' && x.link.includes('underline') && x.opacity==='1' &&
    (width>600 ? x.table==='table' : x.table==='block') && x.documentWidth<=x.viewport;
  return {ok,result:x};
}

try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const page=await browser.contexts()[0].newPage();
  page.setDefaultTimeout(25000);
  page.on('dialog',async d=>{if(d.type()==='confirm') await d.accept(); else await d.dismiss();});

  const cssIndex=await enterEditor(page);
  beforeCss=await page.evaluate(i=>window.monaco.editor.getModels()[i].getValue(),cssIndex);
  if(!beforeCss.includes('.post-content')||beforeCss.length<10000) throw new Error('E_CSS_GUARD');

  let afterCss;
  const s=beforeCss.indexOf(START), e=beforeCss.indexOf(END);
  if(s>=0 && e>s){
    afterCss=beforeCss.slice(0,s)+PATCH.trim()+beforeCss.slice(e+END.length);
  }else{
    afterCss=beforeCss.replace(/\s*$/,'')+'\n\n'+PATCH+'\n';
  }
  console.log('R1R2_BACKUP '+JSON.stringify({length:beforeCss.length,sha256:sha(beforeCss)}));
  if(afterCss!==beforeCss){
    await page.evaluate(({i,v})=>window.monaco.editor.getModels()[i].setValue(v),{i:cssIndex,v:afterCss});
    await save(page);
    changed=true;
    console.log('R1R2_SAVED '+JSON.stringify({length:afterCss.length,sha256:sha(afterCss)}));
  }else console.log('R1R2_ALREADY_CURRENT');

  let checks;
  for(let n=0;n<5;n++){
    checks={desktop:await audit(1440,900),mobile:await audit(390,844)};
    if(checks.desktop.ok&&checks.mobile.ok) break;
    await new Promise(r=>setTimeout(r,1800));
  }
  if(!checks?.desktop.ok||!checks?.mobile.ok) throw new Error('E_PUBLIC_VERIFY');
  console.log('PASS_SKIN_R1_R2 '+JSON.stringify(checks));
}catch(err){
  console.error('R1R2_ERROR '+(err?.message||'E_UNKNOWN'));
  if(changed&&beforeCss){
    try{
      const page=await browser.contexts()[0].newPage();
      page.setDefaultTimeout(25000);
      page.on('dialog',async d=>{if(d.type()==='confirm') await d.accept(); else await d.dismiss();});
      const cssIndex=await enterEditor(page);
      await page.evaluate(({i,v})=>window.monaco.editor.getModels()[i].setValue(v),{i:cssIndex,v:beforeCss});
      await save(page);
      console.error('R1R2_ROLLBACK '+sha(beforeCss));
    }catch{console.error('R1R2_ROLLBACK_FAILED');}
  }
  process.exitCode=1;
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
