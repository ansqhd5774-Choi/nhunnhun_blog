import test from 'node:test';
import assert from 'node:assert/strict';
import {observeAltMetadata,assertObservedMetadataPreserved} from '../publishing/alt-maintenance-observe.mjs';
const fixture=()=>({counts:{panels:1,boxes:1,thumbs:1,radios:3,checked:1,tags:2},metadata:{title:'기존 제목',category:'음식',tags:['하나','둘'],representativeImage:'background-image: url("https://example.org/p");',visibility:'20'}});
const page=x=>({evaluate:async()=>x});
test('metadata hash remains equal across two read-only observations',async()=>{const a=await observeAltMetadata(page(fixture())),b=await observeAltMetadata(page(fixture()));assert.equal(assertObservedMetadataPreserved(a,b).preserved,true);});
test('thumbnail or tags drift rejects',async()=>{const a=await observeAltMetadata(page(fixture()));for(const key of ['representativeImage','tags']){const x=fixture();x.metadata[key]=key==='tags'?['다른태그']:'background-image: url("https://example.org/changed");';const b=await observeAltMetadata(page(x));assert.throws(()=>assertObservedMetadataPreserved(a,b),/METADATA_DRIFT/);}});
test('missing or ambiguous UI cannot produce a confirmed snapshot',async()=>{for(const key of ['panels','boxes','thumbs','checked','tags']){const x=fixture();x.counts[key]=0;await assert.rejects(observeAltMetadata(page(x)),/OBSERVATION_UNCONFIRMED/);}});
