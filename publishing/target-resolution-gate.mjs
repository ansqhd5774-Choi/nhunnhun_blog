import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {BLOG,loadPosts} from './core.mjs';
import {assertTistoryAuthenticated} from './auth-preflight.mjs';
import {localBrowserConfig,openEditorConnection,closeEditorConnection} from './local-browser.mjs';

const MAX_MANAGER_PAGES=100;
const IDENTITY_KEYS=new Set(['sourceId','operation','topic','aliases','reviewed']);

export function normalizeIdentityText(value){
  return String(value??'').normalize('NFC').toLocaleLowerCase('ko-KR').replace(/\s+/g,' ').trim();
}
function escapeRegExp(value){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
export function titleMatchesAlias(title,alias){
  const text=normalizeIdentityText(title),needle=normalizeIdentityText(alias);
  if(!text||!needle)return false;
  if(text===needle)return true;
  const pattern=escapeRegExp(needle).replace(/\s+/g,'\\s+');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${pattern}(?=$|[^\\p{L}\\p{N}])`,'iu').test(text);
}
export function validateCreateIdentity(post,identity){
  const required=post?.category==='음식'&&post?.contentStandard==='SP1'&&String(post?.id||'').startsWith('direct-');
  if(!required)return null;
  if(!identity||typeof identity!=='object'||Array.isArray(identity))throw Error('E_TARGET_IDENTITY_REQUIRED');
  if(Object.keys(identity).some(key=>!IDENTITY_KEYS.has(key)))throw Error('E_TARGET_IDENTITY_SCHEMA');
  if(identity.sourceId!==post.id||identity.operation!=='create'||identity.reviewed!==true)throw Error('E_TARGET_IDENTITY_MISMATCH');
  if(typeof identity.topic!=='string'||!identity.topic.trim()||identity.topic.length>80)throw Error('E_TARGET_IDENTITY_TOPIC');
  if(!Array.isArray(identity.aliases)||identity.aliases.length>12||identity.aliases.some(alias=>typeof alias!=='string'||!alias.trim()||alias.length>80))throw Error('E_TARGET_IDENTITY_ALIASES');
  const keys=[identity.topic,...identity.aliases].map(normalizeIdentityText);
  if(new Set(keys).size!==keys.length)throw Error('E_TARGET_IDENTITY_ALIASES');
  return identity;
}
export function existingTargetCandidates(items,post,identity){
  const expected=normalizeIdentityText(post?.title);
  const aliases=identity?[identity.topic,...identity.aliases]:[];
  const matches=[];
  for(const item of items??[]){
    const title=String(item?.title??'').trim();
    if(!title)continue;
    const exact=expected&&normalizeIdentityText(title)===expected;
    const aliasHit=aliases.some(alias=>titleMatchesAlias(title,alias));
    if(exact||aliasHit)matches.push({id:String(item?.id??''),title,visibility:item?.visibility??null,exact,aliasHit});
  }
  return matches;
}
export async function fetchManagedPosts(page,{maxPages=MAX_MANAGER_PAGES}={}){
  const result=await page.evaluate(async ({maxPages})=>{
    try{
      const out=[];
      for(let pageNo=1;pageNo<=maxPages;pageNo++){
        const params=new URLSearchParams({category:'-3',page:String(pageNo),searchKeyword:'',searchType:'title',visibility:'all'});
        const response=await fetch('/manage/posts.json?'+params.toString(),{credentials:'include',headers:{Accept:'application/json'}});
        if(response.status!==200)return {errorCode:'E_TARGET_MANAGER_HTTP',status:response.status};
        let data;try{data=await response.json();}catch{return {errorCode:'E_TARGET_MANAGER_JSON'};}
        const items=Array.isArray(data?.items)?data.items:Array.isArray(data?.data?.items)?data.data.items:null;
        if(!items)return {errorCode:'E_TARGET_MANAGER_SCHEMA'};
        if(!items.length)return {items:out};
        out.push(...items.map(item=>({id:item?.id,title:item?.title,visibility:item?.visibility??null})));
        if(pageNo===maxPages)return {errorCode:'E_TARGET_MANAGER_SCAN_LIMIT'};
      }
      return {items:out};
    }catch{return {errorCode:'E_TARGET_MANAGER_FETCH'};}
  },{maxPages});
  if(result?.errorCode)throw Error(result.errorCode);
  const byId=new Map();
  for(const item of result?.items??[]){if(item?.id!=null)byId.set(String(item.id),item);}
  return [...byId.values()];
}
async function readIdentity(root,post){
  const required=post.category==='음식'&&post.contentStandard==='SP1'&&post.id.startsWith('direct-');
  if(!required)return null;
  let identity;
  try{identity=JSON.parse(await readFile(resolve(root,'authoring','target-resolution',post.id+'.json'),'utf8'));}
  catch(error){if(error?.code==='ENOENT')throw Error('E_TARGET_IDENTITY_REQUIRED');throw Error('E_TARGET_IDENTITY_READ');}
  return validateCreateIdentity(post,identity);
}
export async function runTargetResolutionGate({root=process.cwd(),sourceId=process.env.PUBLISH_SOURCE_ID}={}){
  if(!sourceId)throw Error('E_TARGET_SOURCE_REQUIRED');
  const [post]=await loadPosts('posts',sourceId);
  const identity=await readIdentity(root,post);
  let connection,page;
  try{
    connection=await openEditorConnection(await localBrowserConfig());
    page=await connection.context.newPage();
    await page.goto(`${BLOG}/manage/posts`,{waitUntil:'domcontentloaded',timeout:30000});
    await assertTistoryAuthenticated(page);
    const items=await fetchManagedPosts(page);
    const candidates=existingTargetCandidates(items,post,identity);
    if(candidates.length){
      console.log('TARGET_RESOLUTION_CANDIDATES '+JSON.stringify({sourceId:post.id,topic:identity?.topic??null,count:candidates.length,candidates:candidates.slice(0,12)}));
      throw Error('E_TARGET_EXISTING_CANDIDATE');
    }
    console.log('TARGET_RESOLUTION_NEW_CONFIRMED '+JSON.stringify({sourceId:post.id,topic:identity?.topic??null,scanned:items.length,exactTitleChecked:true}));
  }finally{
    try{await page?.close({runBeforeUnload:false});}catch{}
    if(connection)await closeEditorConnection(connection);
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  runTargetResolutionGate().catch(error=>{console.error(/^E_[A-Z0-9_]+$/.test(error?.message)?error.message:'E_TARGET_RESOLUTION_RUNTIME');process.exitCode=1;});
}
