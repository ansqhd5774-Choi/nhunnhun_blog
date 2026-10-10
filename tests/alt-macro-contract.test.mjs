import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {checkUpdateSource} from '../publishing/update-core.mjs';
import {runAltMaintenance} from '../publishing/alt-maintenance-runner.mjs';
import {finalizeAltMaintenance,assertAltPublicSnapshot} from '../publishing/alt-maintenance-public.mjs';
import {altFingerprint} from '../publishing/alt-maintenance-source.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {parsePlainImageMacros,draftMacroAltConditions,applyMacroAltMaintenance,assertMacroPublicMapping,ALT_MACRO_OPERATION,draftMacroAltSource} from '../publishing/alt-macro-contract.mjs';
import {maintenanceHash as hash} from '../publishing/alt-maintenance-contract.mjs';
const metadata={title:'기존 제목',category:'음식',tags:['식품'],representativeImage:'original',visibility:'20'};
const source='kage@a/b/c/img.png?credential=synthetic&amp;expires=123';const publicSrc='https://blog.kakaocdn.net/dn/a/b/c/img.png?credential=other';
const attrs='{ "originWidth":100, "originHeight":80, "style":"alignCenter", "caption":"그림 설명", "filename":"image.png" }';
const macro=json=>'[##_Image|'+source+'|CDM|1.3|'+json+'_##]';const html=json=>'<p>원문</p>'+macro(json)+'<p>유지</p>';
const patch={articleId:'352',imageIndex:0,newAlt:'유리그릇에 담긴 노란색 캡슐'};
test('missing alt insertion preserves every existing byte including metadata spacing and signed reference',()=>{
 const original=html(attrs),draft=draftMacroAltConditions(original,metadata,patch,[publicSrc]);assert.equal(draft.approved,false);assert.equal(draft.status,'draft');assert.ok(!JSON.stringify(draft).includes('credential'));
 const r=applyMacroAltMaintenance(original,metadata,draft.maintenance,[publicSrc]);assert.equal(r.targetHtml,original.replace(' }',' ,"alt":'+JSON.stringify(patch.newAlt)+'}'));assert.equal(r.publicationEnabled,false);
});
test('existing empty or escaped alt replaces only JSON value token',()=>{
 for(const value of ['','옛 "설명"']){const json=attrs.replace(' }',',"alt":'+JSON.stringify(value)+' }');const original=html(json);const p={...patch,newAlt:'사진 "설명" & <한글>'};const request=draftMacroAltConditions(original,metadata,p,[publicSrc]).maintenance;const r=applyMacroAltMaintenance(original,metadata,request,[publicSrc]);assert.equal(r.targetHtml,original.replace('"alt":'+JSON.stringify(value),'"alt":'+JSON.stringify(p.newAlt)));}
});
test('grid/mixed/inert/malformed/duplicate JSON or assets are refused',()=>{
 for(const value of [html(attrs)+'[##_ImageGrid|x_##]',html(attrs)+'<img src="x">','<!--'+macro(attrs)+'-->',html(attrs.replace(' }',',"filename":"duplicate" }')),html(attrs.replace('100','null')),html(attrs.replace(' }',', }')),html(attrs)+macro(attrs),html(attrs).replace('_##]','')])assert.throws(()=>parsePlainImageMacros(value),/E_ALT_MACRO_/);
});
test('canonical asset mapping requires exact count, unique immutable identity and same order',()=>{
 assert.equal(assertMacroPublicMapping(html(attrs),[publicSrc]).length,1);const wrapped='https://img1.daumcdn.net/thumb/R100x100/?fname='+encodeURIComponent(publicSrc);assert.equal(assertMacroPublicMapping(html(attrs),[wrapped]).length,1);
 for(const sources of [[],[publicSrc,publicSrc],['https://blog.kakaocdn.net/dn/x/y/z/img.png'],['http://blog.kakaocdn.net/dn/a/b/c/img.png'],['https://evil.example/dn/a/b/c/img.png']])assert.throws(()=>assertMacroPublicMapping(html(attrs),sources),/E_ALT_MACRO_/);
});
test('baseline hash, metadata, reference, old alt, operation and unknown request keys fail closed',()=>{
 const original=html(attrs),request=draftMacroAltConditions(original,metadata,patch,[publicSrc]).maintenance;
 for(const changed of [{...request,expectedBodySha256:hash('other')},{...request,expectedMetadataSha256:hash('other')},{...request,operation:'other'},{...request,extra:true},{...request,patches:[{...request.patches[0],expectedSrcSha256:hash('other')}]},{...request,patches:[{...request.patches[0],expectedAltRaw:'""'}]}])assert.throws(()=>applyMacroAltMaintenance(original,metadata,changed,[publicSrc]),/E_ALT_/);
 assert.throws(()=>applyMacroAltMaintenance(original,{...metadata,visibility:'0'},request,[publicSrc]),/METADATA_CAPTURE/);assert.equal(request.operation,ALT_MACRO_OPERATION);
});

test('observed dna transport has the same immutable path identity as kage, without accepting another host',()=>{
 assert.equal(assertMacroPublicMapping(html(attrs),[publicSrc.replace('/dn/','/dna/')]).length,1);
 assert.throws(()=>assertMacroPublicMapping(html(attrs),[publicSrc.replace('/dn/','/other/')]),/ASSET/);
});
test('observed optional caption is preserved when absent and unknown fields are refused',()=>{
 const json=attrs.replace(', "caption":"그림 설명"','');assert.equal(parsePlainImageMacros(html(json)).length,1);
 assert.throws(()=>parsePlainImageMacros(html(attrs.replace(' }',',"unknown":"value" }'))),/FIELDS/);
});
test('same asset duplicates, reordering and delimiter injection cannot create an applicable draft',()=>{
 const secondSource=source.replace('a/b/c/','x/y/z/');const combined=html(attrs)+macro(attrs).replace(source,secondSource);
 assert.throws(()=>assertMacroPublicMapping(combined,[publicSrc.replace('a/b/c/','x/y/z/'),publicSrc]),/MAPPING/);
 assert.throws(()=>draftMacroAltConditions(html(attrs),metadata,{...patch,newAlt:'이미지 | 구분자 포함'},[publicSrc]),/MACRO/);
});

function runtimeFixture(options={}){
 const original=html(attrs),draft=draftMacroAltConditions(original,metadata,patch,[publicSrc]);
 const source={id:'repair-macro-352',articleId:'352',targetUrl:'https://nhunnhun.tistory.com/352',expectedCurrentTitle:metadata.title,title:metadata.title,status:'ready',approved:true,operation:ALT_MACRO_OPERATION,maintenance:draft.maintenance};
 let staged=original,state=null;const events=[],asset=hash('kakaocdn-asset:a/b/c/img.png');
 const image={srcSha256:hash(publicSrc),assetSha256:asset,altSha256:hash(JSON.stringify(null)),loaded:true};
 const snap={bodySha256:hash('delivered-body'),metadataSha256:hash('delivered-metadata'),images:[image],overflowPx:0};
 const baseline={version:'alt-public-baseline-v1',desktop:snap,mobile:snap,patches:[{publicIndex:0,newAlt:patch.newAlt}],macroMapping:{version:'macro-asset-map-v1',assetSha256s:[options.badMapping?hash('wrong'):asset]}};
 const locator=selector=>({count:async()=>1,isEnabled:async()=>true,and(){return this;},waitFor:async()=>{},click:async()=>{events.push(selector);if(selector==='공개 발행'&&options.uncertain)throw Error('uncertain');},evaluate:async()=>staged});
 const page={locator,getByRole:(_,{name})=>locator(name),keyboard:{press:async()=>{},insertText:async value=>{events.push('stage');staged=value;}}};
 const ledger={read:async()=>state,write:async(_,value)=>{events.push('checkpoint');state=value;}};
 return {source,baseline,snap,events,ledger,getState:()=>state,deps:{page,source,originalHtml:original,selectMode:async()=>{},ledger,assertSource:()=> 'sha',capturePublicBaseline:async()=>baseline,finalize:async()=>({status:'PUBLIC_VERIFIED'}),prepare:async()=>{},open:async()=>{},observe:async()=>({metadata,sha256:hash(JSON.stringify(metadata))}),log:()=>{}}};
}
test('macro source uses unchanged-title contract and mapping failure blocks content input and ledger',async()=>{
 const f=runtimeFixture({badMapping:true});checkUpdateSource(f.source,f.source.id+'.json');await assert.rejects(runAltMaintenance(f.deps),/PUBLIC_MAPPING/);assert.ok(!f.events.includes('stage'));assert.equal(f.getState(),null);
 assert.throws(()=>checkUpdateSource({...f.source,title:'다른 제목'},f.source.id+'.json'),/SOURCE_TARGET/);
});
test('macro runner keeps one final click, durable checkpoint and no retry after uncertainty',async()=>{
 const f=runtimeFixture({uncertain:true});await assert.rejects(runAltMaintenance(f.deps),/uncertain/);assert.equal(f.getState().phase,'submitting');assert.equal(f.events.filter(x=>x==='공개 발행').length,1);await assert.rejects(runAltMaintenance(f.deps),/EXISTING_STATE/);assert.equal(f.events.filter(x=>x==='공개 발행').length,1);
});
test('macro finalizer requires matching canonical identity proof, PC/mobile exact alt and untouched body',async()=>{
 const f=runtimeFixture();await runAltMaintenance(f.deps);
 const good={...f.snap,images:[{...f.snap.images[0],altSha256:hash(JSON.stringify(patch.newAlt))}]};const widths=[];
 const r=await finalizeAltMaintenance(f.source,{ledger:f.ledger,captureSnapshot:async(_,__,width)=>{widths.push(width);return good;}});assert.equal(r.status,'PUBLIC_VERIFIED');assert.deepEqual(widths,[1440,390]);assert.equal(f.getState().phase,'updated');
 assert.throws(()=>assertAltPublicSnapshot({...good,images:[{...good.images[0],assetSha256:hash('different')}]},f.snap,f.baseline.patches),/IMAGE_DRIFT/);
 f.getState().baseline.macroMapping.assetSha256s=[hash('tampered')];await assert.rejects(finalizeAltMaintenance(f.source,{ledger:f.ledger,captureSnapshot:async()=>good}),/LEDGER_CONDITIONS/);
});

test('full macro source draft remains unapproved and cannot enter update queue before root review',()=>{
 const s=draftMacroAltSource(html(attrs),metadata,patch,[publicSrc],'repair-alt-macro-352');assert.equal(s.approved,false);assert.equal(s.status,'draft');assert.throws(()=>checkUpdateSource(s,s.id+'.json'),/APPROVAL/);assert.ok(!JSON.stringify(s).includes('credential'));
});

test('standard selected-source preparation and content/update CLIs route macro operation without recertifying body',()=>{
 const f=runtimeFixture(),dir=mkdtempSync(join(tmpdir(),'macro-route-'));mkdirSync(join(dir,'updates'));writeFileSync(join(dir,'updates',f.source.id+'.json'),JSON.stringify(f.source));
 try{
  for(const [file,args,marker] of [['publishing/validate-content.mjs',['--check','updates/'+f.source.id+'.json'],'MAINTENANCE_CONTRACT_PASS'],['publishing/validate-update.mjs',[],'PASS_ALT_MAINTENANCE_SOURCE'],['authoring/prepare-selected-source.mjs',['updates'],'SOURCE_PREPARATION_MAINTENANCE']]){
   const r=spawnSync(process.execPath,[resolve(file),...args],{cwd:dir,env:{...process.env,UPDATE_SOURCE_ID:f.source.id},encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.ok(r.stdout.includes(marker),r.stdout);
  }
  for(const file of ['publishing/update.mjs','publishing/finalize-update.mjs'])assert.ok(readFileSync(file,'utf8').includes('if(isAltMaintenance('));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
