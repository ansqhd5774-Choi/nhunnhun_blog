import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
import { createHash } from 'node:crypto';

const BLOG='https://nhunnhun.tistory.com';
const MARKER='/* NHUNNHUN_SKIN_R1_FOUNDATION_20261002 */';
const PATCH=`
${MARKER}
/* Accessibility: override the legacy global outline reset only for keyboard focus. */
:where(a,button,input,select,textarea,[tabindex]):focus-visible {
  outline: 2px solid #0052B3 !important;
  outline-offset: 2px !important;
}

/* Content must remain visible even if the legacy fade-in script fails. */
#content {
  opacity: 1;
}

/* Article media must never exceed the readable content column. */
.post-content img,
.contents_style img,
.post-content figure,
.contents_style figure {
  max-width: 100% !important;
  box-sizing: border-box;
}
.post-content img,
.contents_style img {
  height: auto !important;
}
.post-content p > img,
.contents_style p > img {
  display: block;
  margin-left: auto;
  margin-right: auto;
}

/* Restore semantic list markers hidden by the skin's global reset. */
.post-content ul,
.contents_style ul {
  list-style: disc outside !important;
}
.post-content ol,
.contents_style ol {
  list-style: decimal outside !important;
}
.post-content ul,
.post-content ol,
.contents_style ul,
.contents_style ol {
  padding-left: 1.4rem;
}
.post-content ul li,
.post-content ol li,
.contents_style ul li,
.contents_style ol li {
  margin-left: .5rem;
}

/* Article links stay identifiable without font-weight layout shift on hover. */
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

/* Long words and wide tables must not break the mobile viewport. */
.post-content,
.contents_style {
  overflow-wrap: anywhere;
}
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
  .contents_style td {
    min-width: 8rem;
  }
}
/* /NHUNNHUN_SKIN_R1_FOUNDATION_20261002 */
`;

function sha(s){return createHash('sha256').update(s).digest('hex');}
for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) if(!process.env[k]) throw new Error('E_CONFIG');
const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({
  projectId:process.env.BROWSERBASE_PROJECT_ID,
  browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false},
  timeout:300
});
let browser;
let originalCss='';
let changed=false;

async function openSource(page){
  await page.goto(BLOG+'/manage/design/skin/edit',{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
  await page.locator('button.btn-edit-html').waitFor({state:'visible'});
  await page.locator('button.btn-edit-html').click();
  await page.waitForFunction(()=>location.hash==='#/source/html' && window.monaco?.editor?.getModels?.().length>0,{timeout:25000});
  await page.waitForTimeout(1500);
}
async function selectCss(page){
  await page.getByText('CSS',{exact:true}).click();
  await page.waitForFunction(()=>window.monaco?.editor?.getModels?.().some(m=>m.getLanguageId()==='css'),{timeout:25000});
  await page.waitForTimeout(800);
  const info=await page.evaluate(()=>{
    const ms=window.monaco.editor.getModels();
    return ms.map((m,i)=>({i,lang:m.getLanguageId(),len:m.getValueLength(),uri:String(m.uri)}));
  });
  console.log('MODELS '+JSON.stringify(info));
  const css=info.find(x=>x.lang==='css');
  if(!css) throw new Error('E_CSS_MODEL');
  return css.i;
}
async function save(page){
  const b=page.locator('button.btn-save');
  await b.waitFor({state:'visible'});
  await b.click();
  await page.waitForTimeout(3000);
}
async function verify(viewport){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  await page.setExtraHTTPHeaders({'Cache-Control':'no-cache','Pragma':'no-cache'});
  await page.goto(BLOG+'/356?skin-r1='+Date.now(),{waitUntil:'domcontentloaded'});
  await page.locator('.contents_style').waitFor({state:'visible'});
  const result=await page.evaluate(()=>{
    const content=document.querySelector('.contents_style');
    const img=[...content.querySelectorAll('img')].find(x=>/사과/.test(x.alt));
    const ul=content.querySelector('ul');
    const ol=content.querySelector('ol');
    const link=content.querySelector('a[href^="https://www.fda.gov"],a[href^="https://nutritionsource"]');
    const table=content.querySelector('table');
    const shell=document.querySelector('#content');
    return {
      viewport:innerWidth,
      documentWidth:document.documentElement.scrollWidth,
      contentWidth:Math.round(content.getBoundingClientRect().width),
      imageWidth:img?Math.round(img.getBoundingClientRect().width):null,
      imageMaxWidth:img?getComputedStyle(img).maxWidth:null,
      ulStyle:ul?getComputedStyle(ul).listStyleType:null,
      olStyle:ol?getComputedStyle(ol).listStyleType:null,
      linkDecoration:link?getComputedStyle(link).textDecorationLine:null,
      tableDisplay:table?getComputedStyle(table).display:null,
      tableWidth:table?Math.round(table.getBoundingClientRect().width):null,
      contentOpacity:shell?getComputedStyle(shell).opacity:null
    };
  });
  await context.close();
  const ok=result.imageWidth!==null &&
    result.imageWidth<=result.contentWidth+1 &&
    result.ulStyle && result.ulStyle!=='none' &&
    result.olStyle && result.olStyle!=='none' &&
    result.linkDecoration?.includes('underline') &&
    result.contentOpacity==='1' &&
    (viewport.width>600 ? result.tableDisplay==='table' : result.tableDisplay==='block');
  return {ok,result};
}

try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0];
  const page=await context.newPage();
  page.setDefaultTimeout(25000);
  page.on('dialog',async d=>{ if(d.type()==='confirm') await d.accept(); else await d.dismiss(); });

  await openSource(page);
  const cssIndex=await selectCss(page);
  originalCss=await page.evaluate(i=>window.monaco.editor.getModels()[i].getValue(),cssIndex);
  if(!originalCss.includes('.post-content') || originalCss.length<10000) throw new Error('E_CSS_SOURCE_GUARD');
  console.log('BACKUP '+JSON.stringify({length:originalCss.length,sha256:sha(originalCss)}));

  let newCss=originalCss;
  if(!newCss.includes(MARKER)) newCss=newCss.replace(/\s*$/,'')+'\n\n'+PATCH+'\n';
  if(newCss===originalCss) console.log('ALREADY_APPLIED');
  else{
    await page.evaluate(({i,v})=>window.monaco.editor.getModels()[i].setValue(v),{i:cssIndex,v:newCss});
    await save(page);
    changed=true;
    console.log('SAVED '+JSON.stringify({length:newCss.length,sha256:sha(newCss)}));
  }

  let verified=null;
  for(let attempt=1;attempt<=5;attempt++){
    const desktop=await verify({width:1440,height:900});
    const mobile=await verify({width:390,height:844});
    verified={desktop,mobile};
    if(desktop.ok&&mobile.ok) break;
    await new Promise(r=>setTimeout(r,1800));
  }
  if(!verified?.desktop.ok||!verified?.mobile.ok) throw new Error('E_PUBLIC_VERIFY');
  console.log('PASS_SKIN_R1 '+JSON.stringify(verified));

}catch(err){
  console.error('APPLY_ERROR '+(err?.message||'E_UNKNOWN'));
  if(changed && originalCss){
    try{
      const context=browser.contexts()[0];
      const page=await context.newPage();
      page.setDefaultTimeout(25000);
      page.on('dialog',async d=>{ if(d.type()==='confirm') await d.accept(); else await d.dismiss(); });
      await openSource(page);
      const cssIndex=await selectCss(page);
      await page.evaluate(({i,v})=>window.monaco.editor.getModels()[i].setValue(v),{i:cssIndex,v:originalCss});
      await save(page);
      console.error('ROLLBACK_APPLIED '+sha(originalCss));
    }catch{
      console.error('ROLLBACK_FAILED');
    }
  }
  process.exitCode=1;
}finally{
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
