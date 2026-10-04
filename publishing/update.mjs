import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BLOG } from './core.mjs';
import { localBrowserConfig, assertLocalGit, openEditorContext, openPublicBrowser } from './local-browser.mjs';
import { renderEditorialPost, editorialExpectations, assertEditorialContract, EDITORIAL_TEMPLATE_VERSION } from './editorial.mjs';
import { loadUpdates, eligibleUpdate, updateFingerprint } from './update-core.mjs';
import { UpdateLedger } from './update-ledger.mjs';

function imageSources(html){
  return [...html.matchAll(/<img\b[^>]*\bsrc=(["'])(.*?)\1[^>]*>/gi)].map(m=>m[2]);
}
async function downloadImage(url,path){
  let last='';
  for(let attempt=0;attempt<4;attempt++){
    const response=await fetch(url,{
      headers:{'User-Agent':'Mozilla/5.0','Accept':'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'},
      signal:AbortSignal.timeout(20000)
    });
    if(response.ok){
      const type=response.headers.get('content-type')??'';
      if(!type.toLowerCase().startsWith('image/')) throw new Error('E_UPDATE_IMAGE_CONTENT_TYPE');
      const bytes=Buffer.from(await response.arrayBuffer());
      if(!bytes.length || bytes.length>12*1024*1024) throw new Error('E_UPDATE_IMAGE_SIZE');
      await writeFile(path,bytes);
      return;
    }
    last=String(response.status);
    await new Promise(r=>setTimeout(r,500));
  }
  throw new Error('E_UPDATE_IMAGE_DOWNLOAD_'+last);
}
async function uploadImage(page,sourceUrl,index,tempDir){
  const path=join(tempDir,`update-image-${index}.bin`);
  await downloadImage(sourceUrl,path);
  await page.evaluate(()=>document.querySelectorAll('#attach-layer-btn')[0]?.click());
  const responsePromise=page.waitForResponse(res=>
    res.url().includes('/manage/post/attach.json') &&
    res.request().method()==='POST' &&
    res.status()===200
  ,{timeout:30000});
  await page.locator('#attach-image').setInputFiles(path);
  const data=await (await responsePromise).json();
  if(!data?.url || !data.url.includes('kakaocdn.net')) throw new Error('E_UPDATE_IMAGE_UPLOAD');
  return data.url;
}
function replaceImageSources(html,mapping,representativeSource){
  let first=true;
  return html.replace(/<img\b[^>]*>/gi,tag=>{
    const match=tag.match(/\bsrc=(["'])(.*?)\1/i);
    if(!match) return tag;
    const source=match[2], target=mapping.get(source);
    if(!target) throw new Error('E_UPDATE_IMAGE_MAPPING');
    let out=tag.replace(match[0],`src="${target}"`);
    out=out.replace(/\s(?:loading|decoding|fetchpriority)=(["']).*?\1/gi,'');
    const priority=source===representativeSource || first;
    out=out.replace(/>$/,` loading="${priority?'eager':'lazy'}" decoding="async"${priority?' fetchpriority="high"':''}>`);
    first=false;
    return out;
  });
}
async function materializedText(page,html){
  return page.evaluate(markup=>{
    const host=document.createElement('div');
    host.setAttribute('aria-hidden','true');
    host.style.cssText='position:fixed;left:-100000px;top:0;width:800px;opacity:0;pointer-events:none;';
    host.innerHTML=markup;
    document.body.appendChild(host);
    const text=(host.innerText||host.textContent||'').replace(/\s+/g,' ').trim();
    host.remove();
    return text;
  },html);
}
async function editorialSnapshot(content){
  return content.evaluate(root=>{
    const h2=[...root.querySelectorAll('h2')], h3=[...root.querySelectorAll('h3')];
    const accents=[...root.querySelectorAll('div[aria-hidden="true"]')].filter(x=>{
      const s=x.getAttribute('style')||''; return /width:\s*34px/.test(s)&&/height:\s*4px/.test(s);
    });
    const tables=[...root.querySelectorAll('table')];
    const tableWraps=tables.filter(t=>/overflow-x:\s*auto/.test(t.parentElement?.getAttribute('style')||''));
    const images=[...root.querySelectorAll('img')];
    const responsiveImages=images.filter(img=>/width:\s*100%/.test(img.getAttribute('style')||'')&&/max-width:\s*720px/.test(img.getAttribute('style')||''));
    const highlights=[...root.querySelectorAll('span')].filter(x=>/background:\s*linear-gradient\(transparent 45%,#[0-9a-f]{6} 45%\)/i.test(x.getAttribute('style')||''));
    const highlightColors=new Set(highlights.map(x=>((x.getAttribute('style')||'').match(/linear-gradient\(transparent 45%,(#[0-9a-f]{6}) 45%\)/i)||[])[1]).filter(Boolean).map(x=>x.toLowerCase()));
    const qs=[...root.querySelectorAll('span')].filter(x=>x.textContent.trim()==='Q.');
    const as=[...root.querySelectorAll('span')].filter(x=>x.textContent.trim()==='A.');
    const latest=[...root.querySelectorAll('div')].filter(x=>/최신 근거\s*·?\s*\d{4}/.test(x.textContent)&&/background:\s*#fbfcfe/.test(x.getAttribute('style')||''));
    const summary=[...h2].find(x=>x.textContent.trim()==='핵심 정리');
    const related=[...h2].find(x=>x.textContent.trim()==='함께 보면 좋은 글');
    const sources=[...h2].find(x=>x.textContent.trim()==='자료 출처');
    const relatedCards=related?(()=>{let n=0,e=related.nextElementSibling;while(e&&e.tagName!=='H2'){if(e.querySelector?.('a[style*="text-decoration:none"]'))n++;e=e.nextElementSibling;}return n;})():0;
    return {
      h2:h2.length,
      h2Styled:h2.filter(x=>/font-size:\s*26px/.test(x.getAttribute('style')||'')&&/font-weight:\s*800/.test(x.getAttribute('style')||'')).length,
      h3:h3.length,
      h3Styled:h3.filter(x=>/font-size:\s*20px/.test(x.getAttribute('style')||'')&&/font-weight:\s*800/.test(x.getAttribute('style')||'')).length,
      accents:accents.length,tables:tables.length,tableWraps:tableWraps.length,
      images:images.length,responsiveImages:responsiveImages.length,
      nativeImages:images.filter(x=>x.src.includes('kakaocdn.net')).length,
      highlights:highlights.length,highlightColors:highlightColors.size,
      faqQ:qs.length,faqA:as.length,latest:latest.length,
      summaryBox:!!(summary?.nextElementSibling&&/background:\s*#f8fafc/.test(summary.nextElementSibling.getAttribute('style')||'')),
      relatedCards,
      sourcesStyled:!!(sources?.nextElementSibling&&sources.nextElementSibling.tagName==='UL'&&/font-size:\s*14px/.test(sources.nextElementSibling.getAttribute('style')||''))
    };
  });
}
function assertSnapshot(snapshot,expected){
  if(snapshot.h2!==expected.h2||snapshot.h2Styled!==expected.h2||snapshot.accents!==expected.h2) throw new Error('E_UPDATE_PUBLIC_H2');
  if(snapshot.h3!==expected.h3||snapshot.h3Styled!==expected.h3) throw new Error('E_UPDATE_PUBLIC_H3');
  if(snapshot.tables!==expected.tables||snapshot.tableWraps!==expected.tables) throw new Error('E_UPDATE_PUBLIC_TABLE');
  if(snapshot.images!==expected.images||snapshot.responsiveImages!==expected.images||snapshot.nativeImages<expected.images) throw new Error('E_UPDATE_PUBLIC_IMAGE');
  if(snapshot.highlights!==expected.highlights||(expected.highlights>=2&&snapshot.highlightColors<2)) throw new Error('E_UPDATE_PUBLIC_HIGHLIGHT');
  if(snapshot.faqQ!==expected.faq||snapshot.faqA!==expected.faq) throw new Error('E_UPDATE_PUBLIC_FAQ');
  if(snapshot.latest!==expected.latest) throw new Error('E_UPDATE_PUBLIC_LATEST');
  if(expected.summary&&!snapshot.summaryBox) throw new Error('E_UPDATE_PUBLIC_SUMMARY');
  if(expected.related&&snapshot.relatedCards!==expected.relatedLinks) throw new Error('E_UPDATE_PUBLIC_RELATED');
  if(expected.sources&&!snapshot.sourcesStyled) throw new Error('E_UPDATE_PUBLIC_SOURCES');
}
async function verifyDesktop(browser,update,targetHtml,expected){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  try{
    const page=await context.newPage();
    await page.goto(update.targetUrl,{waitUntil:'domcontentloaded'});
    if(!(await page.locator('body').innerText()).includes(update.title)) throw new Error('E_UPDATE_PUBLIC_TITLE');
    const content=page.locator('.contents_style');
    if(await content.count()!==1) throw new Error('E_UPDATE_PUBLIC_CONTENT');
    const actual=(await content.innerText()).replace(/\s+/g,' ').trim();
    const expectedText=await materializedText(page,targetHtml);
    if(!expectedText||actual!==expectedText) throw new Error('E_UPDATE_PUBLIC_BODY');
    const og=await page.locator('meta[property="og:image"]').getAttribute('content').catch(()=>null);
    if(!og||og.includes('opengraph.png')||!og.includes('kakaocdn.net')) throw new Error('E_UPDATE_PUBLIC_OG');
    const snapshot=await editorialSnapshot(content);
    assertSnapshot(snapshot,expected);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+4);
    if(overflow) throw new Error('E_UPDATE_PC_OVERFLOW');
    return snapshot;
  }finally{await context.close();}
}
async function verifyMobile(browser,update){
  const context=await browser.newContext({
    viewport:{width:390,height:844},
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  });
  try{
    const page=await context.newPage();
    await page.goto(update.targetUrl,{waitUntil:'domcontentloaded'});
    const body=await page.locator('body').innerText();
    if(!body.includes(update.title)||!body.includes('핵심 정리')||!body.includes('자료 출처')) throw new Error('E_UPDATE_MOBILE_BODY');
    const metrics=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+4,
      wideImages:[...document.querySelectorAll('.contents_style img')].filter(x=>x.getBoundingClientRect().width>document.documentElement.clientWidth+4).length
    }));
    if(metrics.overflow||metrics.wideImages) throw new Error('E_UPDATE_MOBILE_OVERFLOW');
    return metrics;
  }finally{await context.close();}
}

let editorContext,publicBrowser,tempDir,editorPage;
let stage='configuration';
try{
  if(process.env.UPDATE_ENABLED!=='true'){
    console.log('UPDATE_DISABLED');
  }else{
    assertLocalGit();
    const ledger=new UpdateLedger();
    const queue=[];
    for(const update of await loadUpdates()){
      const state=await ledger.read(update.id);
      if(eligibleUpdate(update,state)) queue.push(update);
    }
    if(queue.length>1) throw new Error('E_ONE_UPDATE_PER_RUN');
    if(!queue.length){
      console.log('NO_PENDING_UPDATES');
    }else{
      const update=queue[0];
      const fingerprint=updateFingerprint(update);
      const browserConfig=await localBrowserConfig();
      editorContext=await openEditorContext(browserConfig);
      tempDir=await mkdtemp(join(tmpdir(),'tistory-update-'));
      let page=await editorContext.newPage();
      editorPage=page;
      page.setDefaultTimeout(25000);
      page.on('dialog',async d=>{if(d.type()==='confirm') await d.accept(); else await d.dismiss();});

      stage='editor-open';
      await page.goto(`${BLOG}/manage/newpost/${update.articleId}`,{waitUntil:'domcontentloaded'});
      if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
      await page.locator('#post-title-inp').waitFor({state:'visible'});
      const currentTitle=(await page.locator('#post-title-inp').inputValue()).trim();
      if(currentTitle!==update.expectedCurrentTitle) throw new Error('E_UPDATE_CURRENT_TITLE_MISMATCH');

      stage='read-original';
      await page.locator('#editor-mode-layer-btn-open').click();
      await page.locator('#editor-mode-html').click();
      const cm=page.locator('.CodeMirror:visible');
      await cm.waitFor({state:'visible'});
      const originalHtml=await cm.evaluate(el=>el?.CodeMirror?.getValue?.()||'');
      if(!originalHtml.trim()) throw new Error('E_UPDATE_ORIGINAL_EMPTY');

      stage='fresh-basic-editor';
      await page.close();
      page=await editorContext.newPage();
      editorPage=page;
      page.setDefaultTimeout(25000);
      page.on('dialog',async d=>{if(d.type()==='confirm') await d.accept(); else await d.dismiss();});
      await page.goto(`${BLOG}/manage/newpost/${update.articleId}`,{waitUntil:'domcontentloaded'});
      await page.locator('#post-title-inp').waitFor({state:'visible'});
      if((await page.locator('#post-title-inp').inputValue()).trim()!==update.expectedCurrentTitle) throw new Error('E_UPDATE_CURRENT_TITLE_MISMATCH');

      stage='render-update';
      const rendered=renderEditorialPost(update);
      const expected=editorialExpectations(update.bodyHtml);
      const sources=[...new Set(imageSources(rendered))];
      const imageMap=new Map();
      for(let i=0;i<sources.length;i++){
        stage=`image-upload-${i+1}`;
        imageMap.set(sources[i],await uploadImage(page,sources[i],i,tempDir));
      }
      const targetHtml=replaceImageSources(rendered,imageMap,update.representativeImageUrl);

      stage='stage-content';
      await page.locator('#post-title-inp').fill(update.title);
      await page.locator('#editor-mode-layer-btn-open').click();
      await page.locator('#editor-mode-html').click();
      const code=page.locator('.CodeMirror:visible .CodeMirror-code');
      await code.waitFor({state:'visible'});
      await code.click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.insertText(targetHtml);
      const staged=await page.locator('.CodeMirror:visible').evaluate(el=>el?.CodeMirror?.getValue?.()||'');
      assertEditorialContract(staged,update.bodyHtml);

      stage='publish-dialog';
      await page.locator('#publish-layer-btn').click();
      const thumb=page.locator('.publish_editor .box_thumb');
      if(await thumb.count()!==1) throw new Error('E_UPDATE_REPRESENTATIVE_UNVERIFIED');
      const repUploaded=imageMap.get(update.representativeImageUrl);
      if(!repUploaded) throw new Error('E_UPDATE_REPRESENTATIVE_UNVERIFIED');
      const repPathname=new URL(repUploaded).pathname;
      const thumbState=await thumb.evaluate((box,pathname)=>{
        const text=(box.textContent||'').trim();
        const img=box.querySelector('img');
        const styleNode=box.querySelector('[style*="background-image"]');
        const raw=[img?.getAttribute('src')||'',styleNode?.getAttribute('style')||''].join(' ');
        let decoded=raw;
        try{decoded=decodeURIComponent(raw);}catch{}
        return {hasVisual:!!(img||styleNode),isEmpty:text.includes('대표이미지 추가'),matches:decoded.includes(pathname)};
      },repPathname);
      if(!thumbState.hasVisual || thumbState.isEmpty || !thumbState.matches){
        const diag=await thumb.evaluate(box=>({
          text:(box.textContent||'').trim().slice(0,160),
          children:[...box.querySelectorAll('button,input,label,a,img')].map(x=>({
            tag:x.tagName,
            cls:String(x.className||'').slice(0,120),
            type:x.getAttribute('type'),
            aria:x.getAttribute('aria-label'),
            title:x.getAttribute('title'),
            text:(x.textContent||'').trim().slice(0,80),
            hasSrc:x.tagName==='IMG'
          })).slice(0,30)
        }));
        console.log('REP_THUMB_DIAG '+JSON.stringify(diag));
        throw new Error('E_UPDATE_REPRESENTATIVE_UNVERIFIED');
      }

      let submit=null;
      for(const name of ['변경사항 저장','수정','완료','공개 발행']){
        const button=page.getByRole('button',{name,exact:true});
        if(await button.count()){submit=button.last();break;}
      }
      if(!submit) throw new Error('E_UPDATE_SUBMIT_CONTROL');

      const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
      const remoteMain=execFileSync('git',['ls-remote','origin','refs/heads/main'],{encoding:'utf8'}).trim().split(/\s+/)[0]||'';
      if(!remoteMain||remoteMain!==sourceCommit) throw new Error('E_SOURCE_DRIFT');

      await ledger.write(update.id,{
        phase:'submitting',fingerprint,url:update.targetUrl,articleId:update.articleId,
        sourceCommit,editorialTemplateVersion:EDITORIAL_TEMPLATE_VERSION,timestamp:new Date().toISOString()
      });

      stage='final-submit';
      await submit.click();
      await page.waitForTimeout(4500);

      stage='public-verification';
      publicBrowser=await openPublicBrowser(browserConfig);
      const desktop=await verifyDesktop(publicBrowser,update,targetHtml,expected);
      const mobile=await verifyMobile(publicBrowser,update);

      const state=await ledger.read(update.id);
      if(state?.phase!=='submitting'||state.fingerprint!==fingerprint||state.url!==update.targetUrl) throw new Error('E_UPDATE_LEDGER_CONFLICT');
      await ledger.write(update.id,{
        phase:'updated',fingerprint,url:update.targetUrl,articleId:update.articleId,
        previousTitle:update.expectedCurrentTitle,title:update.title,
        sourceCommit,editorialTemplateVersion:EDITORIAL_TEMPLATE_VERSION,
        timestamp:new Date().toISOString(),verification:'anonymous_full_body_editorial_pc_mobile',
        desktop,mobile
      },state.sha);
      console.log('UPDATED: '+update.id+' '+update.targetUrl);
    }
  }
}catch(error){
  const code=/^E_[A-Z_]+$/.test(error?.message??'')?error.message:'E_UPDATE_RUNTIME';
  console.error('UPDATE_DIAGNOSTIC: '+stage+' '+code);
  console.error('STOP: 기존 글 수정 결과가 불명확하면 자동 재수정하지 않습니다.');
  process.exitCode=1;
}finally{
  for(const resource of [publicBrowser,editorContext]){
    try{await resource?.close();}catch{console.error('E_UPDATE_BROWSER_CLOSE');process.exitCode=1;}
  }
  if(tempDir) try{await rm(tempDir,{recursive:true,force:true});}catch{console.error('E_UPDATE_TEMP_CLEANUP');process.exitCode=1;}
}
