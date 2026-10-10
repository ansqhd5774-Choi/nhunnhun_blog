import test from 'node:test';import assert from 'node:assert/strict';
import {maintenanceHash as hash} from '../publishing/alt-maintenance-contract.mjs';
import {nativeImages,nativePlainText,nativeTextSlots,applyNativeTextMaintenance} from '../publishing/native-text-contract.mjs';
test('plain Unicode NBSP preserves normalized text without displaying literal escaped entity',()=>{
 const original='<p>&nbsp;Known text</p>[##_Image|kage@a/b/c/img.png|CDM|1.3|{"caption":"Picture"}_##]';
 const metadata={title:'Old',category:'음식',tags:['x'],representativeImage:'fixture',visibility:'20'};
 const slot=nativeTextSlots(original).find(s=>s.raw.includes('&nbsp;'));assert.ok(slot);
 const request={operation:'native-text-surgical-v1',articleId:'236',expectedTitle:'Old',targetTitle:'New',expectedBodySha256:hash(original),expectedMetadataSha256:hash(JSON.stringify(metadata)),expectedPublicTextSha256:hash(nativePlainText(original)),targetPublicTextSha256:hash(nativePlainText(original)),patches:[{start:slot.start,length:slot.length,expectedTextSha256:hash(slot.raw),newText:slot.raw.replaceAll('&nbsp;','\u00a0')}],cleanupPatches:[],captionPatches:[]};
 const result=applyNativeTextMaintenance(original,metadata,request,{version:'native-text-assets-v1',assetSha256s:nativeImages(original).map(x=>hash(x.asset))});
 assert.equal(result.targetHtml.includes('&amp;nbsp;'),false);assert.equal(result.targetHtml.includes('&nbsp;'),false);assert.equal(result.targetHtml.includes('\u00a0'),true);assert.equal(nativePlainText(result.targetHtml),nativePlainText(original));
});

