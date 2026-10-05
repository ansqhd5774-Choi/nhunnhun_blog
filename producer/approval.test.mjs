import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve,dirname,basename} from 'node:path';
import {Queue} from './queue.mjs';import {APPROVED_SCOPE} from './policy.mjs';
test('policy approval persists one bound version and rejects disabled, stale and changed content',()=>{
  const root=resolve(tmpdir()),dir=mkdtempSync(join(root,'nh-approval-'));const q=new Queue(join(dir,'q.db'));
  try{
    const hash='a'.repeat(64),now=q.clock(),policy={mode:'POLICY_APPROVED_AUTO',scope:APPROVED_SCOPE,enabled:true,expires_at:new Date(now+86400000).toISOString(),min_interval_ms:86400000,max_pending:1};
    const limits={snapshot:{main_sha:'a'.repeat(40),retrieved_at:new Date(now).toISOString(),shared_mutex_verified:true,runner_ready:true,active_runs:[],pending_sources:[],uncertain_sources:[],publication_holds:[],public_backlog:'CLEAR',last_published_at:0}};
    const id=q.enqueue({task_type:'NEW',topic:'바나나'}).job.job_id;let job=q.claim('test');
    for(const state of ['RESEARCHING','EVIDENCE_READY','DRAFTING','VALIDATING','AWAITING_APPROVAL'])job=q.transition(id,job,state,state==='AWAITING_APPROVAL'?{metadata:{rule_digest:hash,evidence_digest:hash,model_digest:hash,draft_fingerprint:hash,validation_digest:hash,base_main_sha:'a'.repeat(40)}}:{});
    job=q.release(id,job);const review={structural_validation:'PASS',fact_review:'PASS',editorial_review:'PASS',visual_review:'PASS',intent_review:'PASS',source_current:'PASS',draft_fingerprint:hash,content_text:'일반 식재료 소개'},ref='approval-'+hash+'.json';
    assert.throws(()=>q.authorizePolicy(id,job.state_version,review,{...policy,enabled:false},ref,limits),/E_POLICY_DISABLED/);
    assert.throws(()=>q.authorizePolicy(id,job.state_version-1,review,policy,ref,limits),/E_APPROVAL_STATE/);
    assert.throws(()=>q.authorizePolicy(id,job.state_version,{...review,draft_fingerprint:'b'.repeat(64)},policy,ref,limits),/E_APPROVAL_FINGERPRINT/);
    assert.equal(q.authorizePolicy(id,job.state_version,review,policy,ref,limits).state,'READY_TO_INTEGRATE');
    assert.throws(()=>q.authorizePolicy(id,job.state_version,review,policy,ref,limits),/E_APPROVAL_STATE/);
    q.close();const reopened=new Queue(join(dir,'q.db'));assert.equal(reopened.get(id).metadata.approval_record_ref,ref,limits);reopened.close();
  }finally{try{q.close();}catch{}if(dirname(resolve(dir))!==root||!basename(dir).startsWith('nh-approval-'))throw new Error('E_TEST_CLEANUP');rmSync(dir,{recursive:true,force:true});}
});
