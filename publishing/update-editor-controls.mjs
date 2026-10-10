import {BLOG} from './core.mjs';

export async function selectEditorMode(page,mode){
  const selector=mode==='html'
    ? '#editor-mode-html:visible, #editor-mode-html-text:visible, #editor-mode-html-tistory:visible'
    : '#editor-mode-kakao:visible, #editor-mode-kakao-text:visible, #editor-mode-kakao-tistory:visible';
  const visibleEditors=await page.locator('.CodeMirror:visible').count();
  if(mode==='html'&&visibleEditors)return;
  if(mode==='basic'&&!visibleEditors)return;
  const option=page.locator(selector).first();
  const diagnostic=async()=>{
    const snapshot=await page.evaluate(()=>{
      const ids=['editor-mode-layer-btn-open','editor-mode-html','editor-mode-html-text','editor-mode-html-tistory','editor-mode-kakao','editor-mode-kakao-text','editor-mode-kakao-tistory'];
      return {path:location.pathname,controls:ids.map(id=>{
        const el=document.getElementById(id);
        return {id,found:!!el,visible:!!el?.getClientRects().length};
      }),codeMirror:document.querySelectorAll('.CodeMirror').length};
    }).catch(()=>({path:'unavailable'}));
    console.log('UPDATE_MODE_DOM '+JSON.stringify({mode,...snapshot}));
  };
  if(!await option.isVisible()){
    // The publishing path uses this stable ID; the former .mce-txt selector
    // can miss a mode menu even when the correct button is available.
    const menu=page.locator('#editor-mode-layer-btn-open:visible').first();
    const menuReady=await menu.waitFor({state:'visible',timeout:10000}).then(()=>true,()=>false);
    if(!menuReady){
      await diagnostic();
      if(mode==='basic'){
        // DOM evidence: the basic-mode control exists but its toolbar is hidden
        // after HTML inspection. Invoke only the known mode control, and require
        // CodeMirror to disappear before continuing to any image operation.
        const used=await page.evaluate(()=>{
          const control=document.getElementById('editor-mode-kakao');
          if(!control)return false;
          control.click();
          return true;
        }).catch(()=>false);
        if(used){
          await page.waitForFunction(()=>
            [...document.querySelectorAll('.CodeMirror')].every(el=>
              !el.getClientRects().length||getComputedStyle(el).visibility==='hidden'
            ),null,{timeout:10000,polling:100}).catch(error=>{
              throw Object.assign(Error('E_UPDATE_EDITOR_MODE_TRANSITION'),{cause:error});
            });
          console.log('UPDATE_BASIC_MODE_DOM_TRANSITION_VERIFIED');
          return;
        }
      }
      throw Error('E_UPDATE_EDITOR_MODE_MENU');
    }
    await menu.click({timeout:10000}).catch(async error=>{
      await diagnostic();
      throw Object.assign(Error('E_UPDATE_EDITOR_MODE_MENU'),{cause:error});
    });
  }
  await option.waitFor({state:'visible',timeout:10000}).catch(async error=>{
    await diagnostic();
    throw Object.assign(Error('E_UPDATE_EDITOR_MODE_OPTION'),{cause:error});
  });
  await option.click({timeout:10000}).catch(error=>{throw Object.assign(Error('E_UPDATE_EDITOR_MODE_CLICK'),{cause:error});});
  await page.waitForFunction(expected=>{
    const visibleEditors=[...document.querySelectorAll('.CodeMirror')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
    return expected==='html'?visibleEditors.some(el=>typeof el.CodeMirror?.getValue==='function'):visibleEditors.length===0;
  },mode,{timeout:10000,polling:100}).catch(error=>{throw Object.assign(Error('E_UPDATE_EDITOR_MODE_TRANSITION'),{cause:error});});
}

export async function probeManagedPost(page,update){
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
