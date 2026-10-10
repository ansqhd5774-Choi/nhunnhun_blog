import test from 'node:test';
import assert from 'node:assert/strict';
import {maintenanceHash as hash} from '../publishing/alt-maintenance-contract.mjs';
import {nativeImages,nativePlainText,nativeTextSlots,applyNativeTextMaintenance,checkNativeTextSource,nativeTextFingerprint} from '../publishing/native-text-contract.mjs';
import {assertNativeTextSnapshot,finalizeNativeTextMaintenance} from '../publishing/native-text-public.mjs';
import {runNativeTextMaintenance} from '../publishing/native-text-runner.mjs';
import {nativeTextStructureHash} from '../publishing/native-text-structure.mjs';
import {draftNativeEmptyCleanup,applyNativeEmptyCleanup,applyNativeCaptionFix} from '../publishing/native-text-cleanup.mjs';
import {expectedNativeProviderTarget} from '../publishing/native-text-provider-target.mjs';
const html='<style>.x{color:red}</style><h2>Old</h2><p><b>Wrong</b> &amp; definition</p>[##_Image|kage@a/b/c/test.png|CDM|1.3|{"caption":"Picture","alt":"Existing"}_##]';
const meta={title:'Old',category:'음식',tags:['x'],representativeImage:'fixture',visibility:'20'};
function fixture(){const slot=nativeTextSlots(html).find(x=>x.raw==='Wrong');const target=html.slice(0,slot.start)+'Correct'+html.slice(slot.start+slot.length);const maintenance={operation:'native-text-surgical-v1',articleId:'236',expectedTitle:'Old',targetTitle:'New',expectedBodySha256:hash(html),expectedMetadataSha256:hash(JSON.stringify(meta)),expectedPublicTextSha256:hash(nativePlainText(html)),targetPublicTextSha256:hash(nativePlainText(target)),cleanupPatches:[],captionPatches:[],patches:[{start:slot.start,length:slot.length,expectedTextSha256:hash(slot.raw),newText:'Correct'}]};const source={id:'repair-native-test',articleId:'236',targetUrl:'https://nhunnhun.tistory.com/236',expectedCurrentTitle:'Old',title:'New',status:'ready',approved:true,operation:maintenance.operation,maintenance};const proof={version:'native-text-assets-v1',assetSha256s:nativeImages(html).map(x=>hash(x.asset))};return {source,proof,target};}
test('exact text replacement preserves style, markup, entities and opaque image macro bytes',()=>{const {source,proof,target}=fixture();const out=applyNativeTextMaintenance(html,meta,source.maintenance,proof);assert.equal(out.targetHtml,target);assert.equal(out.publicationEnabled,false);assert.equal(checkNativeTextSource(source,source.id+'.json'),source);});
for(const [name,change,code]of [
 ['body drift',f=>f.body=html+' ','E_TEXT_BODY_DRIFT'],
 ['metadata drift',f=>f.meta={...meta,tags:['other']},'E_TEXT_METADATA_DRIFT'],
 ['asset mismatch',f=>f.proof.assetSha256s=[hash('other')],'E_TEXT_PUBLIC_MAPPING'],
 ['text hash drift',f=>f.source.maintenance.patches[0].expectedTextSha256=hash('other'),'E_TEXT_SLOT_DRIFT'],
 ['attribute patch forbidden',f=>{f.source.maintenance.patches[0].start=html.indexOf('color');},'E_TEXT_SLOT_DRIFT'],
 ['expected text mismatch',f=>f.source.maintenance.expectedPublicTextSha256=hash('other'),'E_TEXT_EXPECTED_TEXT'],
 ['target text mismatch',f=>f.source.maintenance.targetPublicTextSha256=hash('other'),'E_TEXT_DIFF'],
 ['macro token injection',f=>f.source.maintenance.patches[0].newText='[##_Image|x','E_TEXT_PATCH_CONDITIONS'],
 ['out of scope article',f=>f.source.maintenance.articleId='264','E_TEXT_SOURCE_CONDITIONS'],
 ['overlapping patches',f=>f.source.maintenance.patches.push({...f.source.maintenance.patches[0]}),'E_TEXT_PATCH_CONDITIONS']
])test(name,()=>{const f={...fixture(),body:html,meta};change(f);assert.throws(()=>applyNativeTextMaintenance(f.body,f.meta,f.source.maintenance,f.proof),new RegExp(code));});
test('draft source cannot be executed',()=>{const {source}=fixture();source.status='draft';source.approved=false;assert.throws(()=>checkNativeTextSource(source,source.id+'.json'),/E_UPDATE_APPROVAL/);});
test('image-caption slot is never mutable',()=>{assert.equal(nativeTextSlots(html).some(x=>x.raw.includes('Picture')),false);});
test('unknown or unmatched native macro rejects',()=>{assert.throws(()=>nativeImages(html+'[##_Grid|x_##]'),/UNSUPPORTED/);assert.throws(()=>nativeImages(html+'[##_broken'),/ASSETS/);});
const image={assetSha256:hash('asset'),altSha256:hash('alt'),loaded:true};
const snap={publicTextSha256:hash('text'),publicTextStructureSha256:hash('structure'),metadataSha256:hash('meta'),overflowPx:0,images:[image]};
test('public exact text and metadata required; unchanged images and alt required',()=>{assertNativeTextSnapshot(snap,snap,hash('text'),hash('meta'));for(const s of [{...snap,publicTextSha256:hash('wrong')},{...snap,metadataSha256:hash('wrong')},{...snap,overflowPx:1},{...snap,images:[{...image,altSha256:hash('new')}]},{...snap,images:[{...image,loaded:false}]}])assert.throws(()=>assertNativeTextSnapshot(s,snap,hash('text'),hash('meta')),/E_TEXT_PUBLIC/);});
test('read-only finalizer requires exact source-bound ledger and preserves submitting on mismatch',async()=>{const {source,proof}=fixture();const baseline={version:'native-text-public-baseline-v1',desktop:{...snap,images:[{...image,assetSha256:proof.assetSha256s[0]}]},mobile:{...snap,images:[{...image,assetSha256:proof.assetSha256s[0]}]},assetMapping:proof,targetMetadataSha256:hash('meta')};let state={phase:'submitting',operation:source.operation,fingerprint:nativeTextFingerprint(source),url:source.targetUrl,originalBodySha256:source.maintenance.expectedBodySha256,originalMetadataSha256:source.maintenance.expectedMetadataSha256,expectedPublicTextSha256:source.maintenance.targetPublicTextSha256,targetBodySha256:hash('target'),baseline,sha:'fixture'};const ledger={read:async()=>state,write:async(_id,v)=>state=v};const result=await finalizeNativeTextMaintenance(source,{ledger,browser:{},captureSnapshot:async()=>baseline.desktop});assert.equal(result.status,'PUBLIC_VERIFICATION_MISMATCH');assert.equal(state.phase,'submitting');state.originalBodySha256=hash('changed');await assert.rejects(()=>finalizeNativeTextMaintenance(source,{ledger,browser:{}}),/E_TEXT_LEDGER_CONDITIONS/);});
function runnerFixture(){const f=fixture();let staged=html,title='Old',state=null,clicks=0;const options={source:f.source,originalHtml:html,log:()=>{},selectMode:async()=>{},assertSource:()=> 'fixture-sha',prepare:async()=>{},open:async()=>{},cancel:async()=>{},observe:async()=>({metadata:{...meta,title},sha256:hash(JSON.stringify({...meta,title}))}),capturePublicBaseline:async()=>({assetMapping:f.proof}),ledger:{read:async()=>state,write:async(_id,v)=>{state=v;}},finalize:async()=>({status:'PUBLIC_VERIFIED'}),control:async()=>({click:async()=>{assert.equal(state.phase,'submitting');clicks++;}}),page:{keyboard:{press:async()=>{},insertText:async v=>{staged=v;}},locator:selector=>({waitFor:async()=>{},click:async()=>{},evaluate:async()=>staged,fill:async v=>{title=v;}})}};return {options,get clicks(){return clicks;},get state(){return state;}};}
test('runner checkpoints before a single submit and changes title only after staged text proof',async()=>{const f=runnerFixture();assert.equal((await runNativeTextMaintenance(f.options)).status,'PUBLIC_VERIFIED');assert.equal(f.clicks,1);assert.equal(f.state.originalMetadataSha256,f.options.source.maintenance.expectedMetadataSha256);});
test('body precondition failure stages nothing and submits nothing',async()=>{const f=runnerFixture();f.options.originalHtml+=' ';await assert.rejects(()=>runNativeTextMaintenance(f.options),/E_TEXT_BODY_DRIFT/);assert.equal(f.clicks,0);assert.equal(f.state,null);});
test('mode serialization drift immediately before staging prevents all editor input and submission',async()=>{
 const f=runnerFixture();let inputs=0,editorClicks=0,titleWrites=0,modeRead=false;
 f.options.selectMode=async()=>{modeRead=true;};
 f.options.page.keyboard={press:async()=>{inputs++;},insertText:async()=>{inputs++;}};
 f.options.page.locator=()=>({waitFor:async()=>{},click:async()=>{editorClicks++;},evaluate:async()=>{assert.equal(modeRead,true);return html+' ';},fill:async()=>{titleWrites++;}});
 await assert.rejects(()=>runNativeTextMaintenance(f.options),/E_TEXT_PRESTAGE_BODY_DRIFT/);
 assert.equal(inputs,0);assert.equal(editorClicks,0);assert.equal(titleWrites,0);assert.equal(f.clicks,0);assert.equal(f.state,null);
});
test('metadata change at second dialog prevents checkpoint and submit',async()=>{const f=runnerFixture();let n=0;f.options.observe=async()=>({metadata:n++?{...meta,title:'New',tags:['other']}:meta});await assert.rejects(()=>runNativeTextMaintenance(f.options),/E_TEXT_METADATA_DRIFT/);assert.equal(f.clicks,0);assert.equal(f.state,null);});
test('submit exception leaves submitting and never retries final click',async()=>{const f=runnerFixture();let n=0;f.options.control=async()=>({click:async()=>{n++;throw Error('fixture-submit');}});await assert.rejects(()=>runNativeTextMaintenance(f.options),/fixture-submit/);assert.equal(n,1);assert.equal(f.state.phase,'submitting');});
test('public structure permits only renewed signature of identical image asset',()=>{
 const a='<p style="margin:2px"><a href="https://example.org/?v=1"></a><img src="https://blog.kakaocdn.net/dn/a/b/c/img.png?credential=synthetic-old" alt="old" width="40"></p>';
 const b=a.replace('synthetic-old','synthetic-new');
 assert.equal(nativeTextStructureHash(a),nativeTextStructureHash(b));
 for(const changed of [a.replace('/img.png','/other.png'),a.replace('alt="old"','alt="new"'),a.replace('width="40"','width="41"'),a.replace('margin:2px','margin:3px'),a.replace('?v=1','?v=2')])assert.notEqual(nativeTextStructureHash(a),nativeTextStructureHash(changed));
 assert.throws(()=>nativeTextStructureHash(a.replace('blog.kakaocdn.net','example.org')),/E_ALT_MACRO_ASSET/);
});
test('cleanup changes only newly empty wrappers and retains child and style bytes',()=>{
 const original='<p data-ke-size="size16"></p><ol style="list-style-type: decimal;"><li style="color:black"><span style="font-weight:bold">Wrong</span></li></ol>';
 const target=original.replace('Wrong','');const patches=draftNativeEmptyCleanup(original,target);assert.equal(patches.length,4);
 const result=applyNativeEmptyCleanup(original,target,patches);assert.equal(result,'<p data-ke-size="size16"></p><span style="list-style-type: decimal;"><span style="color:black"><span style="font-weight:bold"></span></span></span>');
 assert.throws(()=>applyNativeEmptyCleanup(original,target,[...patches,{...patches[0]}]),/E_TEXT_CLEANUP_CONDITIONS/);
 const protectedOriginal='<p><a href="https://example.org">Wrong</a></p>',protectedTarget=protectedOriginal.replace('Wrong','');assert.throws(()=>draftNativeEmptyCleanup(protectedOriginal,protectedTarget),/E_TEXT_CLEANUP_PROTECTED/);
});
test('caption exception permits only exact 236 first-image Korean identity correction',()=>{
 const old=html.replace('"caption":"Picture"','"caption":"티민(Thymol)"');const images=nativeImages(old);const patch=[{imageIndex:0,expectedCaptionSha256:hash('티민(Thymol)'),newCaption:'티몰(Thymol)'}];
 assert.equal(applyNativeCaptionFix(old,'236',patch,images),old.replace('"caption":"티민(Thymol)"','"caption":"티몰(Thymol)"'));
 assert.throws(()=>applyNativeCaptionFix(old,'233',patch,images),/SCOPE/);assert.throws(()=>applyNativeCaptionFix(old,'236',[{...patch[0],newCaption:'치료 효과'}],images),/SCOPE/);assert.throws(()=>applyNativeCaptionFix(old,'236',[{...patch[0],expectedCaptionSha256:hash('other')}],images),/DRIFT/);
});
test('provider target requires exact block, nested attributes and text-group correspondence',()=>{
 const {source}=fixture();const provider='<style>.x{color:red}</style><h2>Old</h2><p><b>Wrong</b> &amp; definition</p><figure><img src="https://blog.kakaocdn.net/dn/a/b/c/test.png?credential=synthetic"><figcaption>Picture</figcaption></figure>';
 const result=expectedNativeProviderTarget(provider,html,source.maintenance);assert.equal(hash(result.text),source.maintenance.targetPublicTextSha256);assert.equal(result.mappedBlocks,2);
 assert.throws(()=>expectedNativeProviderTarget(provider.replace('<b>','<b style="color:red">'),html,source.maintenance),/E_TEXT_PROVIDER_NODE_ATTRIBUTES/);
 assert.throws(()=>expectedNativeProviderTarget(provider+'<p><b>Wrong</b> &amp; definition</p>',html,source.maintenance),/E_TEXT_PROVIDER_INITIAL_BLOCK_MAPPING/);
 assert.throws(()=>expectedNativeProviderTarget(provider.replace('Wrong','Other'),html,source.maintenance),/E_TEXT_PROVIDER_INITIAL_BLOCK_MAPPING/);
});


