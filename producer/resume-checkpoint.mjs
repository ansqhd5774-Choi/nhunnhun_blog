import {readVerifiedArtifact} from './artifacts.mjs';import {assembleDraft,MODEL_DIGEST} from './draft.mjs';import {ruleDigest,localSourceSha} from './identity.mjs';
// Only a failed infrastructure/formatting review resumes; semantic HOLD needs a new draft.
export async function resumeValidationCheckpoint(queue,runtime,id){
  const job=queue.get(id);if(!job)throw new Error('E_JOB_NOT_FOUND');
  const evidence=await readVerifiedArtifact(runtime,id,'evidence.json',job.metadata.evidence_digest);
  const draft=await readVerifiedArtifact(runtime,id,'draft.json',job.metadata.draft_fingerprint);
  if(draft.model_digest!==MODEL_DIGEST||draft.source.approved!==false||draft.source.status!=='draft')throw new Error('E_CHECKPOINT_IDENTITY');
  const rebuilt=assembleDraft(job,evidence,draft.model_output);
  if(JSON.stringify(rebuilt.source)!==JSON.stringify(draft.source)||rebuilt.renderedHtml!==draft.renderedHtml)throw new Error('E_CHECKPOINT_REBUILD_DRIFT');
  return queue.resumeValidation(id,job.state_version,{rule_digest:await ruleDigest(),base_main_sha:localSourceSha(),draft_fingerprint:job.metadata.draft_fingerprint});
}
