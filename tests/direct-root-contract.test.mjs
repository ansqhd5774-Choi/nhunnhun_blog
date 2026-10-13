import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import YAML from 'yaml';
import {directFixture} from './direct-source-fixture.mjs';
import {directPreflight,assertDirectPreflight} from '../publishing/direct-preflight.mjs';
import {hasAuthoritativePreflight} from '../publishing/direct-authoring-contract.mjs';
import {prepareDirectSource} from '../authoring/prepare-direct-source.mjs';
import {preservedSourceBundle} from '../authoring/preserve-direct-source.mjs';
import {confirmGithubSource,sourceDigest} from '../authoring/source-confirmation.mjs';
const commit='a'.repeat(40);
const args=source=>({source,commitSha:commit,token:'fixture',fetcher:async url=>{assert.ok(url.endsWith('?ref='+commit));return {ok:true,json:async()=>({type:'file',encoding:'base64',content:Buffer.from(JSON.stringify(source)).toString('base64')})}}});
test('네 카테고리 저장 전·러너 공통 preflight 결과는 같고 원고를 변경하지 않는다',()=>{
 for(const category of ['음식','영양소','약학','질병']){const s=directFixture({category});const before=JSON.stringify(s);assert.equal(directPreflight(s).status,'PREFLIGHT_PASS');assert.deepEqual(prepareDirectSource(s).report.preflight,assertDirectPreflight(s));assert.equal(JSON.stringify(s),before);}
});
test('visualChecked는 누락·false·true 모두 관찰값으로 허용하며 문자열과 임의 키는 차단한다',()=>{
 for(const value of [undefined,false,true]){const s=directFixture();s.imageReview[0].visualChecked=value;assert.equal(directPreflight(s).status,'PREFLIGHT_PASS');}
 for(const change of [{visualChecked:'true'},{arbitrary:true}]){const s=directFixture();Object.assign(s.imageReview[0],change);assert.ok(directPreflight(s).errors.includes('E_IMAGE_REVIEW_SCHEMA'));}
});
test('저장 전 검사에서 서로 다른 세 오류를 모두 수집하고 임의 자동 교정하지 않는다',()=>{
 const s=directFixture();s.bodyHtml+='<h2>새 핵심 질문</h2><mark><strong>근거가 부족합니다</strong></mark>';s.imageReview[0].unexpected=true;
 const before=JSON.stringify(s),r=directPreflight(s);assert.deepEqual(r.errors,['E_DIRECT_EMPHASIS_LIMITATION','E_DIRECT_FOCUS_SECTION_OVERLOAD','E_IMAGE_REVIEW_SCHEMA']);assert.equal(JSON.stringify(s),before);assert.throws(()=>assertDirectPreflight(s),/E_DIRECT_EMPHASIS_LIMITATION/);
});
test('근거 한계 일반 문장은 유지하고 유틸리티 H2는 핵심 개수에서 제외한다',()=>{
 const s=directFixture();s.bodyHtml+='<h2>FAQ</h2><p>근거가 부족합니다.</p><h2>핵심 정리</h2><p>실천 요약</p>';assert.equal(directPreflight(s).status,'PREFLIGHT_PASS');
});
test('실패 원고도 전체 JSON과 동일 digest로 보존하며 저장 성공이나 발행으로 위장하지 않는다',()=>{
 const s=directFixture();s.imageReview[0].unexpected=true;const b=preservedSourceBundle(s);assert.deepEqual(b.source,s);assert.equal(b.receipt.sourceDigest,sourceDigest(s));assert.equal(b.receipt.preflight.status,'FAIL');assert.equal(b.receipt.githubState,'NOT_CONFIRMED');assert.equal(b.receipt.finalSubmitCount,0);
});
test('Gate 0는 commit에 고정된 실제 파일 전체를 확인한다',async()=>{
 const s=directFixture();const r=await confirmGithubSource(args(s));assert.equal(r.status,'GITHUB_SOURCE_CONFIRMED');assert.equal(r.commitSha,commit);assert.equal(r.sourceDigest,sourceDigest(s));
});
test('Gate 0는 파일 부재·조회 실패·원고 불일치·부정확 응답을 구분한다',async()=>{
 const s=directFixture();for(const [fetcher,code] of [[async()=>({ok:false,status:404}),'E_SOURCE_NOT_CONFIRMED'],[async()=>{throw Error('sensitive detail')},'E_SOURCE_CONFIRM_UNAVAILABLE'],[async()=>({ok:true,json:async()=>({type:'file',encoding:'base64',content:Buffer.from(JSON.stringify({...s,title:'다른 글'})).toString('base64')})}),'E_SOURCE_CONFIRM_MISMATCH'],[async()=>({ok:true,json:async()=>({})}),'E_SOURCE_CONFIRM_INVALID']])await assert.rejects(confirmGithubSource({...args(s),fetcher}),new RegExp(code));
});
test('동일 commit의 JSON 키 순서 차이는 저장 내용 불일치가 아니다',()=>{
 const s=directFixture();assert.equal(sourceDigest(s),sourceDigest(Object.fromEntries(Object.entries(s).reverse())));
});
test('모든 실제 제출·복구·관찰 공통 잠금은 pending 교체를 막는 queue max를 사용한다',async()=>{
 for(const file of ['publish-posts.yml','update-posts.yml','direct-author-update.yml','recover-publication.yml','observe-alt-maintenance.yml']){
 const w=YAML.parse(await readFile('.github/workflows/'+file,'utf8'));const groups=[w.concurrency,...Object.values(w.jobs).map(j=>j.concurrency)].filter(c=>c&&/nhunnhun-(tistory-(mutation|update)|direct-source-dispatch)/.test(c.group));assert.ok(groups.length);for(const c of groups){assert.equal(c.queue,'max');assert.equal(c['cancel-in-progress'],false);}}
});
test('권위 preflight 재사용은 GitHub Actions의 정확히 같은 SHA에서만 허용한다',()=>{
 const sha='b'.repeat(40);assert.equal(hasAuthoritativePreflight({GITHUB_ACTIONS:'true',GITHUB_SHA:sha,AUTHORITATIVE_PREFLIGHT_SHA:sha}),true);assert.equal(hasAuthoritativePreflight({GITHUB_ACTIONS:'true',GITHUB_SHA:sha,AUTHORITATIVE_PREFLIGHT_SHA:'c'.repeat(40)}),false);assert.equal(hasAuthoritativePreflight({GITHUB_ACTIONS:'false',GITHUB_SHA:sha,AUTHORITATIVE_PREFLIGHT_SHA:sha}),false);
 const old={GITHUB_ACTIONS:process.env.GITHUB_ACTIONS,GITHUB_SHA:process.env.GITHUB_SHA,AUTHORITATIVE_PREFLIGHT_SHA:process.env.AUTHORITATIVE_PREFLIGHT_SHA};
 try{process.env.GITHUB_ACTIONS='true';process.env.GITHUB_SHA=sha;process.env.AUTHORITATIVE_PREFLIGHT_SHA=sha;const s=directFixture();s.imageReview[0].unexpected=true;assert.equal(directPreflight(s).status,'PREFLIGHT_REUSED');process.env.AUTHORITATIVE_PREFLIGHT_SHA='c'.repeat(40);assert.equal(directPreflight(s).status,'FAIL');}finally{for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('신규·수정 워크플로는 검증 후 동일 SHA 결과를 재사용하고 최초 검증은 단일 preflight다',async()=>{
 const publishWorkflow=YAML.parse(await readFile('.github/workflows/publish-posts.yml','utf8'));
 const prep=publishWorkflow.jobs.validate.steps.find(s=>s.run?.startsWith('node authoring/prepare-selected-source.mjs'));
 const submit=publishWorkflow.jobs.publish.steps.find(s=>s.run==='pnpm run publish');
 assert.equal(prep.env.AUTHORITATIVE_PREFLIGHT_SHA,'${{ github.sha }}');assert.equal(submit.env.AUTHORITATIVE_PREFLIGHT_SHA,'${{ github.sha }}');
 const updateWorkflow=YAML.parse(await readFile('.github/workflows/update-posts.yml','utf8'));
 const updatePrep=updateWorkflow.jobs.update.steps.find(s=>s.run?.startsWith('node authoring/prepare-selected-source.mjs'));
 const updateSubmit=updateWorkflow.jobs.update.steps.find(s=>s.run==='pnpm run update');
 assert.equal(updatePrep.env.AUTHORITATIVE_PREFLIGHT_SHA,'${{ github.sha }}');assert.equal(updateSubmit.env.AUTHORITATIVE_PREFLIGHT_SHA,'${{ github.sha }}');
 const validate=await readFile('publishing/validate.mjs','utf8');assert.match(validate,/directPreflight\(post\)/);assert.doesNotMatch(validate,/assertImageReview\(post\)/);assert.doesNotMatch(validate,/assertDirectPreflight\(post\)/);
 const prepare=await readFile('authoring/prepare-selected-source.mjs','utf8');assert.match(prepare,/hasAuthoritativePreflight\(\)/);assert.match(prepare,/if\(!reused\)assertDirectPreflight\(source\)/);
});
