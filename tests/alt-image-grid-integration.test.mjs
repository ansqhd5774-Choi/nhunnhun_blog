import test from 'node:test';import assert from 'node:assert/strict';
import {draftImageGridAltSource,parseImageGridMacros} from '../publishing/alt-image-grid-contract.mjs';
import {captureAltBaseline} from '../publishing/alt-maintenance-public.mjs';
import {runAltMaintenance} from '../publishing/alt-maintenance-runner.mjs';
import {maintenanceHash as hash} from '../publishing/alt-maintenance-contract.mjs';
const refs=[1,2].map(n=>`kage@asset${n}/folder/version/photo.png`);
const urls=[1,2].map(n=>`https://blog.kakaocdn.net/dna/asset${n}/folder/version/photo.png`);
const attrs='data-is-animation="false" data-origin-width="100" data-origin-height="80" data-filename="fixture.png" data-widthpercent="50" style="width:50%;"';
const html=`<p>원문</p>[##_ImageGrid|${refs.join(',')}|${attrs},${attrs}|설명_##]`;
const metadata={title:'기존 제목',category:'음식',tags:['영양'],representativeImage:`background-image: url("${urls[0]}")`,visibility:'20'};
const source=()=>({...draftImageGridAltSource(html,metadata,{articleId:'342',imageIndex:1,newAlt:'냉장고 내부 공간을 나타낸 그림'},urls,'repair-grid-integration'),status:'ready',approved:true});
function browserFixture(sources=urls){let contexts=0;const loc={count:async()=>sources.length,waitFor:async()=>{},locator:()=>loc,nth:()=>({scrollIntoViewIfNeeded:async()=>{},evaluate:async()=>({loaded:true})})};
 const page={goto:async()=>({ok:()=>true,text:async()=>'<fixture>'}),url:()=>source().targetUrl,locator:selector=>selector==='.contents_style:visible'?{...loc,count:async()=>1}:loc,evaluate:async(fn,arg)=>{
 if(arg?.responseHtml)return {body:'provider-body-without-alt',metadata:{title:metadata.title,representative:urls[0],category:['음식','/category/food'],tags:[['#영양','/tag/nutrition']]},deliveredImages:sources.map(src=>({src,alt:null,filename:'fixture.png'})),images:sources.map(src=>({src,alt:'fixture.png',loaded:true})),editorImages:[],overflowPx:0};
 if(arg?.phase)return {};return {x:0,y:0};}};
 return {browser:{newContext:async()=>{contexts++;return {route:async()=>{},newPage:async()=>page,close:async()=>{}};}},contexts:()=>contexts};}
test('wired public baseline builds Grid asset proof across four anonymous observations and preserves filename fallback',async()=>{
 const f=browserFixture();const base=await captureAltBaseline(f.browser,html,source(),metadata);assert.equal(f.contexts(),4);assert.deepEqual(base.macroMapping.assetSha256s,parseImageGridMacros(html).map(x=>hash(x.asset)));assert.deepEqual(base.patches,[{publicIndex:1,newAlt:source().maintenance.patches[0].newAlt}]);
});
test('wired baseline rejects reordered immutable Grid assets before staging',async()=>{const f=browserFixture([...urls].reverse());await assert.rejects(captureAltBaseline(f.browser,html,source(),metadata),/MACRO_PUBLIC_MAPPING/);});
function runnerFixture(options={}){let staged=html,state=null;const calls=[];const s=source();if(options.bodyDrift)s.maintenance.expectedBodySha256=hash('drift');
 const loc=selector=>({count:async()=>1,isEnabled:async()=>true,and(){return this;},waitFor:async()=>{},click:async()=>calls.push(selector),evaluate:async()=>options.stagedDrift?'changed':staged});
 const deps={page:{locator:loc,getByRole:(_,{name})=>loc(name),keyboard:{press:async()=>{},insertText:async value=>{calls.push('stage');staged=value;}}},source:s,originalHtml:html,selectMode:async()=>{},ledger:{read:async()=>state,write:async(_,v)=>{calls.push('checkpoint');state=v;}},assertSource:()=> 'fixture-commit',capturePublicBaseline:async()=>({macroMapping:{version:'macro-asset-map-v1',assetSha256s:parseImageGridMacros(html).map(x=>hash(x.asset))}}),finalize:async()=>({status:'FIXTURE_ONLY'}),prepare:async()=>{},open:async()=>{},observe:async()=>({metadata,sha256:hash(JSON.stringify(metadata))}),log:()=>{}};return {deps,calls,state:()=>state,staged:()=>staged};}
test('wired runner stages exact Grid alt and retains durable checkpoint before one simulated submit',async()=>{const f=runnerFixture();await runAltMaintenance(f.deps);assert.ok(f.staged().includes('alt="냉장고 내부 공간을 나타낸 그림"'));assert.equal(f.calls.filter(x=>x==='공개 발행').length,1);assert.ok(f.calls.indexOf('checkpoint')<f.calls.indexOf('공개 발행'));assert.equal(f.state().phase,'submitting');});
test('wired runner body precondition drift blocks staging, ledger, and simulated submit',async()=>{const f=runnerFixture({bodyDrift:true});await assert.rejects(runAltMaintenance(f.deps),/BODY_DRIFT/);assert.ok(!f.calls.includes('stage'));assert.equal(f.state(),null);assert.ok(!f.calls.includes('공개 발행'));});
test('wired runner staged-content mismatch blocks ledger and simulated submit',async()=>{const f=runnerFixture({stagedDrift:true});await assert.rejects(runAltMaintenance(f.deps),/STAGED_BODY_DRIFT/);assert.equal(f.state(),null);assert.ok(!f.calls.includes('공개 발행'));});
