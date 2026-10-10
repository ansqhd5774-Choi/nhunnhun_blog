import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

// Private operations overlay only. Never edits article, publication ledger or historical dates.
export function joinWholeReview(register, prior, review, currentBytes) {
  const approved = review.rows.filter(r => r.wholeStatus === 'PASS');
  if (approved.length !== 1 || approved[0].sourceId !== 'direct-yuja-cheong-20261009') throw new Error('E_REVIEW_SCOPE');
  const r = approved[0];
  const source = JSON.parse(currentBytes.toString('utf8'));
  const digest = crypto.createHash('sha256').update(currentBytes).digest('hex');
  if (source.id !== r.sourceId || digest !== r.sourceDigest) throw new Error('E_CURRENT_SOURCE_DRIFT');
  const old = register.rows.filter(x => x.sourceId === r.sourceId && x.publicUrl === r.publicUrl && x.sourceFile === 'posts/direct-yuja-cheong-20261009.json');
  if (old.length !== 1 || old[0].sourceCheckedAt !== null) throw new Error('E_HISTORICAL_JOIN');
  if (r.wholeSourceCheckedAt !== '2026-10-10' || r.wholeNextReviewAt !== '2026-11-09' || r.remaining.length) throw new Error('E_REVIEW_INCOMPLETE');
  for (const x of review.rows.filter(x => x.wholeStatus !== 'PASS')) {
    if (x.wholeSourceCheckedAt !== null || x.wholeNextReviewAt !== null) throw new Error('E_UNKNOWN_DATE');
  }
  const mappings = prior.mappings.filter(m => m.oldSourceId !== r.sourceId);
  mappings.push({oldSourceId:r.sourceId, oldSourceFile:old[0].sourceFile, publicUrl:r.publicUrl,
    status:'SUPERSEDED_BY_DIRECT_WHOLE_SOURCE_REVIEW', activeSourceId:r.sourceId,
    activeSourceFile:old[0].sourceFile, activeFileSha256:digest,
    digestKind:'SHA256_EXACT_GIT_FILE_BYTES', activeSourceCheckedAt:r.wholeSourceCheckedAt,
    activeNextReviewAt:r.wholeNextReviewAt, reviewEvidence:'docs/evidence-dates-whole-three-review-20261010.json',
    historicalSourceCheckedAt:null, historicalDateRetainedUnknown:true});
  const unknown = register.rows.filter(x => x.sourceCheckedAt === null).length;
  const ids = new Set(mappings.map(m => m.oldSourceId));
  if (ids.size !== mappings.length || [...ids].some(id => !register.rows.some(x => x.sourceId === id && x.sourceCheckedAt === null))) throw new Error('E_SUPERSESSION_JOIN');
  return {...prior, originalUnknownRecords:unknown, historicalUnknownRecordsRetained:unknown,
    supersededOriginalRecords:mappings.length, remainingActionableOriginalRecords:unknown-mappings.length,
    reviewedActivePublicUrls:new Set(mappings.map(m => m.publicUrl)).size,
    wholeReviewAppliedAt:'2026-10-10', mappings};
}

if (process.argv[1]?.endsWith('evidence-dates-join-whole-review.mjs')) {
  const [registerPath, priorPath, reviewPath, outputPath, ref='origin/main'] = process.argv.slice(2);
  if (!outputPath) throw new Error('Usage: node script register prior-supersession review output [git-ref]');
  const read = async p => JSON.parse((await fs.readFile(p,'utf8')).replace(/^\uFEFF/,''));
  const bytes = execFileSync('git',['show',`${ref}:posts/direct-yuja-cheong-20261009.json`],{maxBuffer:8*1024*1024});
  const joined = joinWholeReview(await read(registerPath), await read(priorPath), await read(reviewPath), bytes);
  await fs.writeFile(outputPath,JSON.stringify(joined,null,2)+'\n','utf8');
  console.log(JSON.stringify({historicalUnknown:joined.historicalUnknownRecordsRetained,
    superseded:joined.supersededOriginalRecords, remaining:joined.remainingActionableOriginalRecords}));
}
