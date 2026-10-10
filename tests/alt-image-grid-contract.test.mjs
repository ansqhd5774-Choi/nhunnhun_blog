import test from 'node:test';import assert from 'node:assert/strict';
import {parseImageGridMacros,assertImageGridPublicMapping,applyImageGridAltMaintenance,applyMappedImageGridAlt,draftImageGridAltSource} from '../publishing/alt-image-grid-contract.mjs';
import {parsePlainImageMacros,draftMacroAltConditions,applyMacroAltMaintenance} from '../publishing/alt-macro-contract.mjs';
import {maintenanceHash as hash} from '../publishing/alt-maintenance-contract.mjs';
const metadata={title:'기존 제목',category:'음식',tags:['영양'],representativeImage:'unchanged',visibility:'20'};
const ref=n=>'kage@asset'+n+'/folder/version/photo.png?v=synthetic';
const pub=n=>'https://blog.kakaocdn.net/dna/asset'+n+'/folder/version/photo.png?v=other';
const plainJson='{ "originWidth":100, "originHeight":80, "style":"alignCenter", "caption":"기존 설명", "filename":"synthetic.png" }';
const plain=n=>'[##_Image|'+ref(n)+'|CDM|1.3|'+plainJson+'_##]';
const attrs=n=>'data-is-animation="false" data-origin-width="100" data-origin-height="80" data-filename="synthetic'+n+'.png" data-widthpercent="50" style="width:50%; margin-right:10px;"';
const grid=(numbers=[2,3],attributes=numbers.map(attrs))=>'[##_ImageGrid|'+numbers.map(ref).join(',')+'|'+attributes.join(',')+'|기존 캡션_##]';
const html=()=>'<p>유지</p>'+plain(1)+grid()+plain(4)+'<p>끝</p>';
const sources=[1,2,3,4].map(pub);
const draft=(original=html(),index=2,newAlt='냉장고 문과 내부 공간을 나타낸 그림')=>draftImageGridAltSource(original,metadata,{articleId:'342',imageIndex:index,newAlt},sources,'repair-grid-fixture');
test('mixed grid missing-alt insertion changes exactly one attribute token and keeps all surrounding bytes',()=>{
 const original=html(),source=draft();const result=applyImageGridAltMaintenance(original,metadata,source.maintenance,sources);
 assert.equal(result.targetHtml,original.replace(attrs(3),attrs(3)+' alt="'+source.maintenance.patches[0].newAlt+'"'));
 assert.equal(result.changedImages,1);assert.equal(result.publicationEnabled,false);assert.equal(source.approved,false);assert.equal(source.status,'draft');assert.ok(!JSON.stringify(source).includes('kage@'));
});
test('plain Image missing JSON alt remains supported inside a grid article without reserializing JSON',()=>{
 const original=html(),source=draft(original,3,'백내장 수술의 네 단계를 나타낸 도식');
 const result=applyImageGridAltMaintenance(original,metadata,source.maintenance,sources);
 const old=plain(4),changed=old.replace(' }',' ,"alt":'+JSON.stringify(source.maintenance.patches[0].newAlt)+'}');assert.equal(result.targetHtml,original.replace(old,changed));
});
test('existing plain-only path is unchanged and continues refusing Grid articles',()=>{
 const original=plain(1),condition=draftMacroAltConditions(original,metadata,{articleId:'334',imageIndex:0,newAlt:'기존 설명을 보완하는 그림'},[pub(1)]).maintenance;
 const old=applyMacroAltMaintenance(original,metadata,condition,[pub(1)]);
 const modern=applyImageGridAltMaintenance(original,metadata,condition,[pub(1)]);assert.equal(modern.targetHtml,old.targetHtml);
 assert.throws(()=>parsePlainImageMacros(html()),/MIXED_UNSUPPORTED/);
});
test('quoted commas and HTML-sensitive alt remain one attribute and do not change grid grouping',()=>{
 const original=html(),text='냉장고, "문" & <내부>를 나타낸 그림';const source=draft(original,2,text);
 const result=applyImageGridAltMaintenance(original,metadata,source.maintenance,sources);
 assert.ok(result.targetHtml.includes('alt="냉장고, &quot;문&quot; &amp; &lt;내부&gt;를 나타낸 그림"'));assert.equal(parseImageGridMacros(result.targetHtml).length,4);
});
test('multiple insertions/replacements restore all non-alt bytes and metadata unchanged',()=>{
 const original=html().replace(attrs(2),attrs(2)+' alt="이전 &amp; 설명"');const source=draft(original,1);
 const second=draft(original,3,'백내장 수술 단계를 나타낸 그림');source.maintenance.patches.push(second.maintenance.patches[0]);
 const result=applyImageGridAltMaintenance(original,metadata,source.maintenance,sources);assert.equal(result.changedImages,2);
 const expected=original.replace('alt="이전 &amp; 설명"','alt="냉장고 문과 내부 공간을 나타낸 그림"').replace(plain(4),plain(4).replace(' }',' ,"alt":"백내장 수술 단계를 나타낸 그림"}'));
 assert.equal(result.targetHtml,expected);assert.deepEqual(metadata,{title:'기존 제목',category:'음식',tags:['영양'],representativeImage:'unchanged',visibility:'20'});
});
test('asset proof blocks alternate paths, reorder, count drift and duplicates before any output',()=>{
 assert.equal(assertImageGridPublicMapping(html(),sources).length,4);
 const proof={version:'macro-asset-map-v1',assetSha256s:parseImageGridMacros(html()).map(x=>hash(x.asset))};
 const source=draft();assert.equal(applyMappedImageGridAlt(html(),metadata,source.maintenance,proof).changedImages,1);
 for(const bad of [[sources[1],sources[0],...sources.slice(2)],sources.slice(1),sources.map(()=>sources[0]),sources.map((x,i)=>i===2?pub(99):x)])assert.throws(()=>assertImageGridPublicMapping(html(),bad),/PUBLIC_MAPPING/);
 assert.throws(()=>applyMappedImageGridAlt(html(),metadata,source.maintenance,{...proof,assetSha256s:proof.assetSha256s.map((x,i)=>i===2?hash('wrong'):x)}),/PUBLIC_MAPPING/);
 assert.throws(()=>parseImageGridMacros(plain(1)+grid([1,3])),/ASSET_AMBIGUOUS/);
});
test('malformed grid and unsupported fields fail closed rather than locating by ordinal alone',()=>{
 for(const value of [grid([2], [attrs(2)]),grid([2,3],[attrs(2)]),grid([2,3],[attrs(2)+' alt="a" alt="b"',attrs(3)]),grid([2,3],[attrs(2)+' onclick="unsafe"',attrs(3)]),grid([2,3],[attrs(2).replace('data-widthpercent="50"','data-widthpercent="101"'),attrs(3)]),grid([2,3],[attrs(2).replace('style="width:50%; margin-right:10px;"','style=unquoted'),attrs(3)]),html()+'<img src="other">','<!--'+grid()+'-->',html().replace('_##]',''),html()+'[##_Other|x_##]'])assert.throws(()=>parseImageGridMacros(value),/E_ALT_/);
});
test('body, metadata, old-alt and source hashes are hard preconditions',()=>{
 const source=draft();for(const bad of [{...source.maintenance,expectedBodySha256:hash('drift')},{...source.maintenance,expectedMetadataSha256:hash('drift')},{...source.maintenance,patches:[{...source.maintenance.patches[0],expectedSrcSha256:hash('drift')}]},{...source.maintenance,patches:[{...source.maintenance.patches[0],expectedAltRaw:'""'}]}])assert.throws(()=>applyImageGridAltMaintenance(html(),metadata,bad,sources),/E_ALT_/);
 assert.throws(()=>applyImageGridAltMaintenance(html(),{...metadata,visibility:'0'},source.maintenance,sources),/METADATA_CAPTURE/);
 for(const text of ['구분자 | 삽입을 시도하는 설명','종료 _##] 토큰을 삽입하는 설명'])assert.throws(()=>draft(html(),2,text),/DELIMITER/);
});
