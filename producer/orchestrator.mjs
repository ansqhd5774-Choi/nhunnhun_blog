import { randomUUID } from 'node:crypto';
import { artifactPath,atomicJson } from './artifacts.mjs';
import {ruleDigest,localSourceSha} from './identity.mjs';
// Stage handlers receive trusted program state, not shell or publication capabilities.
export async function processOne(queue,runtime,handlers,{owner=randomUUID(),signal}={}){
  let current=queue.claim(owner,600000);if(!current)return null;
  const id=current.job_id;
  const resumeAt=current.state==='VALIDATING'?2:0;
  const heartbeat=setInterval(()=>{try{queue.heartbeat(id,current,600000);}catch{}},10000);
  const move=(next,data={})=>{current=queue.transition(id,current,next,data);};
  try{
    for(const [index,[stage,handler,artifact,next]] of [
      ['RESEARCHING',handlers.research,'evidence.json','EVIDENCE_READY'],
      ['DRAFTING',handlers.draft,'draft.json','VALIDATING'],
      ['VALIDATING',handlers.validate,'validation.json','AWAITING_APPROVAL'],
    ].entries()){
      if(index<resumeAt)continue;
      if(signal?.aborted)throw new Error('E_STOP_REQUESTED');
      if(current.state!==stage)move(stage,stage==='RESEARCHING'?{metadata:{rule_digest:await ruleDigest(),base_main_sha:localSourceSha()}}:{});current=queue.attempt(id,current,stage);
      const result=await handler({job:current,runtime,signal});
      if(signal?.aborted)throw new Error('E_STOP_REQUESTED');
      queue.assertClaim(id,current);
      const hash=await atomicJson(artifactPath(runtime,id,artifact),result);
      // The artifact is published only after the current lease/version is rechecked.
      queue.assertClaim(id,current);
      if(stage==='VALIDATING'&&(result.fact_review==='HOLD'||result.editorial_review==='HOLD'||result.medical_review==='HOLD')){
        move(result.medical_review==='HOLD'?'BLOCKED_MEDICAL_REVIEW':'BLOCKED_EVIDENCE',{error:result.medical_review==='HOLD'?'BLOCKED_MEDICAL_REVIEW':'BLOCKED_EVIDENCE'});
        return queue.get(id);
      }
      const metadata=stage==='RESEARCHING'?{evidence_digest:hash}:stage==='DRAFTING'?{draft_fingerprint:hash,...(result.model_digest?{model_digest:result.model_digest}:{})}:{validation_digest:hash};
      if(next)move(next,{metadata,pass:stage});
      else current=queue.get(id);
    }
    return queue.get(id);
  }catch(error){
    const code=/^(?:E|BLOCKED)_[A-Z0-9_]+$/.test(error?.message??'')?error.message:'E_STAGE_RUNTIME';
    if(code==='E_STALE_WORKER')return queue.get(id);
    const job=queue.get(id);current=job;
    if(job.state==='RESEARCHING')move(code==='BLOCKED_IMAGES'?'BLOCKED_IMAGES':['BLOCKED_EVIDENCE','BLOCKED_EXISTING_TOPIC','BLOCKED_UNSUPPORTED_KEYWORD','BLOCKED_RELATED_LINKS'].includes(code)?'BLOCKED_EVIDENCE':'RETRY_WAIT',{error:code});
    else if(job.state==='VALIDATING'&&/^E_IMAGE_/.test(code))move('BLOCKED_IMAGES',{error:code});
    else if(['DRAFTING','VALIDATING'].includes(job.state))move('RETRY_WAIT',{error:code});
    return queue.get(id);
  }finally{
    clearInterval(heartbeat);
    try{queue.release(id,current);}catch{}
  }
}
