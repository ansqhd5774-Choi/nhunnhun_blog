import {readFile} from 'node:fs/promises';import {join} from 'node:path';import {createHash,randomUUID} from 'node:crypto';
import {atomicJson,artifactPath,readVerifiedArtifact} from './artifacts.mjs';
import {publicationOutcome} from './publication-observer.mjs';import {fingerprint} from '../publishing/core.mjs';
import {APPROVED_SCOPE,policyDecision} from './policy.mjs';

export function deliveryGate(policy,security,now=Date.now()){
  if(policy?.enabled!==true||policy.mode!=='POLICY_APPROVED_AUTO'||policy.scope!==APPROVED_SCOPE||policy.human_authorized!==true)return {allowed:false,reason:'E_POLICY_DISABLED'};
  if(!Number.isFinite(Date.parse(policy.expires_at))||Date.parse(policy.expires_at)<=now)return {allowed:false,reason:'E_POLICY_EXPIRED'};
  if(security?.unattended_enabled!==true||security?.maintenance_verified!==true||!['SUPPORTED_OS','ESU_ACTIVE'].includes(security.basis)||!Number.isFinite(Date.parse(security.expires_at))||Date.parse(security.expires_at)<=now)return {allowed:false,reason:'E_SECURITY_MAINTENANCE_REQUIRED'};
  return {allowed:true};
}
export async function deliveryConfiguration(runtime){
  try{return {policy:JSON.parse(await readFile(join(runtime,'publish-policy.json'),'utf8')),security:JSON.parse(await readFile(join(runtime,'security-maintenance.json'),'utf8'))};}catch{return {policy:{enabled:false},security:null};}
}

// All publication uses GitWriter -> the canonical push workflow. No editor fallback exists.
export async function processDeliveryOne(queue,runtime,services,{owner=randomUUID(),signal,configuration,maxPolls=40}={}){
  const config=configuration??await deliveryConfiguration(runtime),gate=deliveryGate(config.policy,config.security,queue.clock());
  if(!gate.allowed)return {state:'DELIVERY_DISABLED',reason:gate.reason};
  let current=queue.claimDelivery(owner);if(!current)return null;
  const id=current.job_id,move=(next,data={})=>{current=queue.transition(id,current,next,data);};
  const timer=setInterval(()=>{try{queue.heartbeat(id,current,600000);}catch{}},10000);
  const stopped=()=>{if(signal?.aborted)throw new Error('E_STOP_REQUESTED');};
  try{
    stopped();move('INTEGRATING');
    const approval=JSON.parse(await readFile(artifactPath(runtime,id,current.metadata.approval_record_ref),'utf8'));
    if(approval.policy_digest!==createHash('sha256').update(JSON.stringify(config.policy)).digest('hex'))throw new Error('E_POLICY_CHANGED');
    const snapshot=await services.snapshot();stopped();
    const validation=await readVerifiedArtifact(runtime,id,'validation.json',current.metadata.validation_digest);
    const decision=policyDecision(current,validation,config.policy,{snapshot,now:queue.clock(),pending:queue.list().filter(j=>j.job_id!==id&&['READY_TO_INTEGRATE','INTEGRATING','SOURCE_PUSHED','WAITING_RUNNER','RUNNING_WORKFLOW','PUBLIC_VERIFY'].includes(j.state)).length});
    if(!decision.allowed)throw new Error(decision.reason);
    // prepare verifies the bound READY record; current job now owns its integration lease.
    const prepared=await services.writer.prepare({...current,state:'READY_TO_INTEGRATE'},approval,snapshot);
    const checks=await services.checks(prepared);stopped();
    const fresh=await services.snapshot();
    const latest=configuration??await deliveryConfiguration(runtime);
    if(!deliveryGate(latest.policy,latest.security,queue.clock()).allowed||JSON.stringify(latest)!==JSON.stringify(config))throw new Error('E_POLICY_CHANGED');
    await atomicJson(artifactPath(runtime,id,'integration-checkpoint.json'),{prepared,approval_ref:current.metadata.approval_record_ref,checks,phase:'BEFORE_GIT_PUSH'});
    stopped();const pushed=await services.writer.push(prepared,approval,fresh,checks);
    if(!/^[a-f0-9]{40}$/.test(pushed.source_sha??'')||pushed.workflow_path!=='.github/workflows/publish-posts.yml')throw new Error('E_DELIVERY_SOURCE');
    move('SOURCE_PUSHED',{metadata:{source_sha:pushed.source_sha,workflow_path:pushed.workflow_path},pass:'GIT_PUSH'});
    move('WAITING_RUNNER');
    const draft=await readVerifiedArtifact(runtime,id,'draft.json',current.metadata.draft_fingerprint),postFingerprint=fingerprint(draft.source);
    for(let poll=0;poll<maxPolls;poll++){
      stopped();const observation=await services.observe(current,prepared),outcome=publicationOutcome(current,{...observation,postFingerprint});
      if(outcome.state==='BLOCKED_RECONCILIATION')throw new Error(outcome.reason);
      if(outcome.workflow_run_id&&current.metadata.workflow_run_id&&current.metadata.workflow_run_id!==outcome.workflow_run_id)throw new Error('E_RUN_AMBIGUOUS');
      if(outcome.state==='RUNNING_WORKFLOW'&&current.state==='WAITING_RUNNER')move('RUNNING_WORKFLOW',{metadata:{workflow_run_id:outcome.workflow_run_id}});
      if(outcome.state==='PUBLIC_VERIFY'){
        if(current.state==='WAITING_RUNNER')move('RUNNING_WORKFLOW',{metadata:{workflow_run_id:outcome.workflow_run_id}});
        move('PUBLIC_VERIFY',{metadata:{workflow_run_id:outcome.workflow_run_id,public_url:outcome.public_url},pass:'WORKFLOW_LEDGER'});
        const audit=await services.audit({...draft.source,status:'ready',approved:true},outcome.public_url);stopped();
        const proof={...observation,postFingerprint,audit},digest=await atomicJson(artifactPath(runtime,id,'publication-proof.json'),proof);
        current=queue.completePublic(id,current,proof,digest);return current;
      }
      await services.wait(signal);
    }
    throw new Error('E_WORKFLOW_WAIT_TIMEOUT');
  }catch(error){
    const code=/^(?:E|BLOCKED)_[A-Z0-9_]+$/.test(error?.message??'')?error.message:'E_DELIVERY_RUNTIME';
    if(code==='E_STALE_WORKER')return queue.get(id);
    move(code==='BLOCKED_SOURCE_DRIFT'&&current.state==='INTEGRATING'?'BLOCKED_SOURCE_DRIFT':'BLOCKED_RECONCILIATION',{error:code});return queue.get(id);
  }finally{clearInterval(timer);try{queue.release(id,current);}catch{}}
}
