import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {finalizeUpdate,publicFailureState} from '../publishing/finalize-update.mjs';
import {updateFingerprint} from '../publishing/update-core.mjs';
const source={id:'direct-test-general-chat',targetUrl:'https://nhunnhun.tistory.com/272'};
const initial={phase:'submitting',url:source.targetUrl,fingerprint:updateFingerprint(source),sourceCommit:'a'.repeat(40),sha:'previous'};
function harness(state=initial){const writes=[];return {writes,ledger:{read:async()=>state,write:async(...args)=>writes.push(args)}};}
test('public proof finalizes submitting once and uses current ledger sha',async()=>{
 const h=harness();let calls=0;
 const result=await finalizeUpdate(source,{...h,verify:async()=>{calls++;return {desktop:{bodyMatches:true},mobile:{bodyMatches:true}};}});
 assert.equal(result.status,'PUBLIC_VERIFIED');assert.equal(calls,1);assert.equal(h.writes[0][1].phase,'updated');assert.equal(h.writes[0][2],'previous');assert.ok(!('sha' in h.writes[0][1]));
});
test('network unavailability preserves submission and returns readable result',async()=>{
 const h=harness();const result=await finalizeUpdate(source,{...h,verify:async()=>{throw Error('E_QA_PUBLIC_RESPONSE');}});
 assert.equal(result.status,'PUBLIC_VERIFICATION_UNAVAILABLE');assert.equal(h.writes[0][1].phase,'submitting');assert.equal(h.writes[0][1].publicResult.code,'E_QA_PUBLIC_RESPONSE');
});
test('actual mismatch remains distinct and never marks updated',async()=>{
 const h=harness();const result=await finalizeUpdate(source,{...h,verify:async()=>{throw Error('E_DIRECT_PUBLIC_MARKS');}});
 assert.equal(result.status,'PUBLIC_VERIFICATION_MISMATCH');assert.equal(h.writes[0][1].phase,'submitting');
 assert.equal(publicFailureState(Error('E_QA_BODY')).status,'PUBLIC_VERIFICATION_MISMATCH');
});
test('wrong ledger identity blocks before browser and result write',async()=>{
 const h=harness({...initial,fingerprint:'other'});let calls=0;
 await assert.rejects(finalizeUpdate(source,{...h,verify:async()=>calls++}),/E_QA_LEDGER/);assert.equal(calls,0);assert.equal(h.writes.length,0);
});
test('result write failure is not swallowed as publication success',async()=>{
 await assert.rejects(finalizeUpdate(source,{ledger:{read:async()=>initial,write:async()=>{throw Error('E_UPDATE_LEDGER_REQUEST');}},verify:async()=>({})}),/E_UPDATE_LEDGER_REQUEST/);
});
test('general Chat pipeline has runner preparation and read-only recovery without local Chrome prerequisite',()=>{
 const read=f=>readFileSync(f,'utf8');
 assert.doesNotMatch(read('authoring/start-direct-publish.mjs'),/cmd\.exe|check-tistory-chrome/);
 const update=read('.github/workflows/update-posts.yml');assert.match(update,/prepare-selected-source\.mjs updates/);assert.match(update,/inputs\.update == false/);assert.match(update,/node publishing\/finalize-update\.mjs/);
 assert.match(read('.github/workflows/publish-posts.yml'),/prepare-selected-source\.mjs posts/);
 const verify=read('publishing/verify-updated-public.mjs');assert.doesNotMatch(verify,/SP1'\) return/);assert.match(verify,/assertDirectPublicSnapshot\(snapshot/);
 const finalize=read('publishing/finalize-update.mjs');assert.doesNotMatch(finalize,/submit\.click|openEditorConnection|UPDATE_ENABLED/);
});
test('mutation workflows require authenticated Tistory preflight after Chrome readiness',()=>{
 const read=f=>readFileSync(f,'utf8');
 const update=read('.github/workflows/update-posts.yml');
 const publish=read('.github/workflows/publish-posts.yml');
 for (const [workflow,mutation] of [[update,'pnpm run update'],[publish,'pnpm run publish']]) {
   const chrome=workflow.indexOf('maintenance\\check-tistory-chrome.cmd');
   const auth=workflow.indexOf('node publishing/auth-preflight.mjs');
   const mutate=workflow.indexOf(mutation);
   assert.ok(chrome>=0 && auth>chrome && mutate>auth, `${mutation} must follow Chrome and auth preflight`);
 }
 const preflight=read('publishing/auth-preflight.mjs');
 assert.match(preflight,/\/manage\/posts/);
 assert.match(preflight,/E_TISTORY_AUTH_REQUIRED_PRECHECK/);
 assert.match(preflight,/TISTORY_AUTH_READY/);
 assert.match(preflight,/setTimeout\(\(\) => process\.exit\(process\.exitCode \?\? 0\), 0\)/);
});
test('scheduled GPT contract isolates each article and distinguishes uncommitted writes',()=>{
 const contract=readFileSync('docs/GENERAL_CHAT_EXECUTION.md','utf8');
 assert.match(contract,/글 1건 = 독립 1회성 ChatGPT 예약 작업/);
 assert.match(contract,/WRITE_NOT_COMMITTED/);
 assert.match(contract,/TISTORY_CHROME_READY/);
 assert.match(contract,/TISTORY_AUTH_READY/);
});
