import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'yaml';
import {validateQueue,requestDigest,sourceIdFor,statePath,chooseItem,completedEvidence,findPendingSources,validateBundle,tick} from '../automation/update-queue-core.mjs';
import {currentTitle} from '../automation/update-producer.mjs';
import {licensedPhotos} from '../automation/producer-media.mjs';
import {QueueRepository} from '../automation/update-queue-github.mjs';
import {readableMain,withImages,assessmentSchema,verifiedIdentity} from '../automation/producer-model.mjs';
const item={id:'rewrite-327-r1',keyword:'가지',url:'https://nhunnhun.tistory.com/327',domain:'food',category:'음식',revision:'r1-20261007',approved:true};
const queue={version:1,items:[item]};
const source={id:sourceIdFor(item),articleId:'327',targetUrl:item.url,expectedCurrentTitle:'가지',title:'가지 보관법',category:'음식',contentStandard:'R1',bodyHtml:'<p>테스트</p>',status:'ready',approved:true,representativeImageUrl:'https://example.org/test.jpg'};
const bundle={requestDigest:requestDigest(item),source,review:{domain:'food'}};
test('독립 검토는 pending를 반환할 수 없는 schema, 식물명은 조회 근거가 있을 때만 보강',()=>{
  const schema=assessmentSchema();
  for(const key of schema.properties.checks.required) assert.deepEqual(schema.properties.checks.properties[key].properties.status.enum,['pass','blocked']);
  assert.ok(!verifiedIdentity(item,{sources:[]}).includes('Solanum melongena'));
  assert.ok(verifiedIdentity(item,{sources:[{notes:'eggplant (Solanum melongena)'}]}).includes('먹는 부분은 열매'));
});
test('실제 API의 새 thumbnail host를 허용하고 라이선스·author·외부 host 누락은 제외',()=>{
  const page={title:'File:Eggplant.jpg',imageinfo:[{mime:'image/jpeg',thumburl:'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Eggplant.jpg/960px-Eggplant.jpg?utm_source=commons',descriptionurl:'https://commons.wikimedia.org/wiki/File:Eggplant.jpg',extmetadata:{Artist:{value:'<a>Author</a>'},LicenseShortName:{value:'CC BY-SA 4.0'}}}]};
  const data={query:{pages:{one:page}}};
  assert.equal(licensedPhotos(data).length,1);assert.ok(!licensedPhotos(data)[0].src.includes('?'));assert.equal(licensedPhotos(data)[0].author,'Author');
  page.imageinfo[0].extmetadata.LicenseShortName.value='All rights reserved';assert.equal(licensedPhotos(data).length,0);
  page.imageinfo[0].extmetadata.LicenseShortName.value='CC0';page.imageinfo[0].thumburl='https://example.org/private.jpg';assert.equal(licensedPhotos(data).length,0);
});
test('조사 본문에서 nav/script를 제외, 미검토 이미지 삽입 거부',()=>{
  assert.equal(readableMain('<body><nav>menu</nav><main><p>Actual facts</p><script>instructions()</script></main></body>'),'Actual facts');
  assert.throws(()=>withImages('<img src="https://example.org/a.jpg">',[]),/E_PRODUCER_UNREVIEWED_IMAGE/);
});
function fakeRepo(records={}) {
  let dispatched=0,submitted=0;
  return {records,counts:()=>({dispatched,submitted}),read:async path=>records[path]??null,save:async(path,value)=>{records[path]=value;},updateRuns:async()=>[],operationalSources:async()=>({sources:[],ledgers:{}}),submit:async(i,b,p,s)=>{submitted++;records[statePath(i)]=s;},dispatch:async()=>{dispatched++;}};
}
test('URL·카테고리·중복을 검증하고 수정 108건을 허용',()=>{
  const many={version:1,items:Array.from({length:108},(_,i)=>({...item,id:`rewrite-${i}-r1`,url:`https://nhunnhun.tistory.com/${i+1}`}))};
  assert.equal(validateQueue(many).items.length,108);
  assert.throws(()=>validateQueue({...queue,items:[item,item]}),/E_QUEUE_ITEM/);
  assert.throws(()=>validateQueue({...queue,items:[{...item,url:'https://other.tistory.com/327'}]}),/E_QUEUE_ITEM/);
  assert.throws(()=>validateQueue({...queue,items:[{...item,category:'질병'}]}),/E_QUEUE_ITEM/);
});
test('done은 같은 요청 revision에만 SKIP하고 미승인 항목은 선택 안 함',()=>{
  assert.equal(chooseItem(queue,{[item.id]:{phase:'done',requestDigest:requestDigest(item)}}),null);
  assert.ok(chooseItem({version:1,items:[{...item,revision:'r1-20261008'}]},{[item.id]:{phase:'done',requestDigest:requestDigest(item)}}));
  assert.equal(chooseItem({version:1,items:[{...item,approved:false}]},{}),null);
});
test('공개 완료는 URL·fingerprint·source SHA·workflow 성공 모두 필요',()=>{
  const state={requestDigest:requestDigest(item),fingerprint:'abc'};
  const ledger={phase:'updated',url:item.url,fingerprint:'abc',sourceCommit:'commit',verification:'anonymous_full_body_editorial_pc_mobile'};
  const run={head_sha:'commit',event:'workflow_dispatch',status:'completed',conclusion:'success'};
  assert.equal(completedEvidence(item,state,ledger,run),true);
  for(const change of [{fingerprint:'other'},{phase:'submitting'},{url:'https://nhunnhun.tistory.com/328'},{verification:''}]) assert.equal(completedEvidence(item,state,{...ledger,...change},run),false);
  assert.equal(completedEvidence(item,state,ledger,{...run,conclusion:'failure'}),false);
});
test('현재 공개 제목은 정확한 h1 한 개가 있어야 함',()=>{
  assert.equal(currentTitle('<h1>가지 &amp; 보관</h1>'),'가지 & 보관');
  assert.throws(()=>currentTitle('<h1>로그인</h1><h1>다른 제목</h1>'),/E_QUEUE_PUBLIC_TITLE/);
});
test('실제 검토 없는 source는 제출 불가',()=>{
  assert.throws(()=>validateBundle(item,{...bundle,source:{...source,status:'draft',approved:false}}),/E_UPDATE_APPROVAL/);
  assert.throws(()=>validateBundle(item,{...bundle,source:{...source,targetUrl:'https://nhunnhun.tistory.com/328'}}),/E_QUEUE_SOURCE_TARGET/);
});
test('Producer 검토 실패는 BLOCKED 저장, 다음 실행은 재생성하지 않음',async()=>{
  const repo=fakeRepo();let attempts=0;
  const produce=async()=>{attempts++;throw Error('E_IMAGE_REVIEW_REQUIRED');};
  const first=await tick({queue,repo,produce,runId:'1'});
  const second=await tick({queue,repo,produce,runId:'2'});
  assert.equal(first.status,'BLOCKED');assert.equal(second.status,'BLOCKED');assert.equal(attempts,1);assert.equal(repo.counts().dispatched,0);
});
test('한 건만 원자 제출·명시 dispatch, 성공 증거 확인 후 다음 tick에서 done',async()=>{
  const repo=fakeRepo();
  const result=await tick({queue,repo,produce:async()=>bundle,validate:(i,b)=>b,runId:'1'});
  assert.equal(result.status,'RUNNING');assert.deepEqual(repo.counts(),{submitted:1,dispatched:1});
  const record=repo.records[statePath(item)];
  repo.records[`publishing/update-state/${source.id}.json`]={phase:'updated',fingerprint:record.fingerprint,url:item.url,sourceCommit:'actual-sha',verification:'anonymous_checked'};
  repo.updateRuns=async()=>[{id:10,head_sha:'actual-sha',event:'workflow_dispatch',status:'completed',conclusion:'success'}];
  assert.equal((await tick({queue,repo,produce:async()=>{throw Error('should not generate');},runId:'2'})).status,'DONE');
  assert.equal(repo.records[statePath(item)].phase,'done');assert.deepEqual(repo.counts(),{submitted:1,dispatched:1});
});
test('dispatch 응답이 불확실하면 재제출하지 않음',async()=>{
  const repo=fakeRepo();repo.dispatch=async()=>{throw Error('network');};
  assert.equal((await tick({queue,repo,produce:async()=>bundle,validate:(i,b)=>b,runId:'1'})).error,'E_QUEUE_DISPATCH_STATE_UNKNOWN');
  assert.equal((await tick({queue,repo,produce:async()=>{throw Error('should not generate');},runId:'2'})).status,'RUNNING');
  assert.equal(repo.counts().submitted,1);
});
test('consumer가 ledger 작성 전 실패해도 제출 commit으로 실패를 찾음',async()=>{
  const repo=fakeRepo({[statePath(item)]:{phase:'dispatching',requestDigest:requestDigest(item),sourceId:source.id,submittedAt:new Date().toISOString()}});
  repo.submissionCommit=async()=> 'submitted-sha';
  repo.updateRuns=async()=>[{id:12,head_sha:'submitted-sha',event:'workflow_dispatch',status:'completed',conclusion:'failure'}];
  const result=await tick({queue,repo,produce:async()=>{throw Error('should not generate');},runId:'2'});
  assert.equal(result.error,'E_QUEUE_CONSUMER_FAILED');assert.equal(repo.records[statePath(item)].consumerRunId,12);
});
test('진행 중 수정 workflow가 있으면 main checkpoint도 쓰지 않음',async()=>{
  const repo=fakeRepo();repo.updateRuns=async()=>[{status:'in_progress'}];
  const result=await tick({queue,repo,produce:async()=>{throw Error('should not generate');},runId:'1'});
  assert.equal(result.status,'RUNNING');assert.deepEqual(repo.records,{});
});
test('다른 pending source는 새 Queue 제출을 막음',async()=>{
  const repo=fakeRepo();repo.operationalSources=async()=>({sources:[source],ledgers:{}});
  const result=await tick({queue,repo,produce:async()=>{throw Error('should not generate');},runId:'1'});
  assert.equal(result.error,'E_QUEUE_OTHER_UPDATE_PENDING');assert.equal(findPendingSources([source],{}).length,1);
});
test('예약은 GitHub cron, Windows CMD·공통 mutex·actions write로 기존 workflow만 dispatch',()=>{
  const yaml=parse(readFileSync(new URL('../.github/workflows/content-update-queue.yml',import.meta.url),'utf8'));
  assert.ok(yaml.on.schedule[0].cron);assert.equal(yaml.jobs.producer.defaults.run.shell,'cmd');
  assert.equal(yaml.jobs.producer.concurrency.group,'nhunnhun-tistory-mutation');assert.equal(yaml.jobs.producer.permissions.actions,'write');
});
test('GitHub 제출은 source/review/checkpoint 한 commit, 완료 source archive, force 금지',async()=>{
  const repo=new QueueRepository({GITHUB_REPOSITORY:'ansqhd5774-Choi/nhunnhun_blog',GITHUB_TOKEN:'fixture-not-a-secret'});
  repo.operationalSha='current';
  const calls=[];
  repo.api=async(path,options={})=>{
    calls.push({path,...options});
    if(path==='git/ref/heads/main') return {object:{sha:'current'}};
    if(path==='git/commits/current') return {tree:{sha:'base-tree'}};
    if(path==='git/trees') return {sha:'new-tree'};
    if(path==='git/commits') return {sha:'new-commit'};
  };
  const previous={...source,id:'prior-completed-source'};
  repo.read=async path=>path.startsWith('updates/')?previous:{version:'R1'};
  await repo.submit(item,bundle,[previous],{phase:'dispatching'});
  const tree=calls.find(c=>c.path==='git/trees').body.tree;
  assert.ok(tree.some(t=>t.path==='automation/update-source-archive/prior-completed-source.json'));
  assert.ok(tree.some(t=>t.path===`updates/${source.id}.json`));
  assert.ok(tree.some(t=>t.path===`content-reviews/updates/${source.id}.json`));
  assert.ok(tree.some(t=>t.path===statePath(item)));
  assert.ok(!tree.some(t=>t.path.startsWith('publishing/')));
  assert.deepEqual(calls.at(-1).body,{sha:'new-commit',force:false});
});
test('생성 중 main이 바뀌면 제출 전 중단',async()=>{
  const repo=new QueueRepository({GITHUB_REPOSITORY:'ansqhd5774-Choi/nhunnhun_blog',GITHUB_TOKEN:'fixture-not-a-secret'});
  repo.operationalSha='old';repo.api=async()=>({object:{sha:'new'}});
  await assert.rejects(repo.submit(item,bundle,[],{}),/E_QUEUE_SOURCE_DRIFT/);
});
