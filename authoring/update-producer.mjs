import { writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { selectNextQueueItem, parseUpdateQueue, assertLocalOnly, writeQueueState, queueSourceId, publicTitleFromHtml, assertProtectedDiff,archiveCompletedSources,restoreArchivedSources, QUEUE_POLICY_VERSION } from './update-queue.mjs';
import { collectEvidence, sourceMainText } from './queue-research.mjs';
import { collectSectionImages } from './queue-images.mjs';
import { applyCuratedEvidence, collectInternalLinks, renderR53Body } from './queue-r53.mjs';
import { writeSinglePassArticle, singlePassReceipt } from './queue-single-pass.mjs';
import { createStageCache, producerPolicyDigest, digest, recordAttempt } from './queue-checkpoint.mjs';

import { todayInSeoul } from '../publishing/content-standards.mjs';
import { checkUpdateSource, updateFingerprint } from '../publishing/update-core.mjs';

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
    representativeImageUrl:images[0]?.src,imageReview:images,bodyHtml:body,status:'ready',approved:true,
    category:item.category,contentStandard:'SP1'
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
function failureState(){return 'ERROR_SYSTEM';}

export async function runQueueProducer({root=process.cwd(),model=process.env.OLLAMA_MODEL||'qwen3:4b',fetcher=fetch,commit=true,onOutput=null,dryRun=false,articleId=null,cacheDir=null}={}){
  assertLocalOnly(process.env);
  const baseSha=git(['rev-parse','HEAD'],root);
  if(!dryRun&&baseSha!==remoteMain(root))throw new Error('E_QUEUE_SOURCE_DRIFT');
  const selected=dryRun?{item:parseUpdateQueue(await readFile(resolve(root,'authoring/update-queue.txt'),'utf8')).find(x=>x.articleId===articleId),skipped:[]}
    :await selectNextQueueItem(root,{fetcher,articleId});
  if(dryRun&&!selected.item)throw Error('E_QUEUE_DRY_RUN_TARGET');
  if(!selected.item){
    console.log('QUEUE_COMPLETE '+JSON.stringify({policyVersion:QUEUE_POLICY_VERSION}));
    onOutput?.({complete:'true',commit_sha:''});
    return {complete:true};
  }

  const item=selected.item,sourceId=queueSourceId(item,todayInSeoul(),baseSha.slice(0,12));
  const running={
    status:'RUNNING',policyVersion:QUEUE_POLICY_VERSION,runId:process.env.GITHUB_RUN_ID??null,item,sourceId,baseSha,
    startedAt:new Date().toISOString(),heartbeatAt:new Date().toISOString(),recovered:selected.recovered===true,
    skippedCurrent:selected.skipped.map(x=>({articleId:x.articleId,sourceId:x.sourceId??null,status:x.skipStatus??x.blockedStatus??null}))
  };
  if(!dryRun)await writeQueueState(root,item.articleId,running);

  let operationalWritten=false,archivedIds=[];
  const resultDir=resolve(root,'generated-drafts/queue',process.env.GITHUB_RUN_ID??('local-'+Date.now()));
  await mkdir(resultDir,{recursive:true});
  const metrics={attemptId:resultDir,policyVersion:QUEUE_POLICY_VERSION,articleId:item.articleId,keyword:item.keyword,startedAt:new Date().toISOString(),dryRun,stages:{},modelCalls:[],cacheHits:[],ollamaWriterCalls:0,ollamaAuditCalls:0,ollamaFormatCalls:0,ollamaRequests:0};
  const originalFetcher=fetcher;
  fetcher=(url,request)=>{
    if(String(url)==='http://127.0.0.1:11434/api/chat'&&request?.method==='POST')metrics.ollamaRequests++;
    return originalFetcher(url,request);
  };
  const policy=await producerPolicyDigest(root);
  const storage=cacheDir??resolve(process.env.LOCALAPPDATA??resolve(root,'generated-drafts'),'nhunnhun-queue-cache','stages');
  const stageCache=createStageCache(storage);
  const cached=(stage,input,action,onHit)=>stageCache(stage,{policy,item,model,input},action,onHit);
  const onCacheHit=stage=>{metrics.cacheHits.push(stage);console.log('QUEUE_CACHE_HIT '+JSON.stringify({articleId:item.articleId,stage}));};
  const onMetrics=value=>{metrics.modelCalls.push(value);if(['draft','patch'].includes(value.purpose))metrics.ollamaWriterCalls++;else if(value.purpose==='anchors')metrics.ollamaFormatCalls++;else metrics.ollamaAuditCalls++;};
  const options={model,fetcher,cached,onCacheHit,onMetrics};
  const checkpoint=async(stage,value)=>{
    const at=new Date().toISOString();
    await writeFile(resolve(resultDir,item.articleId+'-'+stage+'.json'),JSON.stringify(value,null,2)+'\n');
    running.heartbeatAt=at;if(!dryRun)await writeQueueState(root,item.articleId,running);
    console.log('QUEUE_STAGE '+JSON.stringify({articleId:item.articleId,stage,at}));
  };
  const timed=async(name,fn)=>{
    const start=Date.now();
    try{return await fn();}finally{metrics.stages[name]=(metrics.stages[name]??0)+(Date.now()-start);}
  };
  const writeMetrics=async(result,error=null)=>{
    metrics.result=result;metrics.error=error;metrics.completedAt=new Date().toISOString();metrics.totalMs=Date.now()-Date.parse(metrics.startedAt);
    metrics.cumulative=await recordAttempt(storage,item.articleId,metrics);
    await writeFile(resolve(resultDir,item.articleId+'-metrics.json'),JSON.stringify(metrics,null,2)+'\n');
  };

  try{
    try{const ps=await fetcher('http://127.0.0.1:11434/api/ps',{signal:AbortSignal.timeout(5000)}).then(r=>r.json());
      metrics.modelPlacement=(ps.models??[]).filter(m=>m.name===model).map(({name,size,size_vram,context_length})=>({name,size,size_vram,context_length}));
    }catch{metrics.modelPlacement=null;}
    const current=await timed('publicFetchMs',()=>fetchPublic(item,fetcher));
    let evidence=await timed('evidenceMs',()=>cached('evidence',{publicHash:digest(sourceMainText(current.html,{article:true})),day:todayInSeoul()},()=>collectEvidence(item,current.html,{model,fetcher,advisory:true}),onCacheHit));
    evidence=await timed('curatedEvidenceMs',()=>applyCuratedEvidence(root,item,evidence,options));
    const internalLinks=await timed('internalLinkMs',()=>collectInternalLinks(root,item,current.html,evidence));
    await checkpoint('evidence',{item,currentTitle:current.title,evidence,internalLinks,baseSha});

    const article=await timed('writerMs',()=>writeSinglePassArticle(item,evidence,options));
    const images=await timed('imageSearchMs',()=>collectSectionImages(item,article,{subject:evidence.query||item.keyword,model,fetcher}));
    console.log('QUEUE_IMAGES '+JSON.stringify({articleId:item.articleId,count:images.length}));
    try{const ps=await fetcher('http://127.0.0.1:11434/api/ps',{signal:AbortSignal.timeout(5000)}).then(r=>r.json());
      metrics.modelPlacementAfterWriter=(ps.models??[]).filter(m=>m.name===model).map(({name,size,size_vram,context_length})=>({name,size,size_vram,context_length}));
    }catch{metrics.modelPlacementAfterWriter=null;}
    await checkpoint('draft',{article,internalLinks});

    let rendered=renderR53Body(article,evidence,images,internalLinks);
    let source=makeSource(item,current.title,sourceId,article,rendered.html,images);
    checkUpdateSource(source,sourceId+'.json');

    const review=singlePassReceipt(source,item,evidence);
    await checkpoint('generated',{source,review});

    checkUpdateSource(source,sourceId+'.json');
    if(dryRun){
      await writeMetrics('DRY_RUN_GENERATED');
      console.log('QUEUE_DRY_RUN_GENERATED '+JSON.stringify({articleId:item.articleId,resultDir,publicMutation:false,contentValidation:'not-performed'}));
      return {dryRun:true,source,review,resultDir,metrics};
    }
    if(remoteMain(root)!==baseSha)throw new Error('E_QUEUE_SOURCE_DRIFT');

    archivedIds=await archiveCompletedSources(root,item);
    operationalWritten=true;
    await writeFile(resolve(root,'updates',sourceId+'.json'),JSON.stringify(source,null,2)+'\n',{flag:'wx'});
    await mkdir(resolve(root,'content-reviews','updates'),{recursive:true});
    await writeFile(resolve(root,'content-reviews','updates',sourceId+'.json'),JSON.stringify(review,null,2)+'\n',{flag:'wx'});
    const fp=updateFingerprint(source);
    await writeQueueState(root,item.articleId,{...running,status:'READY_FOR_UPDATE',policyVersion:QUEUE_POLICY_VERSION,preparedAt:new Date().toISOString(),title:source.title,fingerprint:fp,contentValidation:'not-performed'});
    if(remoteMain(root)!==baseSha)throw new Error('E_QUEUE_SOURCE_DRIFT');

    await writeMetrics('READY_FOR_UPDATE');
    const commitSha=commit?await commitPaths(root,item,sourceId,'feat(authoring): prepare R5.5 queued rewrite '+item.articleId,archivedIds):null;
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
    if(!dryRun)await writeQueueState(root,item.articleId,{...running,status,policyVersion:QUEUE_POLICY_VERSION,failedAt:new Date().toISOString(),error:code,details:error.details??null,publicMutation:false});
    await writeMetrics(status,code);
    let checkpointSha=null;
    if(!dryRun&&commit&&status==='SKIPPED'&&remoteMain(root)===baseSha)checkpointSha=await commitPaths(root,item,sourceId,'chore(authoring): skip queue item '+item.articleId,[]);
    console.log('QUEUE_ITEM_'+status+' '+JSON.stringify({articleId:item.articleId,error:code,checkpointSha}));
    onOutput?.({complete:'false',commit_sha:checkpointSha||''});
    if(dryRun||status==='ERROR_SYSTEM')throw error;
    return {skipped:true,item,error:code,checkpointSha};
  }
}

async function main(){
  const fs=await import('node:fs');
  return runQueueProducer({dryRun:process.argv.includes('--dry-run')||process.env.QUEUE_DRY_RUN==='true',articleId:process.argv.find(x=>x.startsWith('--article='))?.split('=')[1]??process.env.QUEUE_ARTICLE_ID,commit:!process.argv.includes('--no-commit'),onOutput:values=>{
    if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,Object.entries(values).map(([key,value])=>key+'='+String(value??'').replace(/\r?\n/g,' ')+'\n').join(''));
  }});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(/^E_[A-Z0-9_]+$/.test(error.message)?error.message:'E_QUEUE_FAILED');if(error.details)console.error(JSON.stringify(error.details));process.exitCode=1;});
