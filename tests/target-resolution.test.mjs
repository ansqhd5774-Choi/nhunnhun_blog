import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import YAML from 'yaml';
import {titleMatchesAlias,validateCreateIdentity,validateIdentityRequest,identityDigest,validateResolutionProof,existingTargetCandidates,closeManagedPage} from '../publishing/target-resolution-gate.mjs';

test('food target identity is mandatory for new direct SP1 sources',()=>{
  const post={id:'direct-chenpi-20261013',category:'음식',contentStandard:'SP1',title:'진피 효능과 먹는 법'};
  assert.throws(()=>validateCreateIdentity(post,null),/E_TARGET_IDENTITY_REQUIRED/);
  assert.doesNotThrow(()=>validateCreateIdentity(post,{sourceId:post.id,operation:'create',topic:'진피',aliases:['진피차','말린 귤껍질','Chenpi'],reviewed:true,proposedTitle:post.title}));
});

test('pre-authoring proof must match the exact reviewed request and say new',()=>{
  const identity=validateIdentityRequest({sourceId:'direct-chenpi-20261013',operation:'create',topic:'진피',aliases:['진피차','말린 귤껍질'],reviewed:true,proposedTitle:'진피 효능과 먹는 법'});
  const proof={sourceId:identity.sourceId,requestDigest:identityDigest(identity),decision:'new',scanned:374,candidates:[]};
  assert.equal(validateResolutionProof(identity,proof).decision,'new');
  assert.throws(()=>validateResolutionProof(identity,{...proof,requestDigest:'0'.repeat(64)}),/E_TARGET_RESOLUTION_RESULT_MISMATCH/);
  assert.throws(()=>validateResolutionProof(identity,{...proof,decision:'existing_candidate',candidates:[{id:'427'}]}),/E_TARGET_EXISTING_CANDIDATE/);
});

test('topic matching uses boundaries so short food names do not collide with compounds',()=>{
  assert.equal(titleMatchesAlias('밤 칼로리·보관법','밤'),true);
  assert.equal(titleMatchesAlias('밤고구마 칼로리','밤'),false);
  assert.equal(titleMatchesAlias('진피차 먹는 법','진피차'),true);
  assert.equal(titleMatchesAlias('Chenpi 효능과 먹는 법','chenpi'),true);
});

test('existing candidates include exact title and reviewed topic aliases',()=>{
  const post={title:'진피 효능과 먹는 법'};
  const identity={topic:'진피',aliases:['진피차','말린 귤껍질']};
  const items=[
    {id:11,title:'생강 효능과 먹는 법',visibility:'PUBLIC'},
    {id:12,title:'진피차 효능·먹는 법',visibility:'PUBLIC'},
    {id:13,title:'진피 효능과 먹는 법',visibility:'PRIVATE'}
  ];
  assert.deepEqual(existingTargetCandidates(items,post,identity).map(x=>x.id),['12','13']);
});

test('manager page cleanup is bounded when Playwright close never settles',async()=>{
  let calls=0;
  await closeManagedPage({close:()=>{calls+=1;return new Promise(()=>{});}},{timeoutMs:5});
  assert.equal(calls,1);
});

test('runtime target gate exits after cleanup so residual CDP handles cannot stall the mutation queue',()=>{
  const source=readFileSync(new URL('../publishing/target-resolution-gate.mjs',import.meta.url),'utf8');
  assert.match(source,/\.then\(\(\)=>setTimeout\(\(\)=>process\.exit\(0\),0\)\)/);
  assert.match(source,/setTimeout\(\(\)=>process\.exit\(1\),0\)/);
});

test('pre-authoring resolver workflow is read-only to Tistory and persists decision evidence',()=>{
  const workflow=YAML.parse(readFileSync('.github/workflows/resolve-target.yml','utf8').replace(/^\uFEFF/,''));
  assert.deepEqual(workflow.on.push.paths,['authoring/target-resolution/**']);
  const steps=workflow.jobs.resolve.steps;
  assert.ok(steps.some(step=>step.run==='node publishing/auth-preflight.mjs'));
  assert.ok(steps.some(step=>step.run==='node publishing/resolve-target-readonly.mjs'));
  assert.ok(!steps.some(step=>/publishing\/publish\.mjs|pnpm run publish|publishing\/update\.mjs|pnpm run update/.test(String(step.run||''))));
});

test('publish workflow requires target proof and runtime recheck before the only submit attempt',()=>{
  const workflow=YAML.parse(readFileSync('.github/workflows/publish-posts.yml','utf8').replace(/^\uFEFF/,''));
  const steps=workflow.jobs.publish.steps;
  const target=steps.findIndex(step=>step.run==='node publishing/target-resolution-gate.mjs');
  const publish=steps.findIndex(step=>step.id==='publish-attempt');
  const recover=steps.findIndex(step=>step.run==='node publishing/recover-publication.mjs');
  assert.ok(target>=0&&publish>target&&recover>publish);
  assert.equal(steps[publish]['continue-on-error'],true);
  assert.match(String(steps[recover].if),/publish-attempt\.outcome == 'failure'/);
});
