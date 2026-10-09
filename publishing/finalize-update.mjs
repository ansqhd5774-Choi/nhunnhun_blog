import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {loadUpdates,updateFingerprint} from './update-core.mjs';
import {UpdateLedger} from './update-ledger.mjs';
import {localBrowserConfig,openPublicBrowser} from './local-browser.mjs';
import {renderEditorialPost,editorialExpectations,editorialVersionFor} from './editorial.mjs';
import {verifyUpdatedPage} from './verify-updated-public.mjs';

export function publicFailureState(error) {
  const code=/^E_(?:QA|DIRECT_PUBLIC|PUBLIC_TITLE)_[A-Z_]+$/.test(error?.message||'')?error.message:'E_QA_ACCESS';
  return {status:/RESPONSE|FETCH|ACCESS|RATE_LIMIT|INTERNAL_LINK/.test(code)?'PUBLIC_VERIFICATION_UNAVAILABLE':'PUBLIC_VERIFICATION_MISMATCH',code};
}
// Read-only browser verification; this module never opens an editor or submits.
export async function finalizeUpdate(source,{ledger,verify,now=()=>new Date().toISOString()}={}) {
  const state=await ledger.read(source.id);
  if(!state||!['submitting','updated'].includes(state.phase)||state.url!==source.targetUrl||state.fingerprint!==updateFingerprint(source))throw Error('E_QA_LEDGER');
  const {sha,...record}=state;
  const result={sourceId:source.id,url:source.targetUrl,sourceCommit:state.sourceCommit,fingerprint:state.fingerprint,
    runUrl:state.runUrl||null,checkedAt:now(),
    verificationRunUrl:process.env.GITHUB_RUN_ID?`https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/${process.env.GITHUB_RUN_ID}`:null};
  try {
    result.verification=await verify(source);
  } catch(error) {
    const failure=publicFailureState(error);
    await ledger.write(source.id,{...record,publicResult:{...result,...failure}},sha);
    return {...result,...failure};
  }
  await ledger.write(source.id,{...record,phase:'updated',verification:result.verification,
    publicResult:{...result,status:'PUBLIC_VERIFIED'}},sha);
  return {...result,status:'PUBLIC_VERIFIED'};
}
export async function finalizeSelectedUpdate(sourceId) {
  const [source]=await loadUpdates('updates',sourceId);
  let browser;
  try {
    return await finalizeUpdate(source,{ledger:new UpdateLedger(),verify:async update=>{
      browser=await openPublicBrowser(await localBrowserConfig());
      const rendered=renderEditorialPost(update),expected=editorialExpectations(update.bodyHtml,{version:editorialVersionFor(update)});
      const desktop=await verifyUpdatedPage(browser,update,1440,expected,rendered,true);
      const mobile=await verifyUpdatedPage(browser,update,390,expected,rendered,false);
      return {desktop,mobile,semanticVerification:'not-performed'};
    }});
  } finally {await browser?.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  finalizeSelectedUpdate(process.env.UPDATE_SOURCE_ID).then(result=>{
    console.log('UPDATE_PUBLIC_RESULT '+JSON.stringify(result));
    if(result.status!=='PUBLIC_VERIFIED')process.exitCode=1;
  }).catch(error=>{console.error(/^E_[A-Z_]+$/.test(error.message)?error.message:'E_QA_RUNTIME');process.exitCode=1;});
}
