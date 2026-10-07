import { createHash } from 'node:crypto';
import { checkUpdateSource, updateFingerprint } from '../publishing/update-core.mjs';
import { assertContentStandard } from '../publishing/content-standards.mjs';
import { assertImageReview } from '../publishing/image-review.mjs';
import { renderEditorialPost } from '../publishing/editorial.mjs';
import { SITE_CATEGORIES } from '../publishing/standards/common.mjs';

export const requestDigest=item=>createHash('sha256').update(JSON.stringify([item.id,item.keyword,item.url,item.domain,item.category,item.revision,item.approved])).digest('hex');
export const sourceIdFor=item=>`queue-update-${item.url.split('/').at(-1)}-${requestDigest(item).slice(0,16)}`;
export const statePath=item=>`automation/update-queue-state/${item.id}.json`;
export function validateQueue(queue) {
  if(queue?.version!==1 || !Array.isArray(queue.items)) throw new Error('E_QUEUE_SCHEMA');
  const ids=new Set(),urls=new Set();
  for(const item of queue.items) {
    if(!item || Object.keys(item).some(key=>!['id','keyword','url','domain','category','revision','approved'].includes(key)) || !/^[a-z0-9][a-z0-9-]{2,60}$/.test(item.id??'') || typeof item.keyword!=='string' || !item.keyword.trim() || item.keyword.length>120 || !/^https:\/\/nhunnhun\.tistory\.com\/\d+$/.test(item.url??'') || !SITE_CATEGORIES[item.domain]?.includes(item.category) || !/^[a-z0-9-]{1,40}$/.test(item.revision??'') || typeof item.approved!=='boolean' || ids.has(item.id) || urls.has(item.url)) throw new Error('E_QUEUE_ITEM');
    ids.add(item.id);urls.add(item.url);
  }
  return queue;
}
export function validateBundle(item,bundle) {
  if(bundle?.requestDigest!==requestDigest(item)) throw new Error('E_QUEUE_REVIEW_REQUEST_MISMATCH');
  const source=bundle.source;
  if(source?.id!==sourceIdFor(item) || source.targetUrl!==item.url || source.articleId!==item.url.split('/').at(-1) || source.category!==item.category || bundle.review?.domain!==item.domain) throw new Error('E_QUEUE_SOURCE_TARGET');
  checkUpdateSource(source,`${source.id}.json`);
  assertContentStandard(source,{manifest:bundle.review});
  assertImageReview(source);
  renderEditorialPost(source);
  return bundle;
}
export function completedEvidence(item,state,ledger,run) {
  return !!(state?.requestDigest===requestDigest(item) && ledger?.phase==='updated' && ledger.fingerprint===state.fingerprint && ledger.url===item.url && ledger.sourceCommit && ledger.verification && run?.head_sha===ledger.sourceCommit && run.event==='workflow_dispatch' && run.status==='completed' && run.conclusion==='success');
}
export function chooseItem(queue,states) {
  for(const item of validateQueue(queue).items) {
    if(!item.approved) continue;
    const state=states[item.id];
    if(state?.requestDigest===requestDigest(item) && state.phase==='done') continue;
    return {item,state:state?.requestDigest===requestDigest(item)?state:null};
  }
  return null;
}
export function findPendingSources(sources,ledgers) {
  return sources.filter(source=>{
    const state=ledgers[source.id];
    return !(state?.phase==='updated' && state.fingerprint===updateFingerprint(source) && state.url===source.targetUrl);
  });
}

// Repository adapter writes checkpoints and source+review atomically. No browser mutation here.
export async function tick({queue,repo,produce,validate=validateBundle,runId,now=()=>new Date().toISOString()}) {
  if(!runId) throw new Error('E_QUEUE_RUN_ID');
  const states={};
  for(const item of validateQueue(queue).items) {
    if(!item.approved) continue;
    states[item.id]=await repo.read(statePath(item));
    if(!(states[item.id]?.requestDigest===requestDigest(item) && states[item.id].phase==='done')) break;
  }
  const selected=chooseItem(queue,states);
  if(!selected) return {status:'DONE',reason:'NO_PENDING_ITEMS'};
  const {item,state}=selected;
  if(state?.phase==='submitted' || state?.phase==='dispatching') {
    const ledger=await repo.read(`publishing/update-state/${state.sourceId}.json`);
    const runs=await repo.updateRuns();
    const submissionSha=ledger?.sourceCommit??await repo.submissionCommit?.(item);
    const run=runs.find(r=>r.head_sha===submissionSha && r.event==='workflow_dispatch');
    if(completedEvidence(item,state,ledger,run)) {
      const done={...state,phase:'done',consumerRunId:run.id,sourceCommit:ledger.sourceCommit,verification:ledger.verification,completedAt:now()};
      await repo.save(statePath(item),done);
      return {status:'DONE',itemId:item.id,url:item.url};
    }
    if(run?.status==='completed' && run.conclusion!=='success') {
      await repo.save(statePath(item),{...state,phase:'blocked',error:'E_QUEUE_CONSUMER_FAILED',consumerRunId:run.id,updatedAt:now()});
      return {status:'BLOCKED',itemId:item.id,error:'E_QUEUE_CONSUMER_FAILED'};
    }
    // Dispatch uncertainty/submitting ledgers must never lead to automatic resubmission.
    if(!run && Date.parse(now())-Date.parse(state.submittedAt)>15*60*1000) return {status:'BLOCKED',itemId:item.id,error:'E_QUEUE_DISPATCH_NOT_CONFIRMED'};
    return {status:'RUNNING',itemId:item.id,reason:'AWAITING_CONSUMER_EVIDENCE'};
  }
  const active=(await repo.updateRuns()).some(r=>r.status!=='completed');
  if(active) return {status:'RUNNING',reason:'EXISTING_UPDATE_WORKFLOW_ACTIVE'};
  const ready=await repo.read(`automation/update-queue-ready/${item.id}.json`);
  if(['blocked','producing'].includes(state?.phase) && !ready) return {status:'BLOCKED',itemId:item.id,error:state.error??'E_QUEUE_INTERRUPTED_REVIEW_REQUIRED'};
  const record={version:1,itemId:item.id,requestDigest:requestDigest(item),phase:'producing',runId,startedAt:now(),url:item.url};
  await repo.save(statePath(item),record);
  let bundle;
  try {
    const {sources,ledgers}=await repo.operationalSources();
    if(findPendingSources(sources,ledgers).length) throw new Error('E_QUEUE_OTHER_UPDATE_PENDING');
    bundle=validate(item,ready??await produce(item));
    // Only previously completed operational sources for this URL may be archived.
    const previous=sources.filter(source=>source.articleId===bundle.source.articleId);
    const submitted={...record,phase:'dispatching',sourceId:bundle.source.id,fingerprint:updateFingerprint(bundle.source),submittedAt:now()};
    await repo.submit(item,bundle,previous,submitted);
    // Explicit dispatch is necessary: commits made by GITHUB_TOKEN do not trigger push workflows.
    await repo.dispatch();
    // No additional main commit after dispatch: preserve the consumer's exact source SHA.
    return {status:'RUNNING',itemId:item.id,reason:'DISPATCHED_UPDATE_WORKFLOW'};
  } catch(error) {
    const code=/^E_[A-Z0-9_]+$/.test(error.message)?error.message:'E_QUEUE_PRODUCER_FAILED';
    // If submission/dispatch may have happened, leave its durable dispatching checkpoint untouched.
    const latest=await repo.read(statePath(item));
    if(latest?.phase==='dispatching') return {status:'BLOCKED',itemId:item.id,error:'E_QUEUE_DISPATCH_STATE_UNKNOWN'};
    await repo.save(statePath(item),{...record,phase:'blocked',error:code,updatedAt:now()});
    return {status:'BLOCKED',itemId:item.id,error:code};
  }
}
