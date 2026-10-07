import { writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { selectNextQueueItem, assertLocalOnly, writeQueueState, queueSourceId, publicTitleFromHtml, assertProtectedDiff,archiveCompletedSources,restoreArchivedSources } from './update-queue.mjs';
import { collectEvidence } from './queue-research.mjs';
import { draftArticle, reusableImages, renderBody, conservativeExtensions } from './queue-draft.mjs';
import { reviewDetails, finalizeReview } from './queue-review.mjs';
import { todayInSeoul } from '../publishing/content-standards.mjs';
import { assertImageReview } from '../publishing/image-review.mjs';
import { checkUpdateSource, updateFingerprint } from '../publishing/update-core.mjs';
import { assertEditorialSource, renderEditorialPost } from '../publishing/editorial.mjs';

function git(args,root,{allowFailure=false,trimOutput=true}={}){
  const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});
  if(r.status!==0&&!allowFailure)throw Object.assign(new Error('E_QUEUE_GIT'),{args,stderr:r.stderr,stdout:r.stdout});
  return trimOutput?(r.stdout||'').trim():(r.stdout||'');
}
function remoteMain(root){return (git(['ls-remote','origin','refs/heads/main'],root).split(/\s+/)[0]||'').trim();}
async function fetchPublic(item,fetcher){
  const response=await fetcher(`${item.targetUrl}?producer=${Date.now()}`,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new Error(`E_QUEUE_PUBLIC_${response.status}`);
  const html=await response.text(),title=publicTitleFromHtml(html);
  if(!title)throw new Error('E_QUEUE_PUBLIC_TITLE');
  return {html,title};
}
function makeSource(item,currentTitle,sourceId,article,body,images){
  return {
    id:sourceId,articleId:item.articleId,targetUrl:item.targetUrl,expectedCurrentTitle:currentTitle,title:article.title,
    representativeImageUrl:images[0].src,imageReview:images,bodyHtml:body,status:'ready',approved:true,
    category:item.category,contentStandard:'R1'
  };
}
export function changedPaths(root){
  return git(['status','--porcelain','--untracked-files=all'],root,{trimOutput:false}).split(/\r?\n/).filter(Boolean).map(line=>line.slice(3).trim()).filter(Boolean);
}
async function commitPaths(root,item,sourceId,message,archivedIds=[]){
  const changed=changedPaths(root);
  assertProtectedDiff(changed,item.articleId,sourceId,archivedIds);
  if(!changed.length)return null;
  git(['config','user.name','nhunnhun-ollama'],root);
  git(['config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],root);
  git(['add','--',...changed],root);
  git(['commit','-m',message],root);
  git(['push','origin','HEAD:main'],root);
  return git(['rev-parse','HEAD'],root);
}
function writeOutput(values){
  if(!process.env.GITHUB_OUTPUT)return;
  const fs=requireNodeFs();
  fs.appendFileSync(process.env.GITHUB_OUTPUT,Object.entries(values).map(([key,value])=>`${key}=${String(value??'').replace(/\r?\n/g,' ')}\n`).join(''));
}
function requireNodeFs(){throw new Error('E_QUEUE_INTERNAL_OUTPUT');}

function blockStatus(error){
  const code=String(error?.message??'E_QUEUE_FAILED');
  if(code==='E_OLLAMA_LENGTH_LIMIT')return 'BLOCKED_GENERATION';
  if(/^E_OLLAMA_(TRANSPORT|HTTP_|STREAM|STREAM_STATE_UNKNOWN|INCOMPLETE|NOT_RUNNING|MODEL_MISSING)/.test(code)||['E_QUEUE_GIT','E_QUEUE_SOURCE_DRIFT'].includes(code))return 'BLOCKED_SYSTEM';
  if(/IMAGE_REVIEW/.test(code))return 'BLOCKED_IMAGE';
  if(/RESEARCH|AUTHORIZATION|PRIMARY_SOURCE|HEALTH_EVIDENCE/.test(code))return 'BLOCKED_EVIDENCE';
  if(/IDENTITY|ENGLISH_QUERY|CLASSIFICATION/.test(code))return 'BLOCKED_ENTITY';
  if(/REVIEW|CONTENT_/.test(code))return 'BLOCKED_REVIEW';
  return 'BLOCKED_CONTENT';
}
function itemLevelBlock(status){return status!=='BLOCKED_SYSTEM';}

export async function runQueueProducer({root=process.cwd(),model=process.env.OLLAMA_MODEL||'qwen3:4b',fetcher=fetch,commit=true,onOutput=null,blockedCount=0,maxBlockedPerRun=Number(process.env.QUEUE_MAX_BLOCKED_PER_RUN||3)}={}){
  assertLocalOnly(process.env);
  const baseSha=git(['rev-parse','HEAD'],root);
  if(baseSha!==remoteMain(root))throw new Error('E_QUEUE_SOURCE_DRIFT');
  const selected=await selectNextQueueItem(root,{fetcher});
  if(!selected.item){console.log('QUEUE_COMPLETE');onOutput?.({complete:'true'});return {complete:true};}
  const item=selected.item,sourceId=queueSourceId(item,todayInSeoul(),baseSha.slice(0,12));
  const running={
    status:'RUNNING',item,sourceId,baseSha,startedAt:new Date().toISOString(),
    skippedCurrent:selected.skipped.map(x=>({articleId:x.articleId,sourceId:x.sourceId}))
  };
  await writeQueueState(root,item.articleId,running);
  let operationalWritten=false;
  let archivedIds=[];
  const resultDir=resolve(root,'generated-drafts/queue',process.env.GITHUB_RUN_ID??`local-${Date.now()}`);
  await mkdir(resultDir,{recursive:true});
  const checkpoint=async(stage,value)=>{
    await writeFile(resolve(resultDir,`${item.articleId}-${stage}.json`),JSON.stringify(value,null,2)+'\n');
    console.log('QUEUE_STAGE '+JSON.stringify({articleId:item.articleId,stage,at:new Date().toISOString()}));
  };
  try{
    const current=await fetchPublic(item,fetcher);
    const evidence=await collectEvidence(item,current.html,{model,fetcher});
    await checkpoint('evidence',{item,currentTitle:current.title,evidence,baseSha});
    const extensions=conservativeExtensions(item);
    await checkpoint('scope',{currentTitle:current.title,extensions});
    const {article,required,lengthReport}=await draftArticle(item,evidence,extensions,{model,fetcher,currentTitle:current.title});
    await checkpoint('draft',{article,required});
    await checkpoint('length-report',lengthReport);
    const images=await reusableImages(root,item);
    const rendered=renderBody(article,evidence,images);
    const source=makeSource(item,current.title,sourceId,article,rendered.html,images);
    // Structural checks do not require an AI approval; catch assembly errors early.
    assertEditorialSource(source);
    assertImageReview(source);
    checkUpdateSource(source,`${sourceId}.json`);
    renderEditorialPost(source);
    await checkpoint('assembled',{source});
    const details=await reviewDetails(item,article,evidence,extensions,{model,fetcher});
    await checkpoint('details',details);
    const {review,report,targetedAudit}=await finalizeReview(source,item,evidence,extensions,article,required,details,rendered.glossary,{model,fetcher});
    await checkpoint('reviewed',{source,review,report,targetedAudit});
    assertImageReview(source);
    checkUpdateSource(source,`${sourceId}.json`);
    renderEditorialPost(source);
    if(remoteMain(root)!==baseSha)throw new Error('E_QUEUE_SOURCE_DRIFT');
    archivedIds=await archiveCompletedSources(root,item);
    operationalWritten=true;
    await writeFile(resolve(root,'updates',`${sourceId}.json`),JSON.stringify(source,null,2)+'\n',{flag:'wx'});
    await mkdir(resolve(root,'content-reviews','updates'),{recursive:true});
    await writeFile(resolve(root,'content-reviews','updates',`${sourceId}.json`),JSON.stringify(review,null,2)+'\n',{flag:'wx'});
    const fp=updateFingerprint(source);
    await writeQueueState(root,item.articleId,{...running,status:'READY_FOR_UPDATE',preparedAt:new Date().toISOString(),title:source.title,fingerprint:fp,validationWarnings:report.warnings});
    if(remoteMain(root)!==baseSha)throw new Error('E_QUEUE_SOURCE_DRIFT');
    const commitSha=commit?await commitPaths(root,item,sourceId,`feat(authoring): prepare queued rewrite ${item.articleId}`,archivedIds):null;
    const output={complete:'false',article_id:item.articleId,source_id:sourceId,target_url:item.targetUrl,source_title:source.title,commit_sha:commitSha||''};
    onOutput?.(output);
    console.log('QUEUE_PREPARED '+JSON.stringify({item,sourceId,commitSha,title:source.title}));
    return {item,sourceId,commitSha,source,review};
  }catch(error){
    if(operationalWritten){
      await rm(resolve(root,'updates',`${sourceId}.json`),{force:true});
      await rm(resolve(root,'content-reviews','updates',`${sourceId}.json`),{force:true});
    }
    if(archivedIds.length) await restoreArchivedSources(root,archivedIds);
    const status=blockStatus(error),code=/^E_[A-Z0-9_]+$/.test(error.message)?error.message:'E_QUEUE_FAILED';
    await writeQueueState(root,item.articleId,{...running,status,blockedAt:new Date().toISOString(),error:code,details:error.details??error.failed??null,publicMutation:false});
    if(commit&&remoteMain(root)===baseSha)await commitPaths(root,item,sourceId,`chore(authoring): block queued rewrite ${item.articleId}`);
    if(itemLevelBlock(status)){
      console.log('QUEUE_ITEM_BLOCKED_CONTINUE '+JSON.stringify({articleId:item.articleId,status,error:code,blockedCount:blockedCount+1}));
      if(blockedCount+1<maxBlockedPerRun)return runQueueProducer({root,model,fetcher,commit,onOutput,blockedCount:blockedCount+1,maxBlockedPerRun});
      console.log('QUEUE_BATCH_BLOCK_LIMIT '+JSON.stringify({maxBlockedPerRun}));
      onOutput?.({complete:'false'});
      return {blocked:true,item,status,error:code};
    }
    throw error;
  }
}

async function main(){
  const fs=await import('node:fs');
  const result=await runQueueProducer({commit:!process.argv.includes('--no-commit'),onOutput:values=>{
    if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,Object.entries(values).map(([key,value])=>`${key}=${String(value??'').replace(/\r?\n/g,' ')}\n`).join(''));
  }});
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(/^E_[A-Z0-9_]+$/.test(error.message)?error.message:'E_QUEUE_FAILED');if(error.details)console.error(JSON.stringify(error.details));process.exitCode=1;});
