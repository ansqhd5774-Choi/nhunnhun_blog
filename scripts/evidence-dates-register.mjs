import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {recordedSourceDates} from './build-review-register.mjs';
import {contentDigest} from '../publishing/content-standards.mjs';
import {parseDocument,DomUtils} from 'htmlparser2';
import {summarizeSchemaDates} from './summarize-schema-dates.mjs';

// Operational evidence only: never a publication gate or a fresh medical review.
const [ref='origin/main',checkpoint,out]=process.argv.slice(2);
if(!checkpoint || !out) throw new Error('Usage: node scripts/evidence-dates-register.mjs <git-ref> <metadata-pages.json> <private-output-dir>');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024}).trim();
const commit=git('rev-parse',ref);
const files=git('ls-tree','-r','--name-only',commit).split('\n');
const fileSet=new Set(files);
const selected=files.filter(f=>/^(?:posts|updates|content-reviews\/(?:posts|updates)|publishing\/(?:state|update-state))\/[^/]+\.json$/.test(f));
const batch=execFileSync('git',['cat-file','--batch'],{input:selected.map(f=>`${commit}:${f}\n`).join(''),maxBuffer:64*1024*1024});
const objects=new Map();let cursor=0;
for(const file of selected){const end=batch.indexOf(10,cursor);const header=batch.subarray(cursor,end).toString('utf8');
 const length=Number(header.split(' ')[2]);if(!Number.isFinite(length))throw new Error('Unexpected Git object header');
 cursor=end+1;objects.set(file,JSON.parse(batch.subarray(cursor,cursor+length).toString('utf8')));cursor+=length+1;}
const read=(file)=>fileSet.has(file)?objects.get(file) ?? null:null;
const pages=JSON.parse(await fs.readFile(checkpoint,'utf8'));
const rows=[];
for(const file of files.filter(f=>/^(posts|updates)\/[^/]+\.json$/.test(f))){
 const source=read(file); if(!source)continue;
 const folder=file.split('/')[0],name=path.basename(file);
 const review=read(`content-reviews/${file}`);
 const ledger=read(`publishing/${folder==='posts'?'state':'update-state'}/${name}`);
 const url=ledger?.url ?? source.targetUrl ?? (source.articleId ? `https://nhunnhun.tistory.com/${source.articleId}` : null);
 const publicPage=pages[url];
 const dates=recordedSourceDates(source,review);
 const digestMatches=Boolean(review && review.sourceDigest===contentDigest(source));
 const validReview=digestMatches && review?.review?.status==='approved' && dates.sourceDateRecords.length>0;
 const sources=new Map((review?.sources ?? []).map(s=>[s.id,s]));
 const bodyText=DomUtils.textContent(parseDocument(String(source.bodyHtml ?? ''))).replace(/\s+/g,' ').trim();
 const claims=validReview?(review.coverage ?? []).map(c=>({module:c.module,claim:c.answerQuote,
   bodyQuotePresent:bodyText.includes(String(c.answerQuote ?? '').replace(/\s+/g,' ').trim()),
   references:(c.sourceIds ?? []).map(id=>({id,url:sources.get(id)?.url ?? null,
    checkedAt:dates.sourceDateRecords.find(d=>d.url===sources.get(id)?.url)?.checkedAt ?? null})),
   verification:'DIGEST_MATCHING_REVIEW_RECORD_NOT_NEW_CONTENT_REVIEW'})):[];
 const schema=(publicPage?.jsonLd ?? []).filter(x=>x.validJson).flatMap(x=>Array.isArray(x.value)?x.value:x.value?.['@graph'] ?? [x.value])
  .filter(x=>['Article','BlogPosting','NewsArticle'].some(t=>[x?.['@type']].flat().includes(t)));
 rows.push({sourceId:source.id,sourceFile:file,publicUrl:url,sourceCommit:commit,
  digestMatches,publicationPhase:ledger?.phase ?? 'UNKNOWN',publicVerification:ledger?.publicResult?.status ?? 'UNKNOWN',
  publicationRecordedAt:ledger?.timestamp ?? null,metadataObservedAt:publicPage?.checkedAt ?? null,
  publicMetadataDates:schema.map(s=>({publishedAt:s.datePublished ?? null,revisedAt:s.dateModified ?? null})),
  publicRevisionEvidence:'PROVIDER_METADATA_ONLY_NOT_INDEPENDENT_REVISION_HISTORY',...dates,claims,
  priority:!validReview?'NEEDS_CLAIM_REVIEW':dates.nextReviewAt && dates.nextReviewAt<new Date().toISOString().slice(0,10)?'REVIEW_DUE':'RECORDED_REVIEW_SCHEDULE'});
}
const counts={sources:rows.length,publicInventory:Object.keys(pages).length,digestMatching:rows.filter(r=>r.digestMatches).length,
 recordedDates:rows.filter(r=>r.status==='RECORDED_SOURCE_DATES').length,unknownDates:rows.filter(r=>r.status!=='RECORDED_SOURCE_DATES').length,
 mappedClaims:rows.reduce((n,r)=>n+r.claims.length,0),missingClaimQuote:rows.reduce((n,r)=>n+r.claims.filter(c=>!c.bodyQuotePresent).length,0),
 missingClaimReference:rows.reduce((n,r)=>n+r.claims.filter(c=>!c.references.length || c.references.some(s=>!s.url || !s.checkedAt)).length,0)};
counts.uniquePublicUrlsWithRecordedDates=new Set(rows.filter(r=>r.status==='RECORDED_SOURCE_DATES').map(r=>r.publicUrl).filter(Boolean)).size;
const publicDates=summarizeSchemaDates(pages).map(page=>({...page,sourceRecords:rows.filter(r=>r.publicUrl===page.url).map(r=>({sourceId:r.sourceId,
 sourceCheckedAt:r.sourceCheckedAt,nextReviewAt:r.nextReviewAt,publicationRecordedAt:r.publicationRecordedAt,
 observationPrecedesPublication:page.observedAt && r.publicationRecordedAt ? Date.parse(page.observedAt)<Date.parse(r.publicationRecordedAt):null}))}));
await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,'evidence-dates-register.json'),JSON.stringify({sourceCommit:commit,analyzedAt:new Date().toISOString(),counts,rows},null,2));
await fs.writeFile(path.join(out,'evidence-dates-public-observations.json'),JSON.stringify({sourceCommit:commit,rows:publicDates,
 limitation:'Stored metadata dates and publication ledger times are separate observations; neither proves fresh source review or full revision history.'},null,2));
console.log(JSON.stringify({sourceCommit:commit,...counts}));
