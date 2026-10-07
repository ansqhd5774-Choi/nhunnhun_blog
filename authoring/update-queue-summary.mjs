import { readFile, readdir, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseUpdateQueue, QUEUE_POLICY_VERSION } from './update-queue.mjs';

async function readJson(path){
  try{return JSON.parse(await readFile(path,'utf8'));}catch(error){if(error?.code==='ENOENT')return null;throw error;}
}
export async function buildQueueSummary(root=process.cwd()){
  const items=parseUpdateQueue(await readFile(resolve(root,'authoring/update-queue.txt'),'utf8'));
  const states=new Map();
  try{
    for(const name of await readdir(resolve(root,'authoring/update-queue-state'))){
      if(!name.endsWith('.json'))continue;
      const state=await readJson(resolve(root,'authoring/update-queue-state',name));
      if(state)states.set(name.replace(/\.json$/,''),state);
    }
  }catch(error){if(error?.code!=='ENOENT')throw error;}
  const counts={DONE:0,READY_FOR_UPDATE:0,RUNNING:0,BLOCKED:0,RETRYABLE_LEGACY:0,PENDING:0};
  const failed=[];
  for(const item of items){
    const state=states.get(item.articleId);
    if(!state){counts.PENDING++;continue;}
    if(state.status==='DONE'){counts.DONE++;continue;}
    if(state.status==='READY_FOR_UPDATE'){counts.READY_FOR_UPDATE++;continue;}
    if(state.status==='RUNNING'){counts.RUNNING++;continue;}
    if(String(state.status??'').startsWith('BLOCKED')){
      if(state.error==='E_QUEUE_PLAN_VALIDATION'&&state.policyVersion!==QUEUE_POLICY_VERSION)counts.RETRYABLE_LEGACY++;
      else counts.BLOCKED++;
      failed.push({articleId:item.articleId,keyword:item.keyword,status:state.status,error:state.error??null,policyVersion:state.policyVersion??null});
      continue;
    }
    counts.PENDING++;
  }
  return {policyVersion:QUEUE_POLICY_VERSION,total:items.length,counts,remaining:items.length-counts.DONE-counts.BLOCKED,failed};
}
export function summaryMarkdown(summary){
  const c=summary.counts;
  const lines=[
    `## NHUNNHUN Queue — ${summary.policyVersion}`,
    '',
    '| 항목 | 수 |',
    '|---|---:|',
    `| 전체 | ${summary.total} |`,
    `| DONE | ${c.DONE} |`,
    `| READY | ${c.READY_FOR_UPDATE} |`,
    `| RUNNING | ${c.RUNNING} |`,
    `| BLOCKED | ${c.BLOCKED} |`,
    `| 구버전 재시도 대상 | ${c.RETRYABLE_LEGACY} |`,
    `| 미시작/대기 | ${c.PENDING} |`,
    `| 남은 미완료 | ${summary.remaining} |`,
  ];
  if(summary.failed.length){
    lines.push('','### 실패/재시도 항목','', '| 글 | 상태 | 오류 |','|---|---|---|');
    for(const x of summary.failed.slice(0,30))lines.push(`| ${x.keyword} / ${x.articleId} | ${x.status} | ${x.error??''} |`);
    if(summary.failed.length>30)lines.push(`| … | … | 외 ${summary.failed.length-30}건 |`);
  }
  return lines.join('\n')+'\n';
}
async function main(){
  const summary=await buildQueueSummary();
  const markdown=summaryMarkdown(summary);
  console.log(markdown);
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,markdown);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
