import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

for (const k of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID']) {
  if (!process.env[k]) throw new Error('E_CONFIG_'+k);
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
  const page=await context.newPage();
  await page.setViewportSize({width:390,height:844});

  await page.addInitScript(() => {
    window.__domTrace=[];
    const push=(type,data={})=>window.__domTrace.push({t:performance.now(),type,...data});
    const hasContents=node => {
      if(!node || node.nodeType!==1) return false;
      return node.matches?.('.contents_style') || !!node.querySelector?.('.contents_style');
    };
    const desc=node => node && node.nodeType===1 ? {
      tag:node.tagName,id:node.id||null,className:typeof node.className==='string'?node.className:null
    } : null;

    const orc=Node.prototype.removeChild;
    Node.prototype.removeChild=function(child){
      if(hasContents(child)) push('removeChild',{parent:desc(this),child:desc(child),stack:(new Error()).stack});
      return orc.call(this,child);
    };
    const orp=Node.prototype.replaceChild;
    Node.prototype.replaceChild=function(newChild,oldChild){
      if(hasContents(oldChild)||hasContents(newChild)) push('replaceChild',{parent:desc(this),oldChild:desc(oldChild),newChild:desc(newChild),stack:(new Error()).stack});
      return orp.call(this,newChild,oldChild);
    };
    const oer=Element.prototype.remove;
    Element.prototype.remove=function(){
      if(hasContents(this)) push('element.remove',{node:desc(this),stack:(new Error()).stack});
      return oer.call(this);
    };
    const oew=Element.prototype.replaceWith;
    Element.prototype.replaceWith=function(...nodes){
      if(hasContents(this)||nodes.some(hasContents)) push('replaceWith',{old:desc(this),nodes:nodes.map(desc),stack:(new Error()).stack});
      return oew.apply(this,nodes);
    };

    new MutationObserver(records=>{
      for(const r of records){
        for(const n of r.removedNodes){
          if(hasContents(n)) push('mutationRemoved',{target:desc(r.target),node:desc(n)});
        }
        for(const n of r.addedNodes){
          if(hasContents(n)) push('mutationAdded',{target:desc(r.target),node:desc(n)});
        }
      }
    }).observe(document,{subtree:true,childList:true});
  });

  await page.goto('https://nhunnhun.tistory.com/356',{waitUntil:'domcontentloaded'});

  async function snap(label){
    return page.evaluate(label=>{
      const cs=[...document.querySelectorAll('.contents_style')];
      const post=document.querySelector('.e-content.post-content');
      const main=document.querySelector('#main');
      const content=document.querySelector('#content');
      const sidebar=document.querySelector('#sidebar');
      return {
        label,t:performance.now(),
        count:cs.length,
        contents:cs.map((e,i)=>({i,parent:e.parentElement?.className||e.parentElement?.id||e.parentElement?.tagName,children:e.children.length,textLen:e.textContent?.length||0,rect:e.getBoundingClientRect().toJSON()})),
        post:post?{htmlChildClasses:[...post.children].map(x=>x.className||x.tagName),rect:post.getBoundingClientRect().toJSON()}:null,
        main:main?{display:getComputedStyle(main).display,rect:main.getBoundingClientRect().toJSON()}:null,
        content:content?{display:getComputedStyle(content).display,rect:content.getBoundingClientRect().toJSON()}:null,
        sidebar:sidebar?{display:getComputedStyle(sidebar).display,rect:sidebar.getBoundingClientRect().toJSON()}:null,
        resources:performance.getEntriesByType('resource').filter(x=>x.startTime<performance.now() && x.startTime>Math.max(0,performance.now()-500)).map(x=>x.name).slice(-20)
      };
    },label);
  }

  const snaps=[];
  snaps.push(await snap('domcontentloaded'));
  for(const ms of [100,400,500,500,700,1000,2000]){
    await page.waitForTimeout(ms);
    snaps.push(await snap('+'+ms));
  }
  const trace=await page.evaluate(()=>window.__domTrace||[]);
  console.log('DOM_R4_TRACE '+JSON.stringify({snaps,trace}));
} finally {
  try{await browser?.close();}catch{}
  try{await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});}catch{}
}
