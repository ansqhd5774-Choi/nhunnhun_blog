import {createHash} from 'node:crypto';
import {FOOD_CATALOG} from './discovery.mjs';
// Policy is owned by trusted program configuration. No model output can change it.
export const APPROVED_SCOPE='일반 식재료 글부터 자동 발행';
const medical=/질병|치료|예방|효능|복용|약물|의약|알레르기|당뇨|혈당|암\s|항암|혈압|콜레스테롤|임산부|임신|수유|영유아|부작용|보충제|멜라토닌|크레아틴|오메가\s*3/;
export function policyDecision(job,validation,policy,{now=Date.now(),lastPublishedAt=0,pending=0,snapshot}={}){
  if(!policy||policy.mode!=='POLICY_APPROVED_AUTO'||policy.scope!==APPROVED_SCOPE||policy.enabled!==true)return {allowed:false,reason:'E_POLICY_DISABLED'};
  if(!Number.isFinite(Date.parse(policy.expires_at))||Date.parse(policy.expires_at)<=now)return {allowed:false,reason:'E_POLICY_EXPIRED'};
  if(job.task_type!=='NEW')return {allowed:false,reason:'E_UPDATE_MANUAL_REVIEW'};
  if(typeof job.topic!=='string'||!Object.hasOwn(FOOD_CATALOG,job.topic.normalize('NFKC').trim()))return {allowed:false,reason:'E_GENERAL_FOOD_SCOPE_UNVERIFIED'};
  if(!snapshot||!Number.isFinite(Date.parse(snapshot.retrieved_at))||now-Date.parse(snapshot.retrieved_at)>60000||Date.parse(snapshot.retrieved_at)>now+5000)return {allowed:false,reason:'E_POLICY_SNAPSHOT_REQUIRED'};
  if(snapshot.main_sha!==job.metadata.base_main_sha)return {allowed:false,reason:'BLOCKED_SOURCE_DRIFT'};
  if(!snapshot.shared_mutex_verified)return {allowed:false,reason:'E_SHARED_MUTEX_REQUIRED'};
  if(!snapshot.runner_ready)return {allowed:false,reason:snapshot.runner_status==='RUNNER_BUSY'?'BLOCKED_RUNNER_BUSY':snapshot.runner_status==='RUNNER_LABEL_MISMATCH'?'E_RUNNER_LABEL_MISMATCH':'BLOCKED_RUNNER_OFFLINE'};
  if(['active_runs','pending_sources','uncertain_sources','publication_holds'].some(k=>!Array.isArray(snapshot[k])||snapshot[k].length)||snapshot.public_backlog!=='CLEAR')return {allowed:false,reason:'BLOCKED_RECONCILIATION'};
  if(!Number.isFinite(snapshot.last_published_at)||snapshot.last_published_at<0||snapshot.last_published_at>now+5000)return {allowed:false,reason:'E_POLICY_LEDGER_TIME'};
  lastPublishedAt=Math.max(lastPublishedAt,snapshot.last_published_at);
  if(typeof validation?.content_text!=='string'||!validation.content_text.trim())return {allowed:false,reason:'E_POLICY_CONTENT_REQUIRED'};
  if(medical.test(job.topic)||medical.test(validation.content_text))return {allowed:false,reason:'BLOCKED_MEDICAL_REVIEW'};
  if(!Number.isInteger(policy.min_interval_ms)||policy.min_interval_ms<3600000||now-lastPublishedAt<policy.min_interval_ms)return {allowed:false,reason:'E_POLICY_INTERVAL'};
  if(!Number.isInteger(policy.max_pending)||policy.max_pending<1||pending>=policy.max_pending)return {allowed:false,reason:'E_POLICY_QUEUE_LIMIT'};
  if(validation?.structural_validation!=='PASS'||validation?.fact_review!=='PASS'||validation?.editorial_review!=='PASS'||validation?.visual_review!=='PASS'||validation?.intent_review!=='PASS'||validation?.source_current!=='PASS')return {allowed:false,reason:'E_POLICY_REVIEW_REQUIRED'};
  if(!/^[a-f0-9]{64}$/.test(validation?.draft_fingerprint??'')||validation.draft_fingerprint!==job.metadata.draft_fingerprint)return {allowed:false,reason:'E_APPROVAL_FINGERPRINT'};
  if(['evidence_digest','model_digest','rule_digest'].some(k=>!/^[a-f0-9]{64}$/.test(job.metadata[k]??''))||!/^[a-f0-9]{40}$/.test(job.metadata.base_main_sha??''))return {allowed:false,reason:'E_APPROVAL_IDENTITY'};
  return {allowed:true,approval:{kind:'POLICY',scope:policy.scope,job_id:job.job_id,target_url:null,task_type:'NEW',draft_fingerprint:validation.draft_fingerprint,evidence_digest:job.metadata.evidence_digest,rule_digest:job.metadata.rule_digest,model_digest:job.metadata.model_digest,policy_digest:createHash('sha256').update(JSON.stringify(policy)).digest('hex'),approved_at:new Date(now).toISOString()}};
}
