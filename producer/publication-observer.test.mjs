import test from 'node:test';import assert from 'node:assert/strict';import {publicationOutcome} from './publication-observer.mjs';
const hash='a'.repeat(64),sha='b'.repeat(40),job={metadata:{source_sha:sha,draft_fingerprint:hash,workflow_run_id:null}},run={id:123,path:'.github/workflows/publish-posts.yml',head_sha:sha,head_branch:'main',event:'push',run_attempt:1,status:'completed',conclusion:'success',created_at:'2026-10-04T10:00:00Z'},ledger={phase:'published',sourceCommit:sha,fingerprint:hash,url:'https://nhunnhun.tistory.com/123',editorialTemplateVersion:'R3'};
test('observer binds workflow to exact pushed source and does not confuse main or another workflow',()=>{
  assert.equal(publicationOutcome(job,{runs:[{...run,head_sha:'c'.repeat(40)}],postFingerprint:hash}).state,'WAITING_RUNNER');
  assert.equal(publicationOutcome(job,{runs:[{...run,path:'.github/workflows/update-posts.yml'}],postFingerprint:hash}).state,'WAITING_RUNNER');
  for(const runs of [[run,{...run,id:124}],[{...run,run_attempt:2}],[{...run,conclusion:'failure'}]])assert.equal(publicationOutcome(job,{runs,postFingerprint:hash,ledger}).state,'BLOCKED_RECONCILIATION');
});
test('successful workflow alone and submitting ledger never mean public completion',()=>{
  assert.equal(publicationOutcome(job,{runs:[run],postFingerprint:hash,ledger:{...ledger,phase:'submitting'}}).state,'BLOCKED_RECONCILIATION');
  assert.equal(publicationOutcome(job,{runs:[run],postFingerprint:hash,ledger}).state,'PUBLIC_VERIFY');
  assert.equal(publicationOutcome(job,{runs:[run],postFingerprint:hash,ledger,audit:{status:'PASS',url:ledger.url}}).state,'BLOCKED_RECONCILIATION');
});
test('fresh bound desktop/mobile audit verifies result while overflow and stale proof hold',()=>{
  const expected={images:3,h2:3,h3:0,tables:0,highlights:2,faq:2},m={overflowPx:0,wideImages:0,images:3,missingAlt:0,brokenImages:0,nonNativeImages:0,h2:3,h3:0,badHeadingStyles:0,tables:0,badTableWraps:0,highlights:2,highlightColors:2,hiddenHighlights:0,faqQ:2,faqA:2,heroPriority:true,badLazyImages:0};
  const audit={status:'PASS',mode:'ANONYMOUS_READ_ONLY',url:ledger.url,post_fingerprint:hash,verified_at:new Date().toISOString(),expected,desktop:{...m,viewport:1440,representativeSourceMatch:true,ogNative:true,categoryVerified:true,tagsVerified:true,allImageSourcesMatch:true},mobile:{...m,viewport:390}},r={...run,created_at:new Date(Date.now()-3600000).toISOString()};
  const outcome=a=>publicationOutcome(job,{runs:[r],postFingerprint:hash,ledger,audit:a});
  assert.equal(outcome(audit).state,'VERIFIED_PUBLIC_RESULT');assert.equal(outcome({...audit,mobile:{...audit.mobile,overflowPx:1}}).state,'BLOCKED_RECONCILIATION');assert.equal(outcome({...audit,verified_at:new Date(Date.now()-1800000).toISOString()}).state,'BLOCKED_RECONCILIATION');
});
