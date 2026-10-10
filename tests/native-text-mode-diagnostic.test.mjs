import test from 'node:test';import assert from 'node:assert/strict';
import {diagnoseNativeModeDifference} from '../publishing/native-text-mode-diagnostic.mjs';
import {maintenanceHash as hash} from '../publishing/alt-maintenance-contract.mjs';
import {nativeTextSlots} from '../publishing/native-text-contract.mjs';
const reference='<p>Known &amp; text</p>[##_Image|kage@a/b/c/img.png?credential=synthetic-original&amp;expires=100|CDM|1.3|{"originWidth":100,"originHeight":80,"style":"alignCenter","caption":"Known caption"}_##]<p>Trailing</p>';
function source(html=reference){const slot=nativeTextSlots(html).at(-1);return {maintenance:{expectedBodySha256:hash(html),patches:[{start:slot.start,length:slot.length,expectedTextSha256:hash(slot.raw),newText:'Correct'}]}};}
test('identical input reports exact equality without approving or rewriting a source',()=>{const s=source(),before=JSON.stringify(s);const r=diagnoseNativeModeDifference(reference,reference,s);assert.equal(r.classification,'EXACT_SAME');assert.equal(r.referenceBodyHash,'PASS');assert.equal(r.slots.exactCurrentPatchSlots,1);assert.equal(r.publicationEnabled,false);assert.equal(r.sourceRewritten,false);assert.equal(JSON.stringify(s),before);});
test('known macro serialization only is distinguished from exact bytes and slot offsets',()=>{const actual=reference.replace('synthetic-original','synthetic-renewed').replace('"originWidth":100','"originWidth":"100"');const r=diagnoseNativeModeDifference(reference,actual,source());assert.equal(r.classification,'IMAGE_SERIALIZATION_ONLY');assert.equal(r.bodyByteEqual,false);assert.equal(r.nonMacroBodyByteEqual,true);assert.equal(r.fullTextHashEqual,true);assert.equal(r.images.macroCanonicalEqual,true);assert.equal(r.images.numericStringTypeChanges,1);assert.equal(r.images.macroBytesEqual,false);assert.equal(r.slots.offsetAndRawHashEqual,false);assert.equal(r.slots.rawSequenceHashEqual,true);for(const bad of ['synthetic-original','synthetic-renewed','Known caption','kage@','credential'])assert.equal(JSON.stringify(r).includes(bad),false);});
for(const [name,change]of [
 ['caption',h=>h.replace('Known caption','Other caption')],
 ['asset',h=>h.replace('/img.png','/other.png')],
 ['macro style',h=>h.replace('alignCenter','alignLeft')],
 ['dimension',h=>h.replace('"originWidth":100','"originWidth":101')],
 ['non-macro whitespace',h=>h+' '],
 ['text',h=>h.replace('Trailing','Other')]
])test(name+' drift is not treated as allowed serialization',()=>{const r=diagnoseNativeModeDifference(reference,change(reference),source());assert.equal(r.classification,'OTHER_BYTE_DRIFT');assert.equal(r.sourceRewritten,false);});
test('historical reference itself must match the source hash',()=>{assert.throws(()=>diagnoseNativeModeDifference(reference+' ',reference,source()),/E_NATIVE_MODE_REFERENCE_BODY_DRIFT/);});
test('unknown signed query key and duplicate JSON field reject diagnostic canonical proof',()=>{assert.throws(()=>diagnoseNativeModeDifference(reference,reference.replace('expires=100','unexpected=100'),source()),/E_NATIVE_MODE_REFERENCE/);assert.throws(()=>diagnoseNativeModeDifference(reference,reference.replace('"originWidth":100','"originWidth":100,"originWidth":100'),source()),/E_NATIVE_MODE_JSON/);});
