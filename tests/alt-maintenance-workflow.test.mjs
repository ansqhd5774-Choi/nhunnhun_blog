import test from 'node:test';
import assert from 'node:assert/strict';
import {maintenanceHash as sha,ALT_OPERATION} from '../publishing/alt-maintenance-contract.mjs';
import {checkUpdateSource,updateFingerprint,eligibleUpdate} from '../publishing/update-core.mjs';
import {runAltMaintenance} from '../publishing/alt-maintenance-runner.mjs';
import {assertAltPublicSnapshot,finalizeAltMaintenance,assertAltBaselineMetadata} from '../publishing/alt-maintenance-public.mjs';
const original='<p>원문 그대로</p><img src="https://example.org/photo" alt="">';
const metadata={title:'기존 음식 제목',category:'음식',tags:['음식'],representativeImage:'background-image: url("existing")',visibility:'20'};
function source(){return {id:'repair-alt-331-20261010',articleId:'331',targetUrl:'https://nhunnhun.tistory.com/331',expectedCurrentTitle:metadata.title,title:metadata.title,status:'ready',approved:true,operation:ALT_OPERATION,
  maintenance:{operation:ALT_OPERATION,articleId:'331',expectedTitle:metadata.title,expectedBodySha256:sha(original),expectedMetadataSha256:sha(JSON.stringify(metadata)),patches:[{imageIndex:0,expectedSrcSha256:sha('https://example.org/photo'),expectedAltRaw:'',newAlt:'과일과 곡물을 올린 컵 디저트'}]}};}
function fixture(options={}){
  const calls=[],s=source();let staged=original,state=options.state??null,observations=0;
  const locator=selector=>({count:async()=>1,isEnabled:async()=>true,and(){return this;},waitFor:async()=>{},click:async()=>{calls.push(selector);if(selector==='공개 발행'&&options.clickError)throw Error('network uncertain');},evaluate:async()=>staged});
  const page={locator,getByRole:(_,{name})=>locator(name),keyboard:{press:async()=>{},insertText:async value=>{calls.push('stage');staged=value;}}};
  const deps={page,source:s,originalHtml:original,selectMode:async()=>{},ledger:{read:async()=>state,write:async(_,value)=>{calls.push('checkpoint');state=value;}},assertSource:()=> 'source-sha',
    capturePublicBaseline:async()=>{calls.push('baseline');if(options.baselineError)throw Error('E_ALT_PUBLIC_ACCESS');return {version:'alt-public-baseline-v1'};},
    finalize:async()=>{calls.push('verify');return {status:'PUBLIC_VERIFIED'};},prepare:async()=>{},open:async()=>{},
    observe:async()=>{observations++;const m=options.metadataDrift&&observations===2?{...metadata,tags:['다른 태그']}:metadata;return {metadata:m,sha256:sha(JSON.stringify(m))};},log:()=>{}};
  return {deps,calls,getState:()=>state};
}
test('explicit operation accepts only unchanged title and full hashed preconditions',()=>{
  const s=source();assert.equal(checkUpdateSource(s,s.id+'.json'),s);
  assert.throws(()=>checkUpdateSource({...s,bodyHtml:'arbitrary'},s.id+'.json'),/SOURCE_SCHEMA/);
  assert.throws(()=>checkUpdateSource({...s,title:'다른 제목'},s.id+'.json'),/SOURCE_TARGET/);
  assert.notEqual(updateFingerprint(s),updateFingerprint({...s,maintenance:{...s.maintenance,expectedBodySha256:sha('drift')}}));
  assert.throws(()=>eligibleUpdate(s,{phase:'submitting',fingerprint:updateFingerprint(s),url:s.targetUrl}),/EXISTING_STATE/);
});
test('baseline, stage, durable submitting, exactly one final click, then verification',async()=>{
  const f=fixture();assert.equal((await runAltMaintenance(f.deps)).status,'PUBLIC_VERIFIED');
  assert.deepEqual(f.calls,['취소','baseline','.CodeMirror:visible .CodeMirror-code','stage','checkpoint','공개 발행','verify']);
  assert.equal(f.getState().phase,'submitting');assert.equal(f.getState().operation,ALT_OPERATION);
});
test('unavailable public baseline prevents staging and checkpoint',async()=>{
  const f=fixture({baselineError:true});await assert.rejects(runAltMaintenance(f.deps),/PUBLIC_ACCESS/);
  assert.deepEqual(f.calls,['취소','baseline']);assert.equal(f.getState(),null);
});
test('metadata drift after staging prevents final submission and checkpoint',async()=>{
  const f=fixture({metadataDrift:true});await assert.rejects(runAltMaintenance(f.deps),/METADATA_DRIFT/);
  assert.ok(!f.calls.includes('checkpoint'));assert.ok(!f.calls.includes('공개 발행'));
});
test('a private/protected editor cannot use this public maintenance operation',async()=>{
  const f=fixture();f.deps.observe=async()=>({metadata:{...metadata,visibility:'0'},sha256:'private'});
  await assert.rejects(runAltMaintenance(f.deps),/PUBLIC_VISIBILITY_REQUIRED/);
  assert.deepEqual(f.calls,[]);assert.equal(f.getState(),null);
});
test('uncertain final click remains submitting, has no retry, and next run is blocked',async()=>{
  const f=fixture({clickError:true});await assert.rejects(runAltMaintenance(f.deps),/uncertain/);
  assert.equal(f.getState().phase,'submitting');assert.equal(f.calls.filter(x=>x==='공개 발행').length,1);
  await assert.rejects(runAltMaintenance(f.deps),/EXISTING_STATE/);assert.equal(f.calls.filter(x=>x==='공개 발행').length,1);
});
const base={bodySha256:sha('body'),metadataSha256:sha('metadata'),images:[{srcSha256:sha('photo'),altSha256:sha(JSON.stringify('')),loaded:true}],overflowPx:0};
const expected=[{publicIndex:0,newAlt:'과일과 곡물을 올린 컵 디저트'}];
const good={...base,images:[{...base.images[0],altSha256:sha(JSON.stringify(expected[0].newAlt))}]};
const ledgerConditions={originalBodySha256:sha(original),metadataSha256:sha(JSON.stringify(metadata)),targetBodySha256:sha('staged')};
test('public verification checks preserved body, metadata, all image sources, loading and exact alt',()=>{
  assert.equal(assertAltPublicSnapshot(good,base,expected).changedAlt,1);
  for(const actual of [{...good,bodySha256:sha('different')},{...good,metadataSha256:sha('other')},{...good,images:[{...good.images[0],srcSha256:sha('other')}]},{...good,images:[{...good.images[0],loaded:false}]},base])assert.throws(()=>assertAltPublicSnapshot(actual,base,expected),/E_ALT_PUBLIC_/);
});
test('read-only finalizer updates only matching ledger after desktop and mobile pass',async()=>{
  const s=source();let state={...ledgerConditions,sha:'old',phase:'submitting',operation:s.operation,url:s.targetUrl,fingerprint:updateFingerprint(s),baseline:{version:'alt-public-baseline-v1',desktop:base,mobile:base,patches:expected}};
  const widths=[],ledger={read:async()=>state,write:async(_,r,version)=>{assert.equal(version,'old');state=r;}};
  const r=await finalizeAltMaintenance(s,{ledger,captureSnapshot:async(_,__,width)=>{widths.push(width);return good;}});
  assert.equal(r.status,'PUBLIC_VERIFIED');assert.equal(state.phase,'updated');assert.deepEqual(widths,[1440,390]);
});
test('public mismatch preserves submitting and records mismatch without submitting again',async()=>{
  const s=source();let state={...ledgerConditions,sha:'old',phase:'submitting',operation:s.operation,url:s.targetUrl,fingerprint:updateFingerprint(s),baseline:{version:'alt-public-baseline-v1',desktop:base,mobile:base,patches:expected}};
  const ledger={read:async()=>state,write:async(_,r)=>{state=r;}};
  const r=await finalizeAltMaintenance(s,{ledger,captureSnapshot:async()=>base});assert.equal(r.status,'PUBLIC_VERIFICATION_MISMATCH');assert.equal(state.phase,'submitting');
});
test('anonymous metadata must match editor meaning including original representative asset',()=>{
  const editor={...metadata,representativeImage:'background-image: url("https://blog.kakaocdn.net/photo.png")'};
  const publicMetadata={title:editor.title,category:['음식','/category/food'],tags:[['#음식','/tag/food']],representative:'https://blog.kakaocdn.net/photo.png'};
  assert.doesNotThrow(()=>assertAltBaselineMetadata(publicMetadata,editor));
  for(const changed of [{...publicMetadata,category:['약학','/category/drug']},{...publicMetadata,tags:[['#다른것','/tag/other']]},{...publicMetadata,representative:'https://blog.kakaocdn.net/other.png'}])assert.throws(()=>assertAltBaselineMetadata(changed,editor),/E_ALT_PUBLIC_/);
});
test('ledger cannot substitute a different alt claim or original body condition under the same source fingerprint',async()=>{
  const s=source();
  for(const changed of [{originalBodySha256:sha('other')},{baseline:{version:'alt-public-baseline-v1',desktop:base,mobile:base,patches:[{publicIndex:0,newAlt:'승인하지 않은 다른 문구'}]}}]){
    const state={...ledgerConditions,phase:'submitting',operation:s.operation,url:s.targetUrl,fingerprint:updateFingerprint(s),baseline:{version:'alt-public-baseline-v1',desktop:base,mobile:base,patches:expected},...changed};
    await assert.rejects(finalizeAltMaintenance(s,{ledger:{read:async()=>state,write:async()=>assert.fail('must not write')},captureSnapshot:async()=>assert.fail('must not access')}),/LEDGER_CONDITIONS/);
  }
});
