import { assertContentStandard } from './content-standards.mjs';
import { assertCurrentSource } from './runner-gate.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BLOG } from './core.mjs';
import { localBrowserConfig, assertLocalGit, openEditorConnection, closeEditorConnection, freshEditorPage, ensureEditorRendering, installLightweightRouting } from './local-browser.mjs';
import { renderEditorialPost, assertEditorialContract, EDITORIAL_TEMPLATE_VERSION, editorialVersionFor } from './editorial.mjs';
import { loadUpdates, eligibleUpdate, updateFingerprint } from './update-core.mjs';
import { UpdateLedger } from './update-ledger.mjs';
import { assertImageReview } from './image-review.mjs';

function imageSources(html){
  return [...html.matchAll(/<img\b[^>]*\bsrc=(["'])(.*?)\1[^>]*>/gi)].map(m=>m[2]);
}
function imageRetryDelayMs(response,attempt){
  const retryAfter=(response.headers.get('retry-after')||'').trim();
  if(retryAfter){
    const seconds=Number(retryAfter);
    const ms=Number.isFinite(seconds)
      ? Math.max(0,seconds*1000)
      : Math.max(0,Date.parse(retryAfter)-Date.now());
    if(ms>120000) throw new Error('E_UPDATE_IMAGE_RATE_LIMIT_LONG');
    if(ms>0) return ms;
  }
  if(response.status===429||response.status===503) return Math.min(30000,5000*(2**attempt));
  return 500;
}
async function downloadImage(url,path){
  let last='';
  for(let attempt=0;attempt<4;attempt++){
    let response;
    try{
      response=await fetch(url,{
        headers:{
          'User-Agent':'NHUNNHUN-Tistory-Publisher/1.0 (https://nhunnhun.tistory.com/)',
          'Accept':'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        },
        signal:AbortSignal.timeout(20000)
      });
    }catch(error){
      if(error?.name==='TimeoutError'||error?.name==='AbortError') throw new Error('E_UPDATE_IMAGE_DOWNLOAD_TIMEOUT');
      throw new Error('E_UPDATE_IMAGE_DOWNLOAD_NETWORK');
    }
    if(response.ok){
      const type=response.headers.get('content-type')??'';
      if(!type.toLowerCase().startsWith('image/')) throw new Error('E_UPDATE_IMAGE_CONTENT_TYPE');
      const bytes=Buffer.from(await response.arrayBuffer());
      if(!bytes.length || bytes.length>12*1024*1024) throw new Error('E_UPDATE_IMAGE_SIZE');
      await writeFile(path,bytes);
      return;
    }
    last=String(response.status);
    await new Promise(r=>setTimeout(r,imageRetryDelayMs(response,attempt)));
  }
  throw new Error('E_UPDATE_IMAGE_DOWNLOAD_'+last);
}
async function uploadImage(page,sourceUrl,index,tempDir){
  const path=join(tempDir,`update-image-${index}.bin`);
  let step='download';
  try{
    await downloadImage(sourceUrl,path);
    step='input-probe';
    const input=page.locator('#attach-image');
    const inputCount=await input.count();
    if(inputCount===0){
      step='attach-button';
      const opened=await page.evaluate(()=>{
        const button=document.querySelectorAll('#attach-layer-btn')[0];
        if(!button) return false;
        button.click();
        return true;
      });
      if(!opened) throw new Error('E_UPDATE_IMAGE_ATTACH_BUTTON');
      step='input-attach-wait';
      await input.waitFor({state:'attached',timeout:10000});
    }
    step='response-arm';
    const responsePromise=page.waitForResponse(res=>
      res.url().includes('/manage/post/attach.json') &&
      res.request().method()==='POST'
    ,{timeout:30000});
    step='set-input';
    try{
      await input.setInputFiles(path);
    }catch{
      throw new Error('E_UPDATE_IMAGE_INPUT');
    }
    step='response-wait';
    let uploadResponse;
    try{
      uploadResponse=await responsePromise;
    }catch{
      throw new Error('E_UPDATE_IMAGE_RESPONSE_TIMEOUT');
    }
    step='response-status';
    if(uploadResponse.status()!==200) throw new Error('E_UPDATE_IMAGE_UPLOAD_HTTP');
    step='response-json';
    let data;
    try{
      data=await uploadResponse.json();
    }catch{
      throw new Error('E_UPDATE_IMAGE_UPLOAD_RESPONSE');
    }
    step='response-url';
    if(!data?.url || !data.url.includes('kakaocdn.net')) throw new Error('E_UPDATE_IMAGE_UPLOAD');
    return data.url;
  }catch(error){
    if(/^E_UPDATE_IMAGE_/.test(String(error?.message||''))) throw error;
    const code={
      download:'E_UPDATE_IMAGE_DOWNLOAD_UNEXPECTED',
      'input-probe':'E_UPDATE_IMAGE_INPUT_PROBE',
      'attach-button':'E_UPDATE_IMAGE_ATTACH_BUTTON',
      'input-attach-wait':'E_UPDATE_IMAGE_INPUT_ATTACH_WAIT',
      'response-arm':'E_UPDATE_IMAGE_RESPONSE_ARM',
      'set-input':'E_UPDATE_IMAGE_INPUT',
      'response-wait':'E_UPDATE_IMAGE_RESPONSE_TIMEOUT',
      'response-status':'E_UPDATE_IMAGE_UPLOAD_HTTP',
      'response-json':'E_UPDATE_IMAGE_UPLOAD_RESPONSE',
      'response-url':'E_UPDATE_IMAGE_UPLOAD'
    }[step]||'E_UPDATE_IMAGE_UNKNOWN';
    throw new Error(code);
  }
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
async function selectEditorMode(page,mode){
  const selector=mode==='html'?'#editor-mode-html-text:visible, #editor-mode-html-tistory:visible':'#editor-mode-kakao-text:visible, #editor-mode-kakao-tistory:visible';
  const visibleEditors=await page.locator('.CodeMirror:visible').count();
  if(mode==='html'&&visibleEditors)return;
  if(mode==='basic'&&!visibleEditors)return;
  const option=page.locator(selector).first();
  if(!await option.isVisible()){
    await page.locator('button:visible').filter({has:page.locator('.mce-txt')}).filter({hasText:/기본모드|HTML|마크다운/}).first().click({timeout:10000}).catch(error=>{throw Object.assign(Error('E_UPDATE_EDITOR_MODE_MENU'),{cause:error});});
  }
  await option.waitFor({state:'visible',timeout:10000}).catch(error=>{throw Object.assign(Error('E_UPDATE_EDITOR_MODE_OPTION'),{cause:error});});
  await option.click({timeout:10000}).catch(error=>{throw Object.assign(Error('E_UPDATE_EDITOR_MODE_CLICK'),{cause:error});});
  await page.waitForFunction(expected=>{
    const visibleEditors=[...document.querySelectorAll('.CodeMirror')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
    return expected==='html'?visibleEditors.some(el=>typeof el.CodeMirror?.getValue==='function'):visibleEditors.length===0;
  },mode,{timeout:10000,polling:100}).catch(error=>{throw Object.assign(Error('E_UPDATE_EDITOR_MODE_TRANSITION'),{cause:error});});
}

async function probeManagedPost(page,update){
  try{
    const currentUrl=new URL(page.url());
    if(currentUrl.origin!==BLOG||!currentUrl.pathname.startsWith('/manage'))
      await page.goto(`${BLOG}/manage/posts`,{waitUntil:'domcontentloaded',timeout:30000});
    const managedUrl=new URL(page.url());
    if(managedUrl.origin!==BLOG||!managedUrl.pathname.startsWith('/manage')) throw new Error('E_LOGIN_REQUIRED');
    const result=await page.evaluate(async ({id,title})=>{
      try {
      async function getPage(page,searchKeyword=''){
        const params=new URLSearchParams({
          category:'-3',page:String(page),searchKeyword,searchType:'title',visibility:'all'
        });
        const response=await fetch('/manage/posts.json?'+params.toString(),{
          credentials:'include',
          headers:{Accept:'application/json'}
        });
        let data=null;
        try{data=await response.json();}catch{throw Error('E_UPDATE_TARGET_RESPONSE_JSON');}
        const items=Array.isArray(data?.items)?data.items:Array.isArray(data?.data?.items)?data.data.items:null;
        if(!items)throw Error('E_UPDATE_TARGET_RESPONSE_SCHEMA');
        return {status:response.status,items};
      }
      let first=await getPage(1,title);
      let item=first.items.find(x=>String(x?.id)===String(id))||null;
      let status=first.status;
      if(!item && status===200){
        for(let page=1;page<=100 && !item;page++){
          const scan=await getPage(page,'');
          status=scan.status;
          if(status!==200||scan.items.length===0) break;
          if(page===100)throw Error('E_UPDATE_TARGET_SCAN_LIMIT');
          item=scan.items.find(x=>String(x?.id)===String(id))||null;
        }
      }
      return {
        status,
        found:!!item,
        id:item?String(item.id):null,
        visibility:item?.visibility||null,
        title:item?.title||null
      };
      }catch(error){return {errorCode:/^E_UPDATE_[A-Z0-9_]+$/.test(error.message)?error.message:'E_UPDATE_TARGET_FETCH',exceptionType:error.name};}
    },{id:update.articleId,title:update.expectedCurrentTitle});
    if(result.errorCode)throw Object.assign(Error(result.errorCode),{details:{exceptionType:result.exceptionType}});
    console.log('UPDATE_TARGET_PROBE '+JSON.stringify({
      articleId:update.articleId,
      status:result.status,
      found:result.found,
      visibility:result.visibility
    }));
    if(result.status!==200) throw new Error('E_UPDATE_TARGET_PROBE');
    if(!result.found) throw new Error('E_UPDATE_TARGET_NOT_FOUND');
    if((result.title||'').trim()===update.title&&update.title!==update.expectedCurrentTitle) throw new Error('E_UPDATE_TARGET_ALREADY_CHANGED');
    if((result.title||'').trim()!==update.expectedCurrentTitle) throw new Error('E_UPDATE_CURRENT_TITLE_MISMATCH');
    return result;
  }catch(error){
    if(error?.message==='E_LOGIN_REQUIRED'||/^E_UPDATE_/.test(String(error?.message||''))) throw error;
    console.error('UPDATE_TARGET_EXCEPTION '+JSON.stringify({type:error?.name??'Error',timeout:/timeout/i.test(error?.message??''),navigation:/navigation|interrupted|closed/i.test(error?.message??'')}));
    throw new Error('E_UPDATE_TARGET_PROBE');
  }
}
let editorConnection,editorContext,tempDir,editorPage;
let stage='configuration';
try{
  if(process.env.UPDATE_ENABLED!=='true'){
    console.log('UPDATE_DISABLED');
  }else{
    assertLocalGit();
    assertCurrentSource();
    const sourceId=process.env.UPDATE_SOURCE_ID;
    if(!sourceId)throw Error('E_UPDATE_TARGET_ID_REQUIRED');
    const ledger=new UpdateLedger();
    const queue=[];
    for(const update of await loadUpdates('updates',sourceId)){
      const state=await ledger.read(update.id);
      if(eligibleUpdate(update,state)) {
        if(update.contentStandard!=='SP1') {
          assertContentStandard(update);
          assertImageReview(update);
        }
        queue.push(update);
      }
    }
    console.log('UPDATE_SELECTION '+JSON.stringify({sourceId,count:queue.length}));
    if(queue.length>1) throw new Error('E_ONE_UPDATE_PER_RUN');
    if(!queue.length){
      console.log('NO_PENDING_UPDATES');
    }else{
      const update=queue[0];
      const fingerprint=updateFingerprint(update);
      const browserConfig=await localBrowserConfig();
      editorConnection=await openEditorConnection(browserConfig);
      editorContext=editorConnection.context;
      tempDir=await mkdtemp(join(tmpdir(),'tistory-update-'));
      let page=await freshEditorPage(editorContext);
      editorPage=page;
      const viewportSession=await ensureEditorRendering(editorContext,page);
      await viewportSession.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
      await installLightweightRouting(page);
      page.setDefaultTimeout(25000);
      page.on('dialog',d=>{void (async()=>{try{if(d.type()==='confirm') await d.accept(); else await d.dismiss();}catch(error){const message=String(error?.message||error||'');if(!/No dialog is showing|Target page, context or browser has been closed|Browser has been closed/i.test(message)) console.error('E_UPDATE_DIALOG_HANDLER');}})();});

      stage='target-probe';
      await probeManagedPost(page,update);

      stage='editor-open';
      try{
        const editorUrl=new URL(page.url());
        if(editorUrl.origin!==BLOG||editorUrl.pathname!==`/manage/newpost/${update.articleId}`){
          await page.goto(`${BLOG}/manage/newpost/${update.articleId}`,{waitUntil:'domcontentloaded'});
        }
      }catch(error){
        throw Object.assign(new Error('E_UPDATE_EDITOR_OPEN_NAVIGATION'),{cause:error});
      }
      if(new URL(page.url()).origin!==BLOG) throw new Error('E_LOGIN_REQUIRED');
      await page.locator('#post-title-inp').waitFor({state:'visible',timeout:15000}).catch(()=>{
        console.log('UPDATE_EDITOR_OPEN_STATE '+JSON.stringify({articleId:update.articleId,path:new URL(page.url()).pathname}));
        throw new Error('E_UPDATE_EDITOR_OPEN_TITLE');
      });
      const currentTitle=(await page.locator('#post-title-inp').inputValue()).trim();
      if(currentTitle!==update.expectedCurrentTitle) throw new Error('E_UPDATE_CURRENT_TITLE_MISMATCH');

      stage='original-mode-menu';
      await selectEditorMode(page,'html');
      stage='original-codemirror-wait';
      const cm=page.locator('.CodeMirror:visible');
      await cm.waitFor({state:'visible',timeout:10000}).catch(error=>{throw Object.assign(Error('E_UPDATE_CODEMIRROR_WAIT'),{cause:error});});
      stage='original-codemirror-read';
      const originalHtml=await cm.evaluate(el=>el?.CodeMirror?.getValue?.()||'').catch(error=>{throw Object.assign(Error('E_UPDATE_CODEMIRROR_READ'),{cause:error});});
      if(!originalHtml.trim()) throw new Error('E_UPDATE_ORIGINAL_EMPTY');

      stage='restore-basic-select';
      await selectEditorMode(page,'basic');
      stage='restore-basic-ready';
      await page.locator('#attach-image, #attach-layer-btn').first().waitFor({state:'attached',timeout:15000});

      stage='render-update';
      const rendered=renderEditorialPost(update);
      const sources=[...new Set(imageSources(rendered))];
      const imageMap=new Map();
      for(let i=0;i<sources.length;i++){
        stage=`image-upload-${i+1}`;
        imageMap.set(sources[i],await uploadImage(page,sources[i],i,tempDir));
      }
      let targetHtml=replaceImageSources(rendered,imageMap,update.representativeImageUrl);
      if(update.contentStandard==='SP1'&&!sources.length){
        const previousImage=originalHtml.match(/\[##_Image[\s\S]*?_##\]|<img\b[^>]*>/i)?.[0];
        if(previousImage){targetHtml='<p>'+previousImage+'</p>'+targetHtml;console.log('UPDATE_IMAGE_FALLBACK: preserved-first-existing-image');}
        else console.log('UPDATE_IMAGES: 0; no-existing-image');
      }

      stage='stage-content';
      await page.locator('#post-title-inp').fill(update.title);
      await selectEditorMode(page,'html');
      const code=page.locator('.CodeMirror:visible .CodeMirror-code');
      await code.waitFor({state:'visible'});
      await code.click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.insertText(targetHtml);
      const staged=await page.locator('.CodeMirror:visible').evaluate(el=>el?.CodeMirror?.getValue?.()||'');
      assertEditorialContract(staged,update.bodyHtml,{version:editorialVersionFor(update)});

      stage='publish-dialog';
      await page.locator('#publish-layer-btn').click();
      await page.locator('.publish_editor').waitFor({state:'visible',timeout:10000}).catch(()=>{throw Error('E_UPDATE_PUBLISH_DIALOG');});
      if(update.representativeImageUrl){
      const thumb=page.locator('.publish_editor .box_thumb');
      if(await thumb.count()!==1) throw new Error('E_UPDATE_REPRESENTATIVE_UNVERIFIED');
      const deleteRepresentative=thumb.locator('button.ico_delete, button.mce-ico.ico_delete');
      if(await deleteRepresentative.count()){
        stage='representative-remove';
        await deleteRepresentative.first().evaluate(el=>el.click()).catch(()=>{throw Error('E_UPDATE_REPRESENTATIVE_REMOVE');});
        await page.waitForFunction(()=>{
          const box=document.querySelector('.publish_editor .box_thumb');
          return !!box && ((box.textContent||'').includes('대표이미지 추가') || !!box.querySelector('input[type="file"]'));
        },null,{timeout:10000});
      }
      stage='representative-upload';
      const repPath=join(tempDir,'update-representative.bin');
      await downloadImage(update.representativeImageUrl,repPath);
      const repInput=thumb.locator('input[type="file"]');
      if(await repInput.count()!==1) throw new Error('E_UPDATE_REPRESENTATIVE_UNVERIFIED');
      await repInput.setInputFiles(repPath);
      await page.waitForFunction(()=>{
        const box=document.querySelector('.publish_editor .box_thumb');
        if(!box) return false;
        const text=(box.textContent||'').trim();
        return !text.includes('대표이미지 추가');
      },null,{timeout:10000});
      if((await thumb.innerText().catch(()=>''))?.includes('대표이미지 추가')) throw new Error('E_UPDATE_REPRESENTATIVE_UNVERIFIED');

      }
      stage='submit-control';
      let submit=null;
      for(const name of ['변경사항 저장','수정','완료','공개 발행']){
        const button=page.getByRole('button',{name,exact:true}).and(page.locator('button:visible'));
        if(await button.count()){submit=button.last();break;}
      }
      if(!submit) throw new Error('E_UPDATE_SUBMIT_CONTROL');

      const sourceCommit = assertCurrentSource();

      await ledger.write(update.id,{
        phase:'submitting',fingerprint,url:update.targetUrl,articleId:update.articleId,
        sourceCommit,editorialTemplateVersion:EDITORIAL_TEMPLATE_VERSION,timestamp:new Date().toISOString()
      });

      stage='final-submit';
      await submit.click();
      console.log('SUBMIT_CLICKED: '+update.id+' '+update.targetUrl+'; public verification=user');
    }
  }
}catch(error){
  const code=/^(?:E_[A-Z0-9_]+|BLOCKED_SOURCE_DRIFT)$/.test(error?.message??'')?error.message:'E_UPDATE_RUNTIME';
  console.error('UPDATE_DIAGNOSTIC: '+stage+' '+code);
  const originalError=error?.cause??error;
  console.error('UPDATE_EXCEPTION '+JSON.stringify({details:error?.details??null,stage,type:originalError?.name??'Error',timeout:/timeout/i.test(originalError?.message??''),strictLocator:/strict mode violation/i.test(originalError?.message??''),targetClosed:/closed/i.test(originalError?.message??'')}));
  if(editorPage) {
    const snapshot=await Promise.race([editorPage.evaluate(()=>({path:location.pathname,mode:document.querySelector('#editor-mode-layer-btn-open')?.textContent?.trim(),editors:[...document.querySelectorAll('.CodeMirror')].map(el=>({visible:!!(el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'),api:typeof el.CodeMirror?.getValue==='function'}))})).catch(()=>null),new Promise(resolve=>setTimeout(()=>resolve(null),1500))]);
    console.error('UPDATE_EDITOR_STATE '+JSON.stringify(snapshot));
  }
  console.error('STOP: 기존 글 수정 결과가 불명확하면 자동 재수정하지 않습니다.');
  process.exitCode=1;
}finally{
  if(editorPage){
    try{await editorPage.unrouteAll({behavior:'ignoreErrors'});}
    catch{console.error('E_UPDATE_ROUTING_CLEANUP');process.exitCode=1;}
  }
  try{await closeEditorConnection(editorConnection);}catch{console.error('E_UPDATE_BROWSER_DISCONNECT');process.exitCode=1;}
  if(tempDir) try{await rm(tempDir,{recursive:true,force:true});}catch{console.error('E_UPDATE_TEMP_CLEANUP');process.exitCode=1;}
  const finalExitCode=process.exitCode||0;
  setTimeout(()=>process.exit(finalExitCode),0);
}
