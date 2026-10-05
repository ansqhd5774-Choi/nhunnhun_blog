import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {policyDecision} from './policy.mjs';
import {publicationOutcome} from './publication-observer.mjs';

export const SITE = 'https://nhunnhun.tistory.com';
const mutationStates = new Set(['INTEGRATING','SOURCE_PUSHED','WAITING_RUNNER','RUNNING_WORKFLOW','PUBLIC_VERIFY']);
const transitions = {
  QUEUED:['RESEARCHING','CANCELLED'], RESEARCHING:['EVIDENCE_READY','BLOCKED_EVIDENCE','BLOCKED_IMAGES','RETRY_WAIT','FAILED'],
  EVIDENCE_READY:['DRAFTING'], DRAFTING:['VALIDATING','RETRY_WAIT','FAILED'],
  VALIDATING:['AWAITING_APPROVAL','BLOCKED_EVIDENCE','BLOCKED_IMAGES','BLOCKED_MEDICAL_REVIEW','RETRY_WAIT','FAILED'],
  AWAITING_APPROVAL:['READY_TO_INTEGRATE','QUEUED','CANCELLED'], READY_TO_INTEGRATE:['INTEGRATING','AWAITING_APPROVAL'],
  INTEGRATING:['SOURCE_PUSHED','BLOCKED_SOURCE_DRIFT','BLOCKED_AUTH','BLOCKED_RECONCILIATION'],
  SOURCE_PUSHED:['WAITING_RUNNER','BLOCKED_RECONCILIATION'], WAITING_RUNNER:['RUNNING_WORKFLOW','BLOCKED_RUNNER_OFFLINE','BLOCKED_RECONCILIATION'],
  RUNNING_WORKFLOW:['PUBLIC_VERIFY','BLOCKED_RECONCILIATION'], PUBLIC_VERIFY:['DONE','BLOCKED_RECONCILIATION'],
  RETRY_WAIT:['RESEARCHING','DRAFTING','VALIDATING','FAILED'],
  BLOCKED_EVIDENCE:['QUEUED','CANCELLED'],BLOCKED_IMAGES:['QUEUED','CANCELLED'],BLOCKED_MEDICAL_REVIEW:['AWAITING_APPROVAL','CANCELLED'],
  BLOCKED_AUTH:['READY_TO_INTEGRATE','CANCELLED'],BLOCKED_RUNNER_OFFLINE:['WAITING_RUNNER','BLOCKED_RECONCILIATION'],
  BLOCKED_SOURCE_DRIFT:['AWAITING_APPROVAL','CANCELLED'],BLOCKED_RECONCILIATION:['CANCELLED'],FAILED:['QUEUED','CANCELLED'],
};
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const intent = s => s.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
const forbidden = /gh[pousr]_[a-z0-9]{15,}|github_pat_|Bearer\s+[a-z0-9._-]{15,}/i;
function cleanRequest(input) {
  const allowed=['task_type','topic','article_id','target_url','expected_title','priority','revision','manifest'];
  if(!input || Object.keys(input).some(k=>!allowed.includes(k))) throw new Error('E_JOB_SCHEMA');
  if(!['NEW','UPDATE'].includes(input.task_type) || typeof input.topic!=='string' || !input.topic.trim() || input.topic.length>500) throw new Error('E_JOB_TOPIC');
  if(forbidden.test(JSON.stringify(input))) throw new Error('E_SECRET_INPUT');
  if(input.task_type==='UPDATE' && (!/^\d+$/.test(input.article_id||'') || input.target_url!==`${SITE}/${input.article_id}` || !input.expected_title?.trim() || !input.revision?.trim())) throw new Error('E_UPDATE_TARGET');
  if(input.task_type==='NEW' && [input.article_id,input.target_url,input.expected_title].some(Boolean)) throw new Error('E_NEW_TARGET');
  return {...input,priority:Number.isInteger(input.priority)?Math.max(0,Math.min(100,input.priority)):0};
}
export class Queue {
  constructor(path,{clock=Date.now}={}) {
    path=resolve(path);
    if(/^\\\\/.test(path)||/[\\/]OneDrive(?:[\\/]|$)/i.test(path)) throw new Error('E_QUEUE_STORAGE');
    mkdirSync(dirname(path),{recursive:true});this.path=path;this.clock=clock;
    this.db=new DatabaseSync(path);
    this.db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    this.db.exec(`CREATE TABLE IF NOT EXISTS jobs(
      job_id TEXT PRIMARY KEY, site TEXT NOT NULL, task_type TEXT NOT NULL, topic TEXT NOT NULL,
      article_id TEXT,target_url TEXT,expected_title TEXT,priority INTEGER NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,
      state TEXT NOT NULL,state_version INTEGER NOT NULL,lease_owner TEXT,lease_until INTEGER,claim_token TEXT,
      idempotency_key TEXT UNIQUE NOT NULL,payload TEXT NOT NULL,metadata TEXT NOT NULL,attempts_by_stage TEXT NOT NULL,
      last_pass_stage TEXT,first_fail_stage TEXT,last_error_code TEXT
    ); CREATE TABLE IF NOT EXISTS events(
      event_id INTEGER PRIMARY KEY,job_id TEXT NOT NULL,time INTEGER NOT NULL,from_state TEXT,to_state TEXT,code TEXT,
      FOREIGN KEY(job_id) REFERENCES jobs(job_id)
    );`);
    this.db.exec("UPDATE jobs SET metadata=json_set(metadata,'$.validation_digest',NULL) WHERE json_type(metadata,'$.validation_digest') IS NULL");
    this.db.exec("UPDATE jobs SET metadata=json_set(metadata,'$.public_proof_digest',NULL) WHERE json_type(metadata,'$.public_proof_digest') IS NULL");
  }
  transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const out=fn();this.db.exec('COMMIT');return out;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  decode(row){return row?{...row,payload:JSON.parse(row.payload),metadata:JSON.parse(row.metadata),attempts_by_stage:JSON.parse(row.attempts_by_stage)}:null;}
  get(id){return this.decode(this.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(id));}
  list(){return this.db.prepare('SELECT * FROM jobs ORDER BY priority DESC,created_at').all().map(r=>this.decode(r));}
  enqueue(input){
    const payload=cleanRequest(input);
    const key=digest([SITE,payload.task_type,payload.task_type==='NEW'?intent(payload.topic):payload.article_id,payload.task_type==='UPDATE'?payload.revision:null]);
    return this.transaction(()=>{
      const old=this.db.prepare('SELECT * FROM jobs WHERE idempotency_key=?').get(key);
      if(old)return {job:this.decode(old),duplicate:true};
      const id=randomUUID(),now=this.clock();
      const metadata={base_main_sha:null,source_sha:null,rule_digest:null,model_digest:null,evidence_digest:null,draft_fingerprint:null,validation_digest:null,public_proof_digest:null,approval_record_ref:null,workflow_path:null,workflow_run_id:null,public_url:null};
      this.db.prepare(`INSERT INTO jobs(job_id,site,task_type,topic,article_id,target_url,expected_title,priority,created_at,updated_at,state,state_version,idempotency_key,payload,metadata,attempts_by_stage) VALUES(?,?,?,?,?,?,?,?,?,?,'QUEUED',0,?,?,?,'{}')`).run(id,SITE,payload.task_type,payload.topic,payload.article_id??null,payload.target_url??null,payload.expected_title??null,payload.priority,now,now,key,JSON.stringify(payload),JSON.stringify(metadata));
      this.event(id,null,'QUEUED',null);return {job:this.get(id),duplicate:false};
    });
  }
  event(id,from,to,code){this.db.prepare('INSERT INTO events(job_id,time,from_state,to_state,code) VALUES(?,?,?,?,?)').run(id,this.clock(),from,to,code);}
  claim(owner,ttl=60000){
    if(typeof owner!=='string'||!owner||ttl<1000)throw new Error('E_CLAIM');
    return this.transaction(()=>{
      this.recoverExpired();
      const row=this.db.prepare("SELECT * FROM jobs WHERE state IN ('QUEUED','VALIDATING') AND lease_owner IS NULL ORDER BY priority DESC,created_at LIMIT 1").get();
      if(!row)return null;
      const now=this.clock(),token=randomUUID();
      this.db.prepare('UPDATE jobs SET lease_owner=?,lease_until=?,claim_token=?,state_version=state_version+1,updated_at=? WHERE job_id=?').run(owner,now+ttl,token,now,row.job_id);
      return this.get(row.job_id);
    });
  }
  recoverExpired(){
    // Called within claim transaction. An expired mutation is never queued for replay.
    const expired=this.db.prepare('SELECT * FROM jobs WHERE lease_until<=?').all(this.clock());
    for(const row of expired){
      const state=mutationStates.has(row.state)?'BLOCKED_RECONCILIATION':row.state==='QUEUED'?'QUEUED':['RESEARCHING','EVIDENCE_READY','DRAFTING','VALIDATING','RETRY_WAIT'].includes(row.state)?'QUEUED':row.state;
      this.db.prepare('UPDATE jobs SET state=?,state_version=state_version+1,lease_owner=NULL,lease_until=NULL,claim_token=NULL,updated_at=?,last_error_code=? WHERE job_id=?').run(state,this.clock(),'E_LEASE_EXPIRED',row.job_id);
      this.event(row.job_id,row.state,state,'E_LEASE_EXPIRED');
    }
  }
  assertClaim(id,claim){const job=this.get(id);if(!job||job.claim_token!==claim.claim_token||job.lease_owner!==claim.lease_owner||job.state_version!==claim.state_version||job.lease_until<=this.clock())throw new Error('E_STALE_WORKER');return job;}
  claimDelivery(owner,ttl=600000){
    if(typeof owner!=='string'||!owner||ttl<1000)throw new Error('E_CLAIM');
    return this.transaction(()=>{
      this.recoverExpired();
      const row=this.db.prepare("SELECT * FROM jobs WHERE state='READY_TO_INTEGRATE' AND lease_owner IS NULL ORDER BY priority DESC,created_at LIMIT 1").get();
      if(!row)return null;
      this.db.prepare('UPDATE jobs SET lease_owner=?,lease_until=?,claim_token=?,state_version=state_version+1,updated_at=? WHERE job_id=?').run(owner,this.clock()+ttl,randomUUID(),this.clock(),row.job_id);
      return this.get(row.job_id);
    });
  }
  completePublic(id,claim,proof,proofDigest){
    return this.transaction(()=>{
      const job=this.assertClaim(id,claim);
      if(job.state!=='PUBLIC_VERIFY'||!/^[a-f0-9]{64}$/.test(proofDigest??'')||!job.metadata.approval_record_ref)throw new Error('E_PUBLIC_PROOF_REQUIRED');
      if(createHash('sha256').update(JSON.stringify(proof,null,2)+'\n').digest('hex')!==proofDigest)throw new Error('E_PUBLIC_PROOF_REQUIRED');
      const outcome=publicationOutcome(job,proof);
      if(outcome.state!=='VERIFIED_PUBLIC_RESULT'||outcome.workflow_run_id!==job.metadata.workflow_run_id||outcome.public_url!==job.metadata.public_url)throw new Error('E_PUBLIC_PROOF_REQUIRED');
      const metadata={...job.metadata,public_proof_digest:proofDigest};
      this.db.prepare("UPDATE jobs SET state='DONE',state_version=state_version+1,updated_at=?,metadata=?,last_pass_stage='PUBLIC_VERIFY',last_error_code=NULL WHERE job_id=?").run(this.clock(),JSON.stringify(metadata),id);
      this.event(id,job.state,'DONE','ANONYMOUS_PUBLIC_PROOF_BOUND');return this.get(id);
    });
  }
  heartbeat(id,claim,ttl=60000){return this.transaction(()=>{this.assertClaim(id,claim);this.db.prepare('UPDATE jobs SET lease_until=? WHERE job_id=?').run(this.clock()+ttl,id);return this.get(id);});}
  transition(id,claim,next,{metadata={},pass=null,error=null}={}){
    return this.transaction(()=>{
      const job=this.assertClaim(id,claim);
      if(!transitions[job.state]?.includes(next))throw new Error('E_STATE_TRANSITION');
      if(next==='DONE')throw new Error('E_PUBLIC_PROOF_REQUIRED');
      if(Object.keys(metadata).some(k=>!Object.hasOwn(job.metadata,k)))throw new Error('E_JOB_METADATA');
      if(error&&!/^[A-Z][A-Z0-9_]{1,80}$/.test(error))throw new Error('E_ERROR_CODE');
      if(next==='READY_TO_INTEGRATE')throw new Error('E_APPROVAL_REQUIRED');
      const combined={...job.metadata,...metadata};
      if(['rule_digest','model_digest','evidence_digest','draft_fingerprint','validation_digest'].some(k=>metadata[k]!==undefined&&metadata[k]!==job.metadata[k]))combined.approval_record_ref=null;
      this.db.prepare('UPDATE jobs SET state=?,state_version=state_version+1,updated_at=?,metadata=?,last_pass_stage=COALESCE(?,last_pass_stage),first_fail_stage=CASE WHEN first_fail_stage IS NULL AND ? IS NOT NULL THEN ? ELSE first_fail_stage END,last_error_code=? WHERE job_id=?').run(next,this.clock(),JSON.stringify(combined),pass,error,job.state,error,id);
      this.event(id,job.state,next,error);return this.get(id);
    });
  }
  release(id,claim){return this.transaction(()=>{this.assertClaim(id,claim);this.db.prepare('UPDATE jobs SET lease_owner=NULL,lease_until=NULL,claim_token=NULL,state_version=state_version+1,updated_at=? WHERE job_id=?').run(this.clock(),id);return this.get(id);});}
  authorizePolicy(id,version,validation,policy,approvalRef,limits={}){
    return this.transaction(()=>{
      const job=this.get(id);
      if(!job||job.state!=='AWAITING_APPROVAL'||job.state_version!==version||job.lease_owner)throw new Error('E_APPROVAL_STATE');
      if(!/^[a-f0-9]{64}$/.test(job.metadata.validation_digest??'')||!/^approval-[a-f0-9]{64}\.json$/.test(approvalRef??''))throw new Error('E_APPROVAL_RECORD');
      const decision=policyDecision(job,validation,policy,{...limits,now:this.clock()});if(!decision.allowed)throw new Error(decision.reason);
      const metadata={...job.metadata,approval_record_ref:approvalRef};
      this.db.prepare("UPDATE jobs SET state='READY_TO_INTEGRATE',state_version=state_version+1,updated_at=?,metadata=? WHERE job_id=?").run(this.clock(),JSON.stringify(metadata),id);
      this.event(id,job.state,'READY_TO_INTEGRATE','POLICY_APPROVAL_BOUND');return this.get(id);
    });
  }
  resumeValidation(id,version,{rule_digest,base_main_sha,draft_fingerprint}){
    return this.transaction(()=>{
      const job=this.get(id);
      if(!job||job.state!=='RETRY_WAIT'||job.state_version!==version||job.lease_owner||!['E_REVIEW_INCOMPLETE','E_REVIEW_HTTP','E_REVIEW_SCHEMA','E_LOCAL_PREVIEW'].includes(job.last_error_code))throw new Error('E_CHECKPOINT_STATE');
      if(!/^[a-f0-9]{64}$/.test(rule_digest??'')||!/^([a-f0-9]{40})$/.test(base_main_sha??'')||draft_fingerprint!==job.metadata.draft_fingerprint||!job.metadata.evidence_digest)throw new Error('E_CHECKPOINT_IDENTITY');
      if((job.attempts_by_stage.VALIDATING??0)>=3)throw new Error('E_ATTEMPT_BUDGET');
      const metadata={...job.metadata,rule_digest,base_main_sha,validation_digest:null,approval_record_ref:null};
      this.db.prepare("UPDATE jobs SET state='VALIDATING',state_version=state_version+1,updated_at=?,metadata=?,last_error_code=NULL WHERE job_id=?").run(this.clock(),JSON.stringify(metadata),id);this.event(id,job.state,'VALIDATING','VERIFIED_LOCAL_CHECKPOINT');return this.get(id);
    });
  }
  attempt(id,claim,stage){return this.transaction(()=>{const job=this.assertClaim(id,claim);if(!['RESEARCHING','DRAFTING','VALIDATING'].includes(stage))throw new Error('E_ATTEMPT_STAGE');const attempts={...job.attempts_by_stage,[stage]:(job.attempts_by_stage[stage]??0)+1};if(attempts[stage]>3)throw new Error('E_ATTEMPT_BUDGET');this.db.prepare('UPDATE jobs SET attempts_by_stage=? WHERE job_id=?').run(JSON.stringify(attempts),id);return this.get(id);});}
  resume(id){return this.transaction(()=>{const job=this.get(id);if(!job||job.lease_owner&&job.lease_until>this.clock())throw new Error('E_JOB_ACTIVE');if(!['BLOCKED_EVIDENCE','BLOCKED_IMAGES','RETRY_WAIT','FAILED','AWAITING_APPROVAL'].includes(job.state))throw new Error('E_RECONCILIATION_REQUIRED');const metadata={...job.metadata,approval_record_ref:null};this.db.prepare("UPDATE jobs SET state='QUEUED',state_version=state_version+1,lease_owner=NULL,lease_until=NULL,claim_token=NULL,updated_at=?,metadata=? WHERE job_id=?").run(this.clock(),JSON.stringify(metadata),id);this.event(id,job.state,'QUEUED',null);return this.get(id);});}
  backup(path){path=resolve(path);if(path===this.path||existsSync(path))throw new Error('E_BACKUP_DESTINATION');mkdirSync(dirname(path),{recursive:true});this.db.prepare('VACUUM INTO ?').run(path);return path;}
  close(){this.db.close();}
}
