import {articleUrl,checkMeasurements} from '../publishing/verify-updated-public.mjs';
const PATH='.github/workflows/publish-posts.yml';
export function publicationOutcome(job,{runs,ledger,postFingerprint,audit}={}){
  if(!/^[a-f0-9]{40}$/.test(job.metadata.source_sha??'')||!Array.isArray(runs)||!/^[a-f0-9]{64}$/.test(postFingerprint??''))throw new Error('E_OBSERVER_IDENTITY');
  const matching=runs.filter(r=>r.path===PATH&&r.head_sha===job.metadata.source_sha&&r.head_branch==='main'&&r.event==='push');
  if(matching.length===0)return {state:'WAITING_RUNNER',reason:'EXACT_SOURCE_RUN_NOT_FOUND'};
  if(matching.length!==1||job.metadata.workflow_run_id&&String(matching[0].id)!==String(job.metadata.workflow_run_id))return {state:'BLOCKED_RECONCILIATION',reason:'E_RUN_AMBIGUOUS'};
  const run=matching[0];if(!Number.isSafeInteger(run.id)||run.id<=0||run.run_attempt!==1)return {state:'BLOCKED_RECONCILIATION',reason:'E_RUN_ATTEMPT_REVIEW'};
  if(['queued','waiting','pending','requested'].includes(run.status))return {state:'WAITING_RUNNER',workflow_run_id:run.id};
  if(run.status==='in_progress')return {state:'RUNNING_WORKFLOW',workflow_run_id:run.id};
  if(run.status!=='completed'||run.conclusion!=='success')return {state:'BLOCKED_RECONCILIATION',reason:'E_WORKFLOW_NOT_SUCCESS',workflow_run_id:run.id};
  if(ledger?.phase!=='published'||ledger.fingerprint!==postFingerprint||ledger.editorialTemplateVersion!=='R3'||ledger.sourceCommit!==job.metadata.source_sha)return {state:'BLOCKED_RECONCILIATION',reason:'E_LEDGER_PROOF',workflow_run_id:run.id};
  let url;try{url=articleUrl(ledger.url);}catch{return {state:'BLOCKED_RECONCILIATION',reason:'E_LEDGER_URL'};}
  if(!audit)return {state:'PUBLIC_VERIFY',workflow_run_id:run.id,public_url:url};
  try{
    if(audit.desktop?.categoryVerified!==true||audit.desktop?.tagsVerified!==true||audit.desktop?.allImageSourcesMatch!==true)throw new Error('E_AUDIT_METADATA');
    if(audit.status!=='PASS'||audit.mode!=='ANONYMOUS_READ_ONLY'||audit.url!==url||audit.post_fingerprint!==postFingerprint||!Number.isFinite(Date.parse(run.created_at))||!Number.isFinite(Date.parse(audit.verified_at))||Date.parse(audit.verified_at)<Date.parse(run.created_at)||Date.parse(audit.verified_at)>Date.now()+30000||Date.now()-Date.parse(audit.verified_at)>900000||audit.desktop?.viewport!==1440||audit.mobile?.viewport!==390||audit.desktop?.representativeSourceMatch!==true||audit.desktop?.ogNative!==true)throw new Error('E_AUDIT_IDENTITY');
    checkMeasurements(audit.desktop,audit.expected);checkMeasurements(audit.mobile,audit.expected);
  }catch{return {state:'BLOCKED_RECONCILIATION',reason:'E_PUBLIC_PROOF',workflow_run_id:run.id};}
  return {state:'VERIFIED_PUBLIC_RESULT',workflow_run_id:run.id,public_url:url,source_sha:job.metadata.source_sha,post_fingerprint:postFingerprint,draft_fingerprint:job.metadata.draft_fingerprint};
}
