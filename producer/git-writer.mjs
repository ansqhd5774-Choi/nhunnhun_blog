import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {readVerifiedArtifact} from './artifacts.mjs';
import {checkPost,checkPublishHtml,fingerprint} from '../publishing/core.mjs';
import {assertImageReview} from '../publishing/image-review.mjs';
import {renderEditorialPost} from '../publishing/editorial.mjs';
import {ruleDigest,assertIntegratedSource} from './identity.mjs';
import {assertActiveSource} from './active-standard.mjs';
const REPO='ansqhd5774-Choi/nhunnhun_blog';
export function assertWriterDiff(paths,allowed){if(!Array.isArray(paths)||paths.length!==1||paths[0]!==allowed||!/^posts\/nh-[a-f0-9-]{36}\.json$/.test(allowed))throw new Error('E_WRITER_ALLOWLIST');}
export function assertWriterSnapshot(snapshot,base){
  if(!Number.isFinite(Date.parse(snapshot.retrieved_at))||Date.now()-Date.parse(snapshot.retrieved_at)>60000||Date.parse(snapshot.retrieved_at)>Date.now()+5000)throw new Error('E_WRITER_SNAPSHOT_STALE');
  if(snapshot.main_sha!==base)throw new Error('BLOCKED_SOURCE_DRIFT');
  if(!Array.isArray(snapshot.active_runs)||!Array.isArray(snapshot.pending_sources)||!Array.isArray(snapshot.uncertain_sources)||snapshot.active_runs.length||snapshot.pending_sources.length||snapshot.uncertain_sources.length)throw new Error('BLOCKED_RECONCILIATION');
  if(!snapshot.shared_mutex_verified)throw new Error('E_SHARED_MUTEX_REQUIRED');
  if(!snapshot.runner_ready)throw new Error(snapshot.runner_status==='RUNNER_BUSY'?'BLOCKED_RUNNER_BUSY':snapshot.runner_status==='RUNNER_LABEL_MISMATCH'?'E_RUNNER_LABEL_MISMATCH':'BLOCKED_RUNNER_OFFLINE');
  if(!Array.isArray(snapshot.publication_holds)||snapshot.publication_holds.length)throw new Error('BLOCKED_RECONCILIATION');
}
function gitAt(cwd,args){try{return execFileSync(process.env.NH_GIT??'C:\\Program Files\\Git\\cmd\\git.exe',args,{cwd,encoding:'utf8',stdio:['pipe','pipe','pipe'],env:{...process.env,GCM_INTERACTIVE:'never'}}).trim();}catch{throw new Error('E_GIT_COMMAND');}}
export class GitWriter{
  constructor(source,runtime){this.source=resolve(source);this.runtime=resolve(runtime);}
  async prepare(job,approval,snapshot){
    assertIntegratedSource(this.source);
    if(job.state!=='READY_TO_INTEGRATE'||job.task_type!=='NEW'||approval?.kind!=='POLICY'||approval.job_id!==job.job_id||['draft_fingerprint','evidence_digest','rule_digest','model_digest','validation_digest','base_main_sha'].some(k=>approval[k]!==job.metadata[k]))throw new Error('E_WRITER_APPROVAL');
    if(await ruleDigest()!==job.metadata.rule_digest)throw new Error('BLOCKED_SOURCE_DRIFT');
    const approvalHash=createHash('sha256').update(JSON.stringify(approval)).digest('hex');
    if(job.metadata.approval_record_ref!=='approval-'+approvalHash+'.json')throw new Error('E_WRITER_APPROVAL');
    const storedApproval=JSON.parse(await readFile(join(this.runtime,'jobs',job.job_id,job.metadata.approval_record_ref),'utf8'));
    if(JSON.stringify(storedApproval)!==JSON.stringify(approval))throw new Error('E_WRITER_APPROVAL');
    assertWriterSnapshot(snapshot,job.metadata.base_main_sha);
    const draft=await readVerifiedArtifact(this.runtime,job.job_id,'draft.json',job.metadata.draft_fingerprint);
    const evidence=await readVerifiedArtifact(this.runtime,job.job_id,'evidence.json',job.metadata.evidence_digest);
    const validation=await readVerifiedArtifact(this.runtime,job.job_id,'validation.json',job.metadata.validation_digest);
    if(validation.draft_fingerprint!==job.metadata.draft_fingerprint||['structural_validation','fact_review','editorial_review','visual_review','intent_review','source_current'].some(k=>validation[k]!=='PASS'))throw new Error('E_WRITER_REVIEW_BINDING');
    assertActiveSource(draft.source,evidence);
    const post={...draft.source,status:'ready',approved:true},path='posts/'+post.id+'.json';
    checkPost(post,post.id+'.json');checkPublishHtml(post);assertImageReview(post);renderEditorialPost(post);
    if(post.id!=='nh-'+job.job_id)throw new Error('E_WRITER_ID');
    gitAt(this.source,['fetch','origin','main']);
    const remote=gitAt(this.source,['rev-parse','origin/main']);if(remote!==job.metadata.base_main_sha)throw new Error('BLOCKED_SOURCE_DRIFT');
    const root=resolve(this.runtime,'worktrees'),worktree=resolve(root,job.job_id),rel=relative(root,worktree);
    if(rel.startsWith('..')||isAbsolute(rel))throw new Error('E_WORKTREE_PATH');
    await mkdir(root,{recursive:true});gitAt(this.source,['worktree','add','--detach',worktree,remote]);
    await mkdir(join(worktree,'posts'),{recursive:true});
    await writeFile(join(worktree,path),JSON.stringify(post,null,2)+'\n',{flag:'wx'});
    gitAt(worktree,['add','--',path]);assertWriterDiff(gitAt(worktree,['diff','--cached','--name-only']).split(/\r?\n/).filter(Boolean),path);
    return {job_id:job.job_id,worktree,base_sha:remote,path,post_fingerprint:fingerprint(post),approval_digest:createHash('sha256').update(JSON.stringify(approval)).digest('hex'),status:'PREPARED_NOT_PUSHED'};
  }
  // Only caller-supplied fresh verification can authorize a concrete fast-forward delivery.
  // No method is connected to the worker until shared mutex + content review + E2E gates pass.
  async push(prepared,approval,snapshot,checks){
    assertWriterSnapshot(snapshot,prepared.base_sha);
    if(checks?.regression!=='PASS'||checks?.source_validation!=='PASS'||checks?.public_backlog!=='CLEAR')throw new Error('E_WRITER_CHECKS');
    if(createHash('sha256').update(JSON.stringify(approval)).digest('hex')!==prepared.approval_digest)throw new Error('E_WRITER_APPROVAL');
    assertWriterDiff(gitAt(prepared.worktree,['diff','--cached','--name-only']).split(/\r?\n/).filter(Boolean),prepared.path);
    const post=JSON.parse(await readFile(join(prepared.worktree,prepared.path),'utf8'));
    if(fingerprint(post)!==prepared.post_fingerprint)throw new Error('E_WRITER_CONTENT_DRIFT');
    const actual=gitAt(this.source,['ls-remote','origin','refs/heads/main']).split(/\s+/)[0];if(actual!==prepared.base_sha)throw new Error('BLOCKED_SOURCE_DRIFT');
    gitAt(prepared.worktree,['-c','user.name=NHUNNHUN Producer','-c','user.email=producer@localhost','commit','-m','publish source: '+post.id]);
    const sha=gitAt(prepared.worktree,['rev-parse','HEAD']);
    // Uncertain push result is reconciliation, never a fresh push/republication loop.
    try{gitAt(prepared.worktree,['push','origin','HEAD:refs/heads/main']);}catch{throw new Error('BLOCKED_RECONCILIATION');}
    if(gitAt(this.source,['ls-remote','origin','refs/heads/main']).split(/\s+/)[0]!==sha)throw new Error('BLOCKED_RECONCILIATION');
    return {source_sha:sha,workflow_path:'.github/workflows/publish-posts.yml',status:'SOURCE_PUSHED_NOT_PUBLICLY_VERIFIED'};
  }
}
