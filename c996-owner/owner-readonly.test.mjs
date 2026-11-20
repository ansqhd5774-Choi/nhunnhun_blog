import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizedOwnerContext,verifyFile,verifyLog,collect} from './owner-readonly.mjs';
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
