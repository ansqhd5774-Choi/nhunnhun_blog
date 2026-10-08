import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { updateFingerprint } from '../publishing/update-core.mjs';
import { publicTitleFromHtml } from './update-queue.mjs';

const REPO='ansqhd5774-Choi/nhunnhun_blog';
const api=path=>`https://api.github.com/repos/${REPO}/contents/${path}`;
const headers=token=>({Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function getJsonFile(path,token){
  const response=await fetch(api(path)+'?ref=main',{headers:headers(token),signal:AbortSignal.timeout(20000)});
  if(response.status===404)return null;
  if(!response.ok)throw new Error('E_QUEUE_FINALIZE_GITHUB_READ');
  const data=await response.json();
  return {value:JSON.parse(Buffer.from(data.content,'base64').toString('utf8')),sha:data.sha};
}
async function putJsonFile(path,value,token,currentSha){
  const response=await fetch(api(path),{method:'PUT',headers:headers(token),body:JSON.stringify({
    message:`queue checkpoint: ${value.item?.articleId||value.articleId||'update'}`,
    branch:'main',content:Buffer.from(JSON.stringify(value,null,2)+'\n').toString('base64'),
    ...(currentSha?{sha:currentSha}:{})
  }),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('E_QUEUE_FINALIZE_GITHUB_WRITE');
  return response.json();
}
async function publicMatches(source){
  let response;try{response=await fetch(`${source.targetUrl}?queue_finalize=${Date.now()}`,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)});}catch{return false;}
  if(!response.ok)return false;
  return publicTitleFromHtml(await response.text())===source.title;
}
export function consumerMatches(run,commitSha) {
  return !!(run?.event==='workflow_dispatch' && run.head_sha===commitSha && run.status==='completed' && run.conclusion==='success');
}
async function consumerRun(token,commitSha) {
  const response=await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/update-posts.yml/runs?per_page=100`,{headers:headers(token),signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw Error('E_QUEUE_FINALIZE_RUN_READ');
  return (await response.json()).workflow_runs.find(run=>run.event==='workflow_dispatch' && run.head_sha===commitSha);
}
async function mutationNeverStarted(token,run) {
  if(!run||run.status!=='completed'||run.conclusion==='success')return false;
  const response=await fetch(`https://api.github.com/repos/${REPO}/actions/runs/${run.id}/jobs?per_page=100`,{headers:headers(token),signal:AbortSignal.timeout(20000)});
  if(!response.ok)return false;
  const jobs=(await response.json()).jobs;
  return Array.isArray(jobs)&&jobs.length>0&&!jobs.some(job=>(job.steps??[]).some(step=>step.name==='Run pnpm run update'&&step.status!=='queued'&&step.conclusion!=='skipped'));
}
export async function finalizeQueuedUpdate({sourceId,articleId,token,commitSha,timeoutMs=0,pollMs=15000}={}){
  if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(sourceId??'')||!/^\d+$/.test(articleId??'')||!token||!/^[a-f0-9]{40}$/.test(commitSha??''))throw new Error('E_QUEUE_FINALIZE_INPUT');
  const sourceFile=await getJsonFile(`updates/${sourceId}.json`,token);
  if(!sourceFile)throw new Error('E_QUEUE_FINALIZE_SOURCE');
  const source=sourceFile.value,expectedFingerprint=updateFingerprint(source),started=Date.now();
  if(source.articleId!==articleId || source.targetUrl!==`https://nhunnhun.tistory.com/${articleId}`) throw Error('E_QUEUE_FINALIZE_TARGET');
  let ledger=null,noMutation=false;
  do{
    ledger=(await getJsonFile(`publishing/update-state/${sourceId}.json`,token))?.value??null;
    if(ledger?.phase==='updated'&&/^[a-f0-9]{40}$/.test(ledger.sourceCommit??''))commitSha=ledger.sourceCommit;
    const run=await consumerRun(token,commitSha);
    if(ledger?.phase==='updated'&&ledger.sourceCommit===commitSha&&ledger.verification&&ledger.fingerprint===expectedFingerprint&&ledger.url===source.targetUrl&&consumerMatches(run,commitSha)&&await publicMatches(source)){
      const statePath=`authoring/update-queue-state/${articleId}.json`,previous=await getJsonFile(statePath,token);
      const value={...(previous?.value??{}),status:'DONE',articleId,sourceId,sourceCommit:commitSha,consumerRunId:run.id,fingerprint:expectedFingerprint,publicUrl:source.targetUrl,title:source.title,completedAt:new Date().toISOString(),publicVerified:true};
      await putJsonFile(statePath,value,token,previous?.sha);
      console.log('QUEUE_DONE '+JSON.stringify({articleId,sourceId,url:source.targetUrl}));
      return value;
    }
    if(ledger?.phase==='failed'&&ledger.publicMutationConfirmed===false)break;
    if(run?.status==='completed'&&run.conclusion!=='success'){noMutation=await mutationNeverStarted(token,run);break;}
    if(timeoutMs===0)return {status:'PENDING',articleId,sourceId,consumerStatus:run?.status??'not-found'};
    await sleep(pollMs);
  }while(Date.now()-started<timeoutMs);
  const statePath=`authoring/update-queue-state/${articleId}.json`,previous=await getJsonFile(statePath,token);
  const uncertain=!(noMutation||ledger?.phase==='failed'&&ledger.publicMutationConfirmed===false);
  const value={...(previous?.value??{}),status:'BLOCKED',articleId,sourceId,blockedAt:new Date().toISOString(),error:uncertain?'E_QUEUE_MUTATION_UNCERTAIN':'E_QUEUE_UPDATE_NOT_COMPLETED',ledgerPhase:ledger?.phase??null,publicMutation:uncertain?null:false};
  await putJsonFile(statePath,value,token,previous?.sha);
  throw new Error(value.error);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  finalizeQueuedUpdate({sourceId:process.env.SOURCE_ID,articleId:process.env.ARTICLE_ID,token:process.env.GITHUB_TOKEN,commitSha:process.env.SOURCE_COMMIT}).catch(error=>{console.error(error.message);process.exitCode=1;});
}
