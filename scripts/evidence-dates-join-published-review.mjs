import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {updateFingerprint} from '../publishing/update-core.mjs';

// Private overlay only. A prepared review never proves a production update.
export function joinPublishedReview(register, prior, row, currentBytes, ledger) {
  const allowed={381:'chestnut-calories-benefits-storage-20261006',405:'direct-tempeh-20261009'};
  if(allowed[row.articleId]!==row.currentSourceId)throw new Error('E_REVIEW_SCOPE');
  const preparedIds={381:'evidence-dates-381-season-fix-20261010',405:'direct-evidence-dates-405-usda-precision-fix-20261010'};
  if(row.preparedSourceId!==preparedIds[row.articleId]||row.preparedFile!==`updates/${row.preparedSourceId}.json`)throw new Error('E_REVIEW_SCOPE');
  if(row.preparedWholeStatus!=='PASS_ON_PREPARED_SOURCE_PENDING_PUBLIC_UPDATE'||row.remainingSourceClaimGaps?.length!==0)throw new Error('E_REVIEW_INCOMPLETE');
  if(row.currentWholeSourceCheckedAt!==null||row.currentWholeNextReviewAt!==null)throw new Error('E_CURRENT_DATE');
  const source=JSON.parse(currentBytes.toString('utf8'));
  const digest=crypto.createHash('sha256').update(currentBytes).digest('hex');
  if(source.id!==row.preparedSourceId||source.articleId!==row.articleId||source.targetUrl!==row.publicUrl||digest!==row.preparedDigest)throw new Error('E_CURRENT_SOURCE_DRIFT');
  const result=ledger.publicResult;
  if(ledger.phase!=='updated'||result?.status!=='PUBLIC_VERIFIED')throw new Error('E_PUBLIC_UPDATE_UNCONFIRMED');
  if(ledger.articleId!==row.articleId||ledger.url!==row.publicUrl||result.url!==row.publicUrl||result.sourceId!==source.id)throw new Error('E_LEDGER_TARGET');
  const fingerprint=updateFingerprint(source);
  if(ledger.fingerprint!==fingerprint||result.fingerprint!==fingerprint)throw new Error('E_LEDGER_FINGERPRINT');
  if(!ledger.sourceCommit||result.sourceCommit!==ledger.sourceCommit||!result.checkedAt||!ledger.runUrl||result.runUrl!==ledger.runUrl)throw new Error('E_LEDGER_EVIDENCE');
  if(row.sourceReviewPerformedAt!=='2026-10-10'||row.preparedNextReviewAt!=='2026-11-09')throw new Error('E_REVIEW_DATE');
  const oldFile=`posts/${row.currentSourceId}.json`;
  const old=register.rows.filter(x=>x.sourceId===row.currentSourceId&&x.sourceFile===oldFile&&x.publicUrl===row.publicUrl&&x.sourceCheckedAt===null);
  if(old.length!==1)throw new Error('E_HISTORICAL_JOIN');
  const mapping={oldSourceId:row.currentSourceId,oldSourceFile:old[0].sourceFile,publicUrl:row.publicUrl,status:'SUPERSEDED_BY_DIRECT_WHOLE_SOURCE_REVIEW',activeSourceId:source.id,activeSourceFile:row.preparedFile,activeFileSha256:digest,digestKind:'SHA256_EXACT_GIT_FILE_BYTES',activeSourceCheckedAt:row.sourceReviewPerformedAt,activeNextReviewAt:row.preparedNextReviewAt,reviewEvidence:'docs/evidence-dates-381-405-prepared-whole-review-20261010.json',historicalSourceCheckedAt:null,historicalDateRetainedUnknown:true,publicationRunUrl:ledger.runUrl,publicVerifiedAt:result.checkedAt,sourceCommit:ledger.sourceCommit};
  const existing=prior.mappings.find(x=>x.oldSourceId===row.currentSourceId);
  if(existing&&JSON.stringify(existing)!==JSON.stringify(mapping))throw new Error('E_EXISTING_MAPPING_DRIFT');
  const mappings=existing?[...prior.mappings]:[...prior.mappings,mapping];
  const ids=new Set(mappings.map(x=>x.oldSourceId));
  if(ids.size!==mappings.length||[...ids].some(id=>!register.rows.some(x=>x.sourceId===id&&x.sourceCheckedAt===null)))throw new Error('E_SUPERSESSION_JOIN');
  const unknown=register.rows.filter(x=>x.sourceCheckedAt===null).length;
  return {...prior,originalUnknownRecords:unknown,historicalUnknownRecordsRetained:unknown,supersededOriginalRecords:mappings.length,remainingActionableOriginalRecords:unknown-mappings.length,reviewedActivePublicUrls:new Set(mappings.map(x=>x.publicUrl)).size,wholeReviewAppliedAt:'2026-10-10',mappings};
}

if(process.argv[1]?.endsWith('evidence-dates-join-published-review.mjs')){
 const [registerPath,priorPath,reviewPath,outputPath,ref='origin/main']=process.argv.slice(2);
 if(!outputPath)throw new Error('Usage: node script register prior review private-output [git-ref]');
 const read=async p=>JSON.parse((await fs.readFile(p,'utf8')).replace(/^\uFEFF/,''));
 const review=await read(reviewPath),register=await read(registerPath);let overlay=await read(priorPath);
 for(const row of review.rows){
  const bytes=execFileSync('git',['show',`${ref}:${row.preparedFile}`]);
  const ledger=JSON.parse(execFileSync('git',['show',`${ref}:publishing/update-state/${row.preparedSourceId}.json`]).toString('utf8'));
  overlay=joinPublishedReview(register,overlay,row,bytes,ledger);
 }
 await fs.writeFile(outputPath,JSON.stringify(overlay,null,2)+'\n');
 console.log(JSON.stringify({historicalUnknown:overlay.historicalUnknownRecordsRetained,superseded:overlay.supersededOriginalRecords,remaining:overlay.remainingActionableOriginalRecords}));
}
