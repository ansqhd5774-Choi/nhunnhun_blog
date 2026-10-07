import { writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { selectNextQueueItem, assertLocalOnly, writeQueueState, queueSourceId, publicTitleFromHtml, assertProtectedDiff,archiveCompletedSources,restoreArchivedSources, QUEUE_POLICY_VERSION } from './update-queue.mjs';
import { collectEvidence } from './queue-research.mjs';
import { reusableImages, conservativeExtensions } from './queue-draft.mjs';
import { writeSimpleArticle, discoverInternalLinks, renderSimpleBody, SIMPLE_CONTENT_SPECS } from './queue-simple-writer.mjs';
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
async function commitPaths(root,item,sourceId,message,archivedIds=[],stateArticleIds=[]){
  const changed=changedPaths(root);
  assertProtectedDiff(changed,item.articleId,sourceId,archivedIds,stateArticleIds);
  if(!changed.length)return null;
  git(['config','user.name','nhunnhun-ollama'],root);
  git(['config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],root);
  git(['add','--',...changed],root);
  git(['commit','-m',message],root);
  git(['push','origin','HEAD:main'],root);
  return git(['rev-parse','HEAD'],root);
}
async function commitStateBatch(root,stateArticleIds,message){
  const unique=[...new Set(stateArticleIds.map(String))];
  if(!unique.length)return null;
  const changed=changedPaths(root);
  const allowed=new Set(unique.map(id=>`authoring/update-queue-state/${id}.json`));
  const bad=changed.filter(p=>p&&!allowed.has(p.replaceAll('\\','/')));
  if(bad.length)throw Object.assign(new Error('E_QUEUE_PROTECTED_DIFF'),{paths:bad});
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

function failureStatus(error){
  const code=String(error?.message??'E_QUEUE_FAILED');
  if(/^E_OLLAMA_(TRANSPORT|HTTP_|STREAM|STREAM_STATE_UNKNOWN|INCOMPLETE|NOT_RUNNING|MODEL_MISSING|TIMEOUT)/.test(code)||['E_QUEUE_GIT','E_QUEUE_SOURCE_DRIFT'].includes(code))return 'ERROR_SYSTEM';
  return 'SKIPPED';
}

export async function runQueueProducer({root=process.cwd(),model=process.env.OLLAMA_MODEL||'qwen3:4b',fetcher=fetch,commit=true,onOutput=null,blockedCount=0,batchStartedAt=Date.now(),batchStateIds=[],maxRuntimeMinutes=Number(process.env.QUEUE_MAX_RUNTIME_MINUTES||90)}={}){
  assertLocalOnly(process.env);
  const baseSha=git(['rev-parse','HEAD'],root);
  if(baseSha!==remoteMain(root))throw new Error('E_QUEUE_SOURCE_DRIFT');
  const selected=await selectNextQueueItem(root,{fetcher});
  if(!selected.item){
    let checkpointSha=null;
    if(commit&&batchStateIds.length&&remoteMain(root)===baseSha)checkpointSha=await commitStateBatch(root,batchStateIds,`chore(authoring): checkpoint ${batchStateIds.length} queue states`);
    console.log('QUEUE_COMPLETE '+JSON.stringify({checkpointSha,batchedStates:batchStateIds.length}));onOutput?.({complete:'true',commit_sha:checkpointSha||''});return {complete:true,checkpointSha};
  }
  const item=selected.item,sourceId=queueSourceId(item,todayInSeoul(),baseSha.slice(0,12));
  const running={
    status:'RUNNING',policyVersion:QUEUE_POLICY_VERSION,runId:process.env.GITHUB_RUN_ID??null,item,sourceId,baseSha,startedAt:new Date().toISOString(),heartbeatAt:new Date().toISOString(),
    recovered:selected.recovered===true,
    skippedCurrent:selected.skipped.map(x=>({articleId:x.articleId,sourceId:x.sourceId}))
  };
  await writeQueueState(root,item.articleId,running);
  let operationalWritten=false;
  let archivedIds=[];
  const resultDir=resolve(root,'generated-drafts/queue',process.env.GITHUB_RUN_ID??`local-${Date.now()}`);
  await mkdir(resultDir,{recursive:true});
  const metrics={policyVersion:'R5.3-simple',articleId:item.articleId,keyword:item.keyword,startedAt:new Date().toISOString(),stages:{},writerCalls:1};
  const checkpoint=async(stage,value)=>{
    const at=new Date().toISOString();
    await writeFile(resolve(resultDir,`${item.articleId}-${stage}.json`),JSON.stringify(value,null,2)+'\n');
    running.heartbeatAt=at;
    await writeQueueState(root,item.articleId,running);
    console.log('QUEUE_STAGE '+JSON.stringify({articleId:item.articleId,stage,at}));
  };
  const timed=async(name,fn)=>{
    const start=Date.now();
    try{return await fn();}finally{metrics.stages[name]=(metrics.stages[name]??0)+(Date.now()-start);}
  };
  const writeMetrics=async(result,error=null)=>{
    metrics.result=result;metrics.error=error;metrics.completedAt=new Date().toISOString();metrics.totalMs=Date.now()-Date.parse(metrics.startedAt);
    await writeFile(resolve(resultDir,`${item.articleId}-metrics.json`),JSON.stringify(metrics,null,2)+'\n');
  };
  try{
    const current=await timed('publicFetchMs',()=>fetchPublic(item,fetcher));
    const evidence=await timed('evidenceMs',()=>collectEvidence(item,current.html,{model,fetcher}));
    await checkpoint('evidence',{item,currentTitle:current.title,evidence,baseSha});

    const internalLinks=await timed('internalLinkMs',()=>discoverInternalLinks(root,item,evidence,current.html,{fetcher}));
    await checkpoint('internal-links',{internalLinks});

    const extensions=conservativeExtensions(item);
    await checkpoint('scope',{currentTitle:current.title,mode:'simple-single-pass',sections:SIMPLE_CONTENT_SPECS[item.domain],extensions});

    let [article,images]=await Promise.all([
      timed('writerMs',()=>writeSimpleArticle(item,evidence,current.title,internalLinks,{model,fetcher})),
      timed('imageLookupMs',()=>reusableImages(root,item))
    ]);
    await checkpoint('draft-final',{article,internalLinks});
    const required=[...new Set(article.sections.flatMap(section=>section.modules??[]))];
    const rendered=renderSimpleBody(article,evidence,images,internalLinks);
    const source=makeSource(item,current.title,sourceId,article,rendered.html,images);
    // Structural checks do not require an AI approval; catch assembly errors early.
    assertEditorialSource(source);
    assertImageReview(source);
    checkUpdateSource(source,`${sourceId}.json`);
    renderEditorialPost(source);
    await checkpoint('assembled',{source});
    const details=await timed('reviewDetailsMs',()=>reviewDetails(item,article,evidence,extensions,{model,fetcher}));
    await checkpoint('details',details);
    const {review,report,targetedAudit}=await timed('finalReviewMs',()=>finalizeReview(source,item,evidence,extensions,article,required,details,rendered.glossary,{model,fetcher}));
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
    await writeQueueState(root,item.articleId,{...running,status:'READY_FOR_UPDATE',policyVersion:QUEUE_POLICY_VERSION,preparedAt:new Date().toISOString(),title:source.title,fingerprint:fp,validationWarnings:report.warnings});
    if(remoteMain(root)!==baseSha)throw new Error('E_QUEUE_SOURCE_DRIFT');
    await writeMetrics('READY_FOR_UPDATE');
    const commitSha=commit?await commitPaths(root,item,sourceId,`feat(authoring): prepare queued rewrite ${item.articleId}`,archivedIds,batchStateIds):null;
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
    const status=failureStatus(error),code=/^E_[A-Z0-9_]+$/.test(error.message)?error.message:'E_QUEUE_FAILED';
    await writeQueueState(root,item.articleId,{...running,status,policyVersion:QUEUE_POLICY_VERSION,finishedAt:new Date().toISOString(),error:code,details:error.details??error.failed??null,publicMutation:false});
    await writeMetrics(status,code);
    if(commit&&remoteMain(root)===baseSha)await commitStateBatch(root,[...new Set([...batchStateIds,item.articleId])],`chore(authoring): record ${status.toLowerCase()} queue item ${item.articleId}`);
    console.log(status==='SKIPPED'?'QUEUE_ITEM_SKIPPED ':'QUEUE_SYSTEM_ERROR ',JSON.stringify({articleId:item.articleId,error:code}));
    if(status==='ERROR_SYSTEM')throw error;
    onOutput?.({complete:'false',article_id:item.articleId,source_id:'',target_url:item.targetUrl,source_title:'',commit_sha:''});
    return {skipped:true,item,error:code};
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
