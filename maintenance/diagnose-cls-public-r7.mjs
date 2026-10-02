import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

for(const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID']){
  if(!process.env[k]) throw new Error('E_CONFIG_'+k);
}
const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
const session=await client.sessions.create({
  projectId:process.env.BROWSERBASE_PROJECT_ID,
  browserSettings:{recordSession:false,logSession:false,solveCaptchas:false},
  timeout:300
});
let browser;
try{
  browser=await chromium.connectOverCDP(session.connectUrl);
  const context=browser.contexts()[0];

  async function run(label,width,height){
    const page=await context.newPage();
    await page.setViewportSize({width,height});
    await page.addInitScript(()=>{
      window.__clsEntries=[]; window.__clsTotal=0;
      const sel=node=>{
        if(!node||node.nodeType!==1) return null;
        if(node.id) return '#'+node.id;
        let a=[],e=node,n=0;
        while(e&&e.nodeType===1&&n<5){
          let s=e.tagName.toLowerCase();
          if(e.classList?.length) s+='.'+[...e.classList].slice(0,3).join('.');
          a.unshift(s); e=e.parentElement; n++;
        }
        return a.join(' > ');
      };
      new PerformanceObserver(list=>{
        for(const e of list.getEntries()){
          if(e.hadRecentInput) continue;
          window.__clsTotal+=e.value;
          window.__clsEntries.push({
            value:e.value,startTime:e.startTime,
            sources:(e.sources||[]).map(s=>({
              selector:sel(s.node),
              previousRect:s.previousRect?{x:s.previousRect.x,y:s.previousRect.y,width:s.previousRect.width,height:s.previousRect.height}:null,
              currentRect:s.currentRect?{x:s.currentRect.x,y:s.currentRect.y,width:s.currentRect.width,height:s.currentRect.height}:null
            }))
          });
        }
      }).observe({type:'layout-shift',buffered:true});
    });
    await page.goto('https://nhunnhun.tistory.com/356',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(12000);
    const out=await page.evaluate(()=>({
      clsTotal:window.__clsTotal||0,
      entries:window.__clsEntries||[],
      title:document.title,
      adminTextLength:!!document.querySelector('.text-length'),
      contentRect:document.querySelector('#content')?.getBoundingClientRect().toJSON?.()||null,
      postRect:document.querySelector('.e-content.post-content')?.getBoundingClientRect().toJSON?.()||null,
      tocDisplay:document.querySelector('.toc-space')?getComputedStyle(document.querySelector('.toc-space')).display:null,
      mainDisplay:document.querySelector('#main')?getComputedStyle(document.querySelector('#main')).display:null
    }));
    await page.close();
    return {label,width,height,...out};
  }
  const mobile=await run('mobile-public',390,844);
  const desktop=await run('desktop-public',1440,1000);
  console.log('CLS_PUBLIC_R7 '+JSON.stringify({mobile,desktop}));
} finally {
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
