import { readFile, readdir, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { updateFingerprint } from '../publishing/update-core.mjs';
import { contentDigest } from '../publishing/content-standards.mjs';

const BLOG='https://nhunnhun.tistory.com';
const DOMAIN_BY_CATEGORY=Object.freeze({'음식':'food','영양소':'nutrient','약':'medicine','질병':'disease'});
const STATE_DIR='authoring/update-queue-state';

export function parseUpdateQueue(text){
  const rows=String(text).replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));
  const out=[],seen=new Set();
  for(let i=0;i<rows.length;i++){
    const m=rows[i].match(/^(음식|영양소|약|질병)\s+-\s+(.+?)\s+-\s+(https:\/\/nhunnhun\.tistory\.com\/(\d+))$/u);
    if(!m) throw new Error(`E_QUEUE_ROW_${i+1}`);
    const [,category,keyword,targetUrl,articleId]=m;
    if(seen.has(articleId)) throw new Error('E_QUEUE_DUPLICATE_ARTICLE');
    seen.add(articleId);
    out.push({id:`q-${articleId}`,order:i+1,domain:DOMAIN_BY_CATEGORY[category],category,keyword,articleId,targetUrl});
  }
  if(!out.length) throw new Error('E_QUEUE_EMPTY');
  return out;
}

export function assertLocalOnly(env=process.env){
  for(const key of ['OPENAI_API_KEY','ANTHROPIC_API_KEY','GEMINI_API_KEY','GOOGLE_API_KEY']) if(String(env[key]??'').trim()) throw new Error('E_QUEUE_EXTERNAL_AI_KEY');
  const host=String(env.OLLAMA_HOST??'').trim();
  if(host && !/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/?$/i.test(host)) throw new Error('E_QUEUE_OLLAMA_NOT_LOCAL');
  return true;
}

const statePath=(root,articleId)=>resolve(root,STATE_DIR,`${articleId}.json`);
export async function readQueueState(root,articleId){
  try{return JSON.parse(await readFile(statePath(root,articleId),'utf8'));}catch(error){if(error?.code==='ENOENT') return null;throw error;}
}
export async function writeQueueState(root,articleId,state){
  await mkdir(resolve(root,STATE_DIR),{recursive:true});
  await writeFile(statePath(root,articleId),JSON.stringify(state,null,2)+'\n');
  return state;
}

function decodeHtml(value=''){
  return value.replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
}
export function publicTitleFromHtml(html){
  const og=String(html).match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) || String(html).match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if(og) return decodeHtml(og[1]).trim();
  const title=String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title?decodeHtml(title[1].replace(/<[^>]+>/g,'').trim()).replace(/\s*[-|｜]\s*건강\s*식품\s*$/u,'').trim():'';
}

async function jsonIfExists(path){
  try{return JSON.parse(await readFile(path,'utf8'));}catch(error){if(error?.code==='ENOENT')return null;throw error;}
}

export async function currentR1Candidates(root,item){
  const updatesDir=resolve(root,'updates');
  const files=(await readdir(updatesDir)).filter(n=>n.endsWith('.json')).sort();
  const out=[];
  for(const file of files){
    let source;try{source=JSON.parse(await readFile(resolve(updatesDir,file),'utf8'));}catch{continue;}
    if(source.articleId!==item.articleId||source.targetUrl!==item.targetUrl||source.contentStandard!=='R1'||source.status!=='ready'||source.approved!==true) continue;
    const review=await jsonIfExists(resolve(root,'content-reviews','updates',`${source.id}.json`));
    const state=await jsonIfExists(resolve(root,'publishing','update-state',`${source.id}.json`));
    if(!review||review.sourceDigest!==contentDigest(source)||state?.phase!=='updated'||state.url!==item.targetUrl||state.fingerprint!==updateFingerprint(source)) continue;
    out.push({source,review,state});
  }
  return out;
}

export async function isAlreadyCurrent(root,item,{fetcher=fetch}={}){
  const candidates=await currentR1Candidates(root,item);
  for(const candidate of candidates){
    let response;try{response=await fetcher(`${item.targetUrl}?queue_check=${Date.now()}`,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)});}catch{continue;}
    if(!response?.ok) continue;
    const title=publicTitleFromHtml(await response.text());
    if(title===candidate.source.title) return {current:true,sourceId:candidate.source.id,title};
  }
  return {current:false};
}

export async function selectNextQueueItem(root=process.cwd(),{fetcher=fetch}={}){
  const items=parseUpdateQueue(await readFile(resolve(root,'authoring/update-queue.txt'),'utf8'));
  const skipped=[];
  for(const item of items){
    const qstate=await readQueueState(root,item.articleId);
    if(qstate?.status==='RUNNING'||qstate?.status==='BLOCKED_SYSTEM') throw Object.assign(new Error('E_QUEUE_BLOCKED_REQUIRES_REVIEW'),{queueState:qstate,item});
    if(qstate?.status==='READY_FOR_UPDATE') throw Object.assign(new Error('E_QUEUE_AWAITING_UPDATE_EVIDENCE'),{queueState:qstate,item});
    if(['BLOCKED','BLOCKED_CONTENT','BLOCKED_GENERATION','BLOCKED_EVIDENCE','BLOCKED_IMAGE','BLOCKED_ENTITY','BLOCKED_REVIEW'].includes(qstate?.status)){skipped.push({...item,blockedStatus:qstate.status,error:qstate.error});continue;}
    const current=await isAlreadyCurrent(root,item,{fetcher});
    if(current.current){skipped.push({...item,sourceId:current.sourceId});continue;}
    if(qstate?.status==='DONE') throw Object.assign(new Error('E_QUEUE_DONE_DRIFT'),{queueState:qstate,item});
    return {item,skipped};
  }
  return {item:null,skipped,complete:true};
}

export function assertProtectedDiff(paths,articleId,sourceId,archivedIds=[]){
  const allowed=new Set([
    `updates/${sourceId}.json`,
    `content-reviews/updates/${sourceId}.json`,
    `${STATE_DIR}/${articleId}.json`,
  ]);
  for(const id of archivedIds) {
    if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(id)) throw Error('E_QUEUE_ARCHIVE_ID');
    for(const path of [`updates/${id}.json`,`content-reviews/updates/${id}.json`,`authoring/update-source-archive/${id}.json`,`authoring/update-review-archive/${id}.json`]) allowed.add(path);
  }
  const bad=paths.filter(p=>p&&!allowed.has(p.replaceAll('\\','/')));
  if(bad.length) throw Object.assign(new Error('E_QUEUE_PROTECTED_DIFF'),{paths:bad});
  return true;
}

export async function archiveCompletedSources(root,item) {
  const matches=[];
  for(const name of (await readdir(resolve(root,'updates'))).filter(name=>name.endsWith('.json'))) {
    const source=JSON.parse(await readFile(resolve(root,'updates',name),'utf8'));
    if(source.articleId!==item.articleId) continue;
    const ledger=await jsonIfExists(resolve(root,'publishing/update-state',`${source.id}.json`));
    if(source.targetUrl!==item.targetUrl || ledger?.phase!=='updated' || ledger.url!==item.targetUrl || ledger.fingerprint!==updateFingerprint(source)) throw Error('E_QUEUE_EXISTING_UPDATE_PENDING');
    for(const kind of ['source','review']) {
      if(await jsonIfExists(resolve(root,`authoring/update-${kind}-archive`,`${source.id}.json`))) throw Error('E_QUEUE_ARCHIVE_EXISTS');
    }
    matches.push(source.id);
  }
  const moved=[];
  try {for(const id of matches) {
    await mkdir(resolve(root,'authoring/update-source-archive'),{recursive:true});
    await rename(resolve(root,'updates',`${id}.json`),resolve(root,'authoring/update-source-archive',`${id}.json`));
    moved.push(id);
    if(await jsonIfExists(resolve(root,'content-reviews/updates',`${id}.json`))) {
      await mkdir(resolve(root,'authoring/update-review-archive'),{recursive:true});
      await rename(resolve(root,'content-reviews/updates',`${id}.json`),resolve(root,'authoring/update-review-archive',`${id}.json`));
    }
  }} catch(error) {await restoreArchivedSources(root,moved);throw error;}
  return matches;
}
export async function restoreArchivedSources(root,ids) {
  for(const id of ids) {
    await rename(resolve(root,'authoring/update-source-archive',`${id}.json`),resolve(root,'updates',`${id}.json`));
    if(await jsonIfExists(resolve(root,'authoring/update-review-archive',`${id}.json`))) await rename(resolve(root,'authoring/update-review-archive',`${id}.json`),resolve(root,'content-reviews/updates',`${id}.json`));
  }
}

export function queueSourceId(item,date,seed=''){
  const day=String(date).replaceAll('-','');
  let hash=0;for(const ch of `${item.articleId}:${item.keyword}:${seed}`) hash=(hash*33+ch.codePointAt(0))>>>0;
  return `auto-${item.articleId}-r1-${day}-${hash.toString(16).padStart(8,'0').slice(0,8)}`;
}

export async function cli(args=process.argv.slice(2),env=process.env){
  const root=process.cwd();
  if(args[0]==='assert-local-only'){assertLocalOnly(env);console.log('QUEUE_LOCAL_ONLY_PASS');return;}
  if(args[0]==='select'){
    const result=await selectNextQueueItem(root);
    console.log('QUEUE_SELECT '+JSON.stringify(result));return;
  }
  throw new Error('E_QUEUE_CLI');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) cli().catch(error=>{console.error(error.message);process.exitCode=1;});
