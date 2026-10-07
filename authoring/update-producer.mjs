import { writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { selectNextQueueItem, assertLocalOnly, writeQueueState, queueSourceId, publicTitleFromHtml, assertProtectedDiff,archiveCompletedSources,restoreArchivedSources, QUEUE_POLICY_VERSION } from './update-queue.mjs';
import { collectEvidence } from './queue-research.mjs';
import { reusableImages, conservativeExtensions } from './queue-draft.mjs';
import { collectInternalLinks, writeR53Article, renderR53Body, R53_REQUIRED_MODULES } from './queue-r53.mjs';
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
  const response=await fetcher(item.targetUrl+'?producer='+Date.now(),{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new Error('E_QUEUE_PUBLIC_'+response.status);
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
  assertProtectedDiff(changed,item.articleId,sourceId,archivedIds,[]);
  if(!changed.length)return null;
  git(['config','user.name','nhunnhun-ollama'],root);
  git(['config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],root);
  git(['add','--',...changed],root);
  git(['commit','-m',message],root);
  git(['push','origin','HEAD:main'],root);
  return git(['rev-parse','HEAD'],root);
}
function failureState(error){
  const code=String(error?.message??'E_QUEUE_FAILED');
  if(/^E_OLLAMA_(TRANSPORT|HTTP_|STREAM|STREAM_STATE_UNKNOWN|INCOMPLETE|NOT_RUNNING|MODEL_MISSING|TIMEOUT)/.test(code))return 'ERROR_SYSTEM';
  if(['E_QUEUE_GIT','E_QUEUE_SOURCE_DRIFT','E_QUEUE_ACTIVE','E_QUEUE_SYSTEM_REQUIRES_REVIEW'].includes(code))return 'ERROR_SYSTEM';
  return 'SKIPPED';
}

export async function runQueueProducer({root=process.cwd(),model=process.env.OLLAMA_MODEL||'qwen3:4b',fetcher=fetch,commit=true,onOutput=null}={}){
  assertLocalOnly(process.env);
  const baseSha=git(['rev-parse','HEAD'],root);
  if(baseSha!==remoteMain(root))throw new Error('E_QUEUE_SOURCE_DRIFT');
  const selected=await selectNextQueueItem(root,{fetcher});
  if(!selected.item){
    console.log('QUEUE_COMPLETE '+JSON.stringify({policyVersion:QUEUE_POLICY_VERSION}));
    onOutput?.({complete:'true',commit_sha:''});
    return {complete:true};
  }

  const item=selected.item,sourceId=queueSourceId(item,todayInSeoul(),baseSha.slice(0,12));
  const running={
    status:'RUNNING',policyVersion:QUEUE_POLICY_VERSION,runId:process.env.GITHUB_RUN_ID??null,item,sourceId,baseSha,
    startedAt:new Date().toISOString(),heartbeatAt:new Date().toISOString(),recovered:selected.recovered===true,
    skippedCurrent:selected.skipped.map(x=>({articleId:x.articleId,sourceId:x.sourceId??null,status:x.skipStatus??x.legacyStatus??null}))
  };
  await writeQueueState(root,item.articleId,running);

  let operationalWritten=false,archivedIds=[];
  const resultDir=resolve(root,'generated-drafts/queue',process.env.GITHUB_RUN_ID??('local-'+Date.now()));
  await mkdir(resultDir,{recursive:true});
  const metrics={policyVersion:QUEUE_POLICY_VERSION,articleId:item.articleId,keyword:item.keyword,startedAt:new Date().toISOString(),stages:{},ollamaWriterCalls:0,ollamaAuditCalls:0};
  const checkpoint=async(stage,value)=>{
    const at=new Date().toISOString();
    await writeFile(resolve(resultDir,item.articleId+'-'+stage+'.json'),JSON.stringify(value,null,2)+'\n');
    running.heartbeatAt=at;await writeQueueState(root,item.articleId,running);
    console.log('QUEUE_STAGE '+JSON.stringify({articleId:item.articleId,stage,at}));
  };
  const timed=async(name,fn)=>{
    const start=Date.now();
    try{return await fn();}finally{metrics.stages[name]=(metrics.stages[name]??0)+(Date.now()-start);}
  };
  const writeMetrics=async(result,error=null)=>{
    metrics.result=result;metrics.error=error;metrics.completedAt=new Date().toISOString();metrics.totalMs=Date.now()-Date.parse(metrics.startedAt);
    await writeFile(resolve(resultDir,item.articleId+'-metrics.json'),JSON.stringify(metrics,null,2)+'\n');
  };

  try{
    const current=await timed('publicFetchMs',()=>fetchPublic(item,fetcher));
    const evidence=await timed('evidenceMs',()=>collectEvidence(item,current.html,{model,fetcher}));
    const internalLinks=await timed('internalLinkMs',()=>collectInternalLinks(root,item,current.html,evidence));
    await checkpoint('evidence',{item,currentTitle:current.title,evidence,internalLinks,baseSha});

    metrics.ollamaWriterCalls++;
    const [article,images]=await Promise.all([
      timed('writerMs',()=>writeR53Article(item,evidence,{model,fetcher,currentTitle:current.title,internalLinks})),
      timed('imageLookupMs',()=>reusableImages(root,item))
    ]);
    await checkpoint('draft',{article,internalLinks});

    const rendered=renderR53Body(article,evidence,images,internalLinks);
    const source=makeSource(item,current.title,sourceId,article,rendered.html,images);
    assertEditorialSource(source);
    assertImageReview(source);
    checkUpdateSource(source,sourceId+'.json');
    renderEditorialPost(source);

    const required=R53_REQUIRED_MODULES[item.domain]??[];
    const extensions=conservativeExtensions(item);
    const details=await reviewDetails(item,article,evidence,extensions,{model,fetcher});
    if(['medicine','disease'].includes(item.domain))metrics.ollamaAuditCalls++;
    const {review,report,targetedAudit}=await timed('reviewMs',()=>finalizeReview(source,item,evidence,extensions,article,required,details,rendered.glossary,{model,fetcher}));
    await checkpoint('reviewed',{source,review,report,targetedAudit});

    assertImageReview(source);
    checkUpdateSource(source,sourceId+'.json');
    renderEditorialPost(source);
    if(remoteMain(root)!==baseSha)throw new Error('E_QUEUE_SOURCE_DRIFT');

    archivedIds=await archiveCompletedSources(root,item);
    operationalWritten=true;
    await writeFile(resolve(root,'updates',sourceId+'.json'),JSON.stringify(source,null,2)+'\n',{flag:'wx'});
    await mkdir(resolve(root,'content-reviews','updates'),{recursive:true});
    await writeFile(resolve(root,'content-reviews','updates',sourceId+'.json'),JSON.stringify(review,null,2)+'\n',{flag:'wx'});
    const fp=updateFingerprint(source);
    await writeQueueState(root,item.articleId,{...running,status:'READY_FOR_UPDATE',policyVersion:QUEUE_POLICY_VERSION,preparedAt:new Date().toISOString(),title:source.title,fingerprint:fp,validationWarnings:report.warnings});
    if(remoteMain(root)!==baseSha)throw new Error('E_QUEUE_SOURCE_DRIFT');

    await writeMetrics('READY_FOR_UPDATE');
    const commitSha=commit?await commitPaths(root,item,sourceId,'feat(authoring): prepare R5.3 queued rewrite '+item.articleId,archivedIds):null;
    const output={complete:'false',article_id:item.articleId,source_id:sourceId,target_url:item.targetUrl,source_title:source.title,commit_sha:commitSha||''};
    onOutput?.(output);
    console.log('QUEUE_PREPARED '+JSON.stringify({item,sourceId,commitSha,title:source.title,internalLinks:internalLinks.length,writerCalls:metrics.ollamaWriterCalls,auditCalls:metrics.ollamaAuditCalls}));
    return {item,sourceId,commitSha,source,review};
  }catch(error){
    if(operationalWritten){
      await rm(resolve(root,'updates',sourceId+'.json'),{force:true});
      await rm(resolve(root,'content-reviews','updates',sourceId+'.json'),{force:true});
    }
    if(archivedIds.length)await restoreArchivedSources(root,archivedIds);
    const status=failureState(error),code=/^E_[A-Z0-9_]+$/.test(error.message)?error.message:'E_QUEUE_FAILED';
    await writeQueueState(root,item.articleId,{...running,status,policyVersion:QUEUE_POLICY_VERSION,failedAt:new Date().toISOString(),error:code,details:error.details??null,publicMutation:false});
    await writeMetrics(status,code);
    let checkpointSha=null;
    if(commit&&status==='SKIPPED'&&remoteMain(root)===baseSha)checkpointSha=await commitPaths(root,item,sourceId,'chore(authoring): skip R5.3 queue item '+item.articleId,[]);
    console.log('QUEUE_ITEM_'+status+' '+JSON.stringify({articleId:item.articleId,error:code,checkpointSha}));
    onOutput?.({complete:'false',commit_sha:checkpointSha||''});
    if(status==='ERROR_SYSTEM')throw error;
    return {skipped:true,item,error:code,checkpointSha};
  }
}

async function main(){
  const fs=await import('node:fs');
  return runQueueProducer({commit:!process.argv.includes('--no-commit'),onOutput:values=>{
    if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,Object.entries(values).map(([key,value])=>key+'='+String(value??'').replace(/\r?\n/g,' ')+'\n').join(''));
  }});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(/^E_[A-Z0-9_]+$/.test(error.message)?error.message:'E_QUEUE_FAILED');if(error.details)console.error(JSON.stringify(error.details));process.exitCode=1;});
