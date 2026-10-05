import {readFile} from 'node:fs/promises';import {join} from 'node:path';
import {createHash} from 'node:crypto';import {policyDecision} from './policy.mjs';
import {artifactPath,readVerifiedArtifact,atomicJson} from './artifacts.mjs';
import {ruleDigest,assertIntegratedSource} from './identity.mjs';
import {remoteSnapshot} from './remote-snapshot.mjs';
import {fileURLToPath} from 'node:url';
export async function authorizeReviewedJob(queue,runtime,id,limits={}){
  const job=queue.get(id);if(!job||job.state!=='AWAITING_APPROVAL')return {allowed:false,reason:'E_APPROVAL_STATE'};
  let policy;try{policy=JSON.parse(await readFile(join(runtime,'publish-policy.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return {allowed:false,reason:'E_POLICY_DISABLED'};throw new Error('E_POLICY_CONFIGURATION');}
  if(policy.enabled!==true)return {allowed:false,reason:'E_POLICY_DISABLED'};
  assertIntegratedSource();
  // Authoritative remote state comes from this program, never model/request fields.
  const snapshot=await remoteSnapshot(fileURLToPath(new URL('../',import.meta.url)));
  limits={...limits,snapshot};
  if(await ruleDigest()!==job.metadata.rule_digest)return {allowed:false,reason:'BLOCKED_SOURCE_DRIFT'};
  const validation=await readVerifiedArtifact(runtime,id,'validation.json',job.metadata.validation_digest);
  await readVerifiedArtifact(runtime,id,'draft.json',job.metadata.draft_fingerprint);
  await readVerifiedArtifact(runtime,id,'evidence.json',job.metadata.evidence_digest);
  const decision=policyDecision(job,validation,policy,{...limits,now:queue.clock()});if(!decision.allowed)return decision;
  const record={...decision.approval,validation_digest:job.metadata.validation_digest,base_main_sha:job.metadata.base_main_sha,remote_snapshot_digest:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),remote_checked_at:snapshot.retrieved_at};
  const ref='approval-'+createHash('sha256').update(JSON.stringify(record)).digest('hex')+'.json';
  await atomicJson(artifactPath(runtime,id,ref),record);
  // Re-read configuration after writing; neither a disabled policy nor changed draft can authorize delivery.
  if(JSON.stringify(JSON.parse(await readFile(join(runtime,'publish-policy.json'),'utf8')))!==JSON.stringify(policy))throw new Error('E_POLICY_CHANGED');
  const approved=queue.authorizePolicy(id,job.state_version,validation,policy,ref,limits);
  return {allowed:true,job:approved,approval:record};
}
