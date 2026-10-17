import {directFixture} from './direct-source-fixture.mjs';
import './direct-emphasis-guard.test.mjs';
import './direct-new-post.test.mjs';
import test from 'node:test';
import './emphasis-observation.test.mjs';
import './direct-preparation.test.mjs';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import YAML from 'yaml';
import {renderEditorialPost} from '../publishing/editorial.mjs';
import {checkUpdateSource,updateFingerprint} from '../publishing/update-core.mjs';
import {dispatchDirectSource} from '../authoring/direct-dispatch.mjs';
import {startDirectPublish} from '../authoring/start-direct-publish.mjs';
const source=directFixture();
test('existing direct update reports new-post-only tags as the unsupported key',()=>{
 assert.throws(()=>checkUpdateSource({...source,tags:['히카마']},`${source.id}.json`),/E_UPDATE_SCHEMA_UNSUPPORTED_KEYS:tags/);
});
test('emphasis-only update accepts complete structure baseline and fingerprints it',()=>{
 const baseline={h2:6,h3:0,ul:6,ol:0,li:18,table:1,tr:8,img:3,blockquote:1};
 const scoped={...source,changeScope:'emphasis-only',preserveStructure:true,structureBaseline:baseline};
 assert.equal(checkUpdateSource(scoped,`${source.id}.json`),scoped);
 assert.notEqual(updateFingerprint(scoped),updateFingerprint(source));
 assert.throws(()=>checkUpdateSource({...source,changeScope:'emphasis-only'},`${source.id}.json`),/E_UPDATE_STRUCTURE_BASELINE/);
 assert.throws(()=>checkUpdateSource({...scoped,structureBaseline:{...baseline,table:-1}},`${source.id}.json`),/E_UPDATE_STRUCTURE_BASELINE/);
});
test('local publication entry reads remote main and starts one update without another writer job',()=>{
 let starts=0;
 const run=args=>{
  if(args[0]==='api'&&args[1].includes('/updates/')){assert.ok(args[1].endsWith('?ref=main'));return JSON.stringify({content:Buffer.from(JSON.stringify(source)).toString('base64')});}
  if(args[0]==='variable')return 'true';
  if(args[0]==='api')throw Object.assign(Error('Not found'),{stderr:'HTTP 404'});
  if(args[0]==='run')return '[]';
  starts++;assert.equal(args[2],'update-posts.yml');assert.ok(args.includes('update=true'));
  return 'https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/123';
 };
 assert.equal(startDirectPublish(source.id,{run}).state,'DISPATCHED');assert.equal(starts,1);
});
test('local entry does not resend an existing run or uncertain ledger read',()=>{
 let starts=0;
 const run=args=>{
  if(args[0]==='api'&&args[1].includes('/updates/'))return JSON.stringify({content:Buffer.from(JSON.stringify(source)).toString('base64')});
  if(args[0]==='variable')return 'true';
  if(args[0]==='api')throw Object.assign(Error('Not found'),{stderr:'HTTP 404'});
  if(args[0]==='run')return JSON.stringify([{displayTitle:`Update ${source.id}`,status:'queued',url:'https://github.com/example/run'}]);
  starts++;return '';
 };
 assert.equal(startDirectPublish(source.id,{run}).state,'EXISTING_RUN');assert.equal(starts,0);
 assert.throws(()=>startDirectPublish(source.id,{run:args=>args[1]?.includes('/update-state/')?(()=>{throw Error('HTTP 403');})():run(args)}),/E_DIRECT_LEDGER_READ/);
 assert.equal(starts,0);
});
test('varied renderer assigns layouts by section and preserves emphasis and image',()=>{
 const sections=['소개','영양','신체 변화','궁합','주의','보관'].map((x,i)=>'<h2>'+x+'</h2><ul><li><strong>항목</strong><mark><strong>중요 수치</strong></mark> 설명 그대로.</li></ul>').join('');
 const out=renderEditorialPost({...source,bodyHtml:source.bodyHtml.split('<h2>')[0]+sections});
 for(const name of ['effects','pairs','cautions','storage'])assert.ok(out.includes('class="'+name+'"'));
 assert.ok(!out.includes('card-grid'));assert.ok(out.includes('<small>03</small>'));
 assert.ok(out.includes('<mark><strong>중요 수치</strong></mark>'));assert.equal((out.match(/<img\b/g)||[]).length,3);
 assert.ok(out.includes('font-size:23px'));assert.ok(out.includes('@media(max-width:600px)'));
});
test('workflow starts only from prepared-source or source-preserving retry dispatch with no AI generation',async()=>{
 const text=await readFile('.github/workflows/direct-author-update.yml','utf8');const workflow=YAML.parse(text.replace(/^\uFEFF/,''));
 assert.deepEqual(Object.keys(workflow.on).sort(),['push','workflow_dispatch']);assert.deepEqual(workflow.on.push.branches,['main']);assert.deepEqual(workflow.on.push.paths,['updates/direct-*.json','automation/update-retry/direct-*.txt']);assert.ok(!/OLLAMA_HOST|update-producer|api\/chat|schedule:/.test(text));
 assert.equal(workflow.jobs.dispatch['runs-on'],'windows-latest');
 const checkout=workflow.jobs.dispatch.steps.find(step=>step.uses==='actions/checkout@v5');
 assert.equal(checkout.with.ref,'${{ github.sha }}');assert.equal(checkout.with['persist-credentials'],false);
 assert.doesNotMatch(text,/RUNNER_WORKSPACE|DIRECT_CHECKOUT|externals\/node24/);
});
test('direct dispatch requires existing approved source and calls existing publish dispatcher once',async()=>{
 const root=await mkdtemp(join(tmpdir(),'nh-direct-'));let calls=0;
 try{await mkdir(join(root,'updates'));await writeFile(join(root,'updates',source.id+'.json'),JSON.stringify(source));const confirmSource=async()=>({status:'GITHUB_SOURCE_CONFIRMED'});const dispatch=async args=>{calls++;assert.equal(args.sourceId,source.id);return {submitted:true};};
 await dispatchDirectSource({root,sourceId:source.id,commitSha:'a'.repeat(40),token:'fixture',dispatch,confirmSource});assert.equal(calls,1);
 await writeFile(join(root,'updates',source.id+'.json'),JSON.stringify({...source,bodyHtml:'<p><strong>핵심</strong></p>'}));
 await assert.rejects(dispatchDirectSource({root,sourceId:source.id,dispatch}),/E_DIRECT_EMPHASIS_MISSING/);assert.equal(calls,1);
 await writeFile(join(root,'updates',source.id+'.json'),JSON.stringify(source));
 await mkdir(join(root,'publishing','update-state'),{recursive:true});
 await writeFile(join(root,'publishing','update-state',source.id+'.json'),JSON.stringify({phase:'submitting'}));
 await assert.rejects(dispatchDirectSource({root,sourceId:source.id,dispatch}),/E_DIRECT_ALREADY_ATTEMPTED/);assert.equal(calls,1);
 await writeFile(join(root,'publishing','update-state',source.id+'.json'),JSON.stringify({phase:'updated',fingerprint:updateFingerprint(source),url:source.targetUrl}));
 const already=await dispatchDirectSource({root,sourceId:source.id,dispatch});assert.equal(already.alreadyUpdated,true);assert.equal(calls,1);
 await writeFile(join(root,'updates',source.id+'.json'),JSON.stringify({...source,title:source.title+' 수정'}));
 await assert.rejects(dispatchDirectSource({root,sourceId:source.id,dispatch}),/E_DIRECT_FINALIZED_SOURCE_MUTATION/);assert.equal(calls,1);
 await writeFile(join(root,'updates',source.id+'.json'),JSON.stringify({...source,approved:false}));await assert.rejects(dispatchDirectSource({root,sourceId:source.id,dispatch}),/E_UPDATE_APPROVAL/);assert.equal(calls,1);
 await assert.rejects(dispatchDirectSource({root,sourceId:'auto-179-test',dispatch}),/E_DIRECT_SOURCE_ID/);
 }finally{await rm(root,{recursive:true,force:true});}
});
