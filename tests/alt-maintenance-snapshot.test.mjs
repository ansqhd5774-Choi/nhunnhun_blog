import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDecipheriv} from 'node:crypto';
import {parse} from 'yaml';
import {ALT_VISUAL_PATCHES,draftAltSnapshot,sealAltSnapshot,observeAltEditor,writeAltObservationCheckpoint} from '../publishing/alt-maintenance-snapshot.mjs';
import {maintenanceHash} from '../publishing/alt-maintenance-contract.mjs';
const metadata={title:'기존 제목',category:'음식',tags:['태그'],representativeImage:'background-image: url("private-url")',visibility:'20'};
test('only six explicitly reviewed image selectors are allowed',()=>{
  assert.deepEqual(ALT_VISUAL_PATCHES.map(x=>[x.articleId,x.imageIndex]),[['352',1],['276',7],['342',9],['334',4],['332',7],['331',7]]);
});
test('snapshot emits draft/unapproved hashed conditions, never original HTML or image URL',()=>{
  const html='<p>기존 본문</p><img src="https://example.org/photo" alt="">';
  const draft=draftAltSnapshot(html,metadata,{articleId:'331',imageIndex:0,newAlt:'과일과 곡물을 올린 컵 디저트'});
  assert.equal(draft.status,'draft');assert.equal(draft.approved,false);
  assert.equal(draft.maintenance.expectedBodySha256,maintenanceHash(html));
  assert.ok(!JSON.stringify(draft).includes('example.org'));assert.ok(!JSON.stringify(draft).includes('private-url'));assert.ok(!JSON.stringify(draft).includes('기존 본문'));
});
test('native opaque Tistory macros stop instead of assuming an img index',()=>{
  assert.throws(()=>draftAltSnapshot('[##_Image|opaque|_##]',metadata,ALT_VISUAL_PATCHES[0]),/EDITOR_MACRO_UNSUPPORTED/);
});
test('encrypted artifact can only be decoded using separately retained local key',()=>{
  const secret={draft:'read-only condition',source:'not public'};
  const s=sealAltSnapshot(secret),envelope=JSON.parse(s.encrypted);
  assert.ok(!s.encrypted.includes('not public'));
  const decipher=createDecipheriv('aes-256-gcm',s.key,Buffer.from(envelope.iv,'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
  const clear=Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64')),decipher.final()]);
  assert.deepEqual(JSON.parse(clear),secret);
  assert.throws(()=>{const wrong=createDecipheriv('aes-256-gcm',Buffer.alloc(32),Buffer.from(envelope.iv,'base64'));wrong.setAuthTag(Buffer.from(envelope.tag,'base64'));wrong.update(Buffer.from(envelope.ciphertext,'base64'));wrong.final();});
});
test('readonly editor observation contains no content input or final submit',async()=>{
  const progress=[];const events=[];const html='<p>기존</p><img src="https://example.org/photo" alt="">';
  const locator=selector=>({waitFor:async()=>{},inputValue:async()=>metadata.title,evaluate:async()=>html,count:async()=>1,isEnabled:async()=>true,and(){return this;},click:async()=>events.push(selector)});
  const page={goto:async()=>events.push('goto'),url:()=> 'https://nhunnhun.tistory.com/manage/newpost/331',locator,getByRole:(_,{name})=>locator(name)};
  const r=await observeAltEditor(page,{articleId:'331',imageIndex:0,newAlt:'과일과 곡물을 올린 컵 디저트'},
    {progress:event=>progress.push(event),selectMode:async(_,mode)=>events.push(mode),open:async()=>events.push('open-dialog'),observe:async()=>({metadata,sha256:maintenanceHash(JSON.stringify(metadata))}),probe:async()=>events.push('probe')});
  assert.equal(r.originalHtml,html);assert.equal(r.metadata,metadata);assert.equal(r.draft,undefined);assert.ok(progress.some(x=>x.stage==='html-shape'&&x.literalImgCount===1));assert.ok(!JSON.stringify(progress).includes('example.org'));assert.ok(!JSON.stringify(progress).includes('기존 본문'));assert.deepEqual(events,['goto','probe','open-dialog','취소','html','basic','open-dialog','취소']);
});
test('readonly workflow retains shared physical mutex and gate, cannot write contents or invoke update',()=>{
  const workflow=parse(readFileSync('.github/workflows/observe-alt-maintenance.yml','utf8'));
  assert.deepEqual(workflow.permissions,{contents:'read'});assert.equal(workflow.jobs.observe.concurrency.group,'nhunnhun-tistory-mutation');
  assert.equal(workflow.jobs.observe.defaults.run.shell,'cmd');
  const steps=workflow.jobs.observe.steps;
  assert.ok(steps.some(x=>x.run==='node publishing/runner-gate.mjs'));
  assert.ok(!steps.some(x=>/pnpm run (update|publish)|finalize-update/.test(x.run||'')));
  const snapshot=steps.find(x=>x.run==='node publishing/alt-maintenance-snapshot.mjs');assert.equal(snapshot.env.UPDATE_ENABLED,'false');
  const artifact=steps.find(x=>x.uses==='actions/upload-artifact@v4');assert.ok(artifact.with.path.endsWith('/conditions.enc.json'));assert.ok(!artifact.with.path.includes('*'));
});

test('each private checkpoint advances processed count without approval or completion',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'alt-checkpoint-'));
  try{
    await writeAltObservationCheckpoint(dir,'123',[{articleId:'352',status:'OBSERVATION_UNCONFIRMED',code:'E_ALT_TEST'}]);
    let saved=JSON.parse(await readFile(join(dir,'observation-checkpoint.private.json'),'utf8'));
    assert.equal(saved.processedCount,1);assert.equal(saved.complete,false);assert.equal(saved.finalSubmitCount,0);
    await writeAltObservationCheckpoint(dir,'123',[...saved.records,{articleId:'276',status:'OBSERVATION_UNCONFIRMED',code:'E_ALT_TEST'}]);
    saved=JSON.parse(await readFile(join(dir,'observation-checkpoint.private.json'),'utf8'));assert.equal(saved.processedCount,2);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('raw private observation is persisted before unsupported draft parsing and CLI only exits itself',()=>{
 const source=readFileSync('publishing/alt-maintenance-snapshot.mjs','utf8');
 assert.ok(source.indexOf('JSON.stringify(observed)')<source.indexOf('const draft=draftAltSnapshot(observed.originalHtml'));
 assert.ok(source.includes('process.stdout.write'));assert.ok(source.includes('process.stderr.write'));assert.ok(source.includes('.then(()=>exitSnapshotCli(0))'));
 assert.ok(!source.includes('browser.close()'));assert.ok(!source.includes('taskkill'));
});
