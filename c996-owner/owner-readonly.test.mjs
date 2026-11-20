import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizedOwnerContext,identifyRequest,verifyFile,verifyLog,collect,inspectFixedEvidence,collectFixedEvidence} from './owner-readonly.mjs';
import crypto from 'node:crypto';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const stream=x=>({async *[Symbol.asyncIterator](){yield Buffer.from(x)}});
const regular={isFile:()=>true,isDirectory:()=>false,size:128};
test('owner job requires exact host, interactive owner and existing named runner',()=>{
 const ctx={platform:'win32',host:'DESKTOP-N62L0NG',user:'ansqh',runner:'ansqh-tistory-publisher'};
 assert.equal(authorizedOwnerContext(ctx),true);
 for(const k of Object.keys(ctx))assert.equal(authorizedOwnerContext({...ctx,[k]:'unrelated'}),false);
});
test('file verifies exact bytes and keeps access failures distinct from corruption',async()=>{
 let x=await verifyFile({id:'F',file:'fixed',expected:hash('abc')},{stat:()=>regular,stream:()=>stream('abc')});
 assert.equal(x.status,'MATCHED');
 x=await verifyFile({id:'F',file:'fixed',expected:hash('x')},{stat:()=>regular,stream:()=>stream('abc')});
 assert.equal(x.status,'MISMATCH');
 x=await verifyFile({id:'F',file:'fixed',expected:hash('x')},{stat:()=>{throw Object.assign(new Error('secret'),{code:'EPERM'})}});
 assert.deepEqual(x,{id:'F',status:'UNVERIFIED',code:'EPERM'});
});
test('DISM log extracts only sanitized counts and hash, never raw lines',async()=>{
 const contents='DismUnmountImageHandle commit failed to execute\nHRESULT=0x80070005\n';
 const x=await verifyLog({id:'LOG',file:'fixed'},{stat:()=>regular,stream:()=>stream(contents)});
 assert.equal(x.status,'READABLE');assert.equal(x.commitRequests,1);assert.equal(x.errorMentions,2);
 assert.equal(JSON.stringify(x).includes('DismUnmountImageHandle'),false);
});
test('directory permission errors do not become completed inspection',async()=>{
 const x=await collect({stat:()=>{throw Object.assign(new Error('private'),{code:'EPERM'})},readdir:()=>{throw new Error('should not enumerate')},stream:()=>{throw new Error('should not stream')}});
 assert.equal(x.status,'PARTIAL');assert.equal(x.files.length,4);assert.equal(x.logErrors.length,4);
 assert.equal(JSON.stringify(x).includes('private'),false);
});

test('empty logs never prove completed DISM inspection',async()=>{
 const fileAndDir={isFile:()=>true,isDirectory:()=>true,size:1};
 const x=await collect({stat:()=>fileAndDir,readdir:()=>[],stream:()=>stream('abc')});
 assert.equal(x.status,'PARTIAL');
 assert.equal(x.logs.length,0);
 assert.equal(x.logErrors.length,0);
});
test('total log bound is enforced before reading a large directory',async()=>{
 const fileAndDir={isFile:()=>true,isDirectory:()=>true,size:1};
 const names=Array.from({length:17},(_,i)=>({name:'DISM'+i+'.log',isFile:()=>true}));
 const x=await collect({stat:()=>fileAndDir,readdir:()=>names,stream:()=>stream('abc')});
 assert.equal(x.status,'PARTIAL');
 assert.equal(x.logs.length,0);
 assert.equal(x.logErrors.some(e=>e.code==='LOG_COUNT_LIMIT'),true);
});

test('matching hashes with no commit evidence cannot establish a DISM stage',async()=>{
 const fileAndDir={isFile:()=>true,isDirectory:()=>true,size:3};
 const entry={name:'DISM.log',isFile:()=>true};
 const x=await collect({stat:()=>fileAndDir,readdir:()=>[entry],stream:()=>stream('no commit recorded')});
 assert.equal(x.status,'PARTIAL');
 assert.equal(x.rootCauseStage,'UNKNOWN');
 assert.equal(x.commitObserved,false);
 assert.equal(x.logScanComplete,true);
});
test('commit mention is still evidence of attempt not proof of successful DISM effect',async()=>{
 const fileAndDir={isFile:()=>true,isDirectory:()=>true,size:3};
 const entry={name:'DISM.log',isFile:()=>true};
 const x=await collect({stat:()=>fileAndDir,readdir:()=>[entry],stream:()=>stream('DismUnmountImageHandle commit failed to execute')});
 assert.equal(x.status,'PARTIAL'); // synthetic input hashes do not match pins
 assert.equal(x.commitObserved,true);
 assert.equal(x.rootCauseStage,'UNKNOWN');
});

test('DISM events preserve bounded order and numeric error code without source text',async()=>{
 const original='DismMountImage called\nDismUnmountImageHandle commit failed to execute\nHRESULT=0x80070005\nThe operation completed successfully\n';
 const x=await verifyLog({id:'LOG',file:'fixed'},{stat:()=>regular,stream:()=>stream(original)});
 assert.equal(x.status,'READABLE');
 assert.deepEqual(x.events.map(e=>e.code),['MOUNT_REQUEST','COMMIT_REQUEST','ERROR_MENTION','ERROR_MENTION','OPERATION_SUCCESS']);
 assert.equal(x.events.find(e=>e.errorCode)?.errorCode,'0x80070005');
 assert.equal(JSON.stringify(x).includes('DismUnmountImageHandle'),false);
});
test('DISM event list has deterministic size bound',async()=>{
 const x=await verifyLog({id:'LOG',file:'fixed'},{stat:()=>regular,stream:()=>stream('HRESULT=0x80070005\n'.repeat(70))});
 assert.equal(x.events.length,64);
 assert.equal(x.omittedEvents,6);
 assert.equal(x.errorMentions,70);
});

test('request binding requires authenticated exact issue and first run attempt',()=>{
 const req={schema:'C996_OWNER_FIXED_READONLY_REQUEST_V1',operation:'c996-owner-fixed-readonly',requestId:'b5409f61-ff0c-4ad1-a874-7cebb56594f3'};
 const evt={action:'opened',issue:{number:307,title:'c996-owner-fixed-readonly',user:{login:'ansqhd5774-Choi'},body:JSON.stringify(req)},repository:{full_name:'ansqhd5774-Choi/nhunnhun_blog'}};
 const env={GITHUB_RUN_ID:'44663981507',GITHUB_RUN_ATTEMPT:'1'};
 assert.deepEqual(identifyRequest(evt,env),{requestId:req.requestId,issueNumber:307,runId:env.GITHUB_RUN_ID,attempt:'1'});
 assert.throws(()=>identifyRequest(evt,{...env,GITHUB_RUN_ATTEMPT:'2'}),/C996_REQUEST_SCOPE_DENIED/);
 assert.throws(()=>identifyRequest({...evt,issue:{...evt.issue,body:'{}'}},env),/C996_REQUEST_SCOPE_DENIED/);
 assert.throws(()=>identifyRequest({...evt,issue:{...evt.issue,user:{login:'other'}}},env),/C996_REQUEST_SCOPE_DENIED/);
});

test('missing optional log subdirectories do not invalidate scanned fixed log directories',async()=>{
 const fileAndDir={isFile:()=>true,isDirectory:()=>true,size:3};
 const e={name:'DISM.log',isFile:()=>true};
 const missing=()=>Object.assign(new Error('optional directory absent'),{code:'ENOENT'});
 const x=await collect({
  stat:p=>p.toLowerCase().endsWith('\\logs')?(()=>{throw missing();})():fileAndDir,
  readdir:p=>p.includes('ISO_ATTEMPT_')?[e]:[],
  stream:()=>stream('DismUnmountImageHandle commit failed to execute')
 });
 assert.equal(x.logErrors.length,0);
 assert.equal(x.logScanComplete,true);
 assert.equal(x.commitObserved,true);
 assert.equal(x.status,'PARTIAL'); // only synthetic input hashes differ
});
test('fixed evidence reports bounded hashes and allowlisted statuses, never source content',async()=>{
 const raw=JSON.stringify({status:'PASS',code:'DISM_RESULT_OK',secret:'private original path'});
 const x=await inspectFixedEvidence({id:'ISO_RESULT',file:'C:\\fixed\\result.json'},{stat:()=>regular,stream:()=>stream(raw)});
 assert.equal(x.status,'PRESENT');
 assert.deepEqual(x.markers,{status:'PASS',code:'DISM_RESULT_OK'});
 assert.equal(JSON.stringify(x).includes('private original path'),false);
});
test('fixed evidence-only mode never reads heavy WIM or ISO paths',async()=>{
 const seen=[];
 const x=await collectFixedEvidence({
  stat:p=>{seen.push(p);throw Object.assign(new Error('missing'),{code:'ENOENT'});},
  stream:()=>{throw new Error('no file content should be streamed')}
 });
 assert.equal(x.status,'PARTIAL');
 assert.equal(x.evidence.length,6);
 assert.equal(x.evidence.every(a=>a.status==='MISSING'),true);
 assert.equal(seen.length,6);
 assert.equal(seen.some(p=>/boot\\.wim$|CNG_TEST_ONLY\\.iso$/i.test(p)),false);
});
test('request accepts only exact fixed evidence mode and preserves unique request identity',()=>{
 const req={schema:'C996_OWNER_FIXED_READONLY_REQUEST_V1',operation:'c996-owner-fixed-readonly',requestId:'b5409f61-ff0c-4ad1-a874-7cebb56594f3',mode:'fixed-evidence-only'};
 const evt={action:'opened',issue:{number:308,title:'c996-owner-fixed-readonly',user:{login:'ansqhd5774-Choi'},body:JSON.stringify(req)},repository:{full_name:'ansqhd5774-Choi/nhunnhun_blog'}};
 const env={GITHUB_RUN_ID:'44664374082',GITHUB_RUN_ATTEMPT:'1'};
 assert.equal(identifyRequest(evt,env).mode,'fixed-evidence-only');
 assert.throws(()=>identifyRequest({...evt,issue:{...evt.issue,body:JSON.stringify({...req,mode:'arbitrary'})}},env),/C996_REQUEST_SCOPE_DENIED/);
});
