import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {checkUpdateSource} from '../publishing/update-core.mjs';
import {assertDirectEmphasis} from '../publishing/direct-emphasis.mjs';

const repo='ansqhd5774-Choi/nhunnhun_blog';
const command=args=>execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
export function startDirectPublish(sourceId,{run=command}={}) {
  if(!/^direct-[a-z0-9-]{2,70}$/.test(sourceId??'')) throw Error('E_DIRECT_SOURCE_ID');
  // Read authoritative main, not a stale checkout. No AI/content rework is added.
  const result=JSON.parse(run(['api',`repos/${repo}/contents/updates/${sourceId}.json?ref=main`]));
  const source=JSON.parse(Buffer.from(result.content,'base64').toString('utf8'));
  checkUpdateSource(source,sourceId+'.json');
  assertDirectEmphasis(source);
  if(!source.representativeImageUrl) throw Error('E_UPDATE_REPRESENTATIVE');
  if(run(['variable','get','TISTORY_PUBLISH_ENABLED','--repo',repo])!=='true') throw Error('E_DIRECT_PUBLISH_DISABLED');
  // Any recorded attempt needs inspection; never blindly resend an uncertain submit.
  let ledgerExists=false;
  try {run(['api',`repos/${repo}/contents/publishing/update-state/${sourceId}.json?ref=main`]);ledgerExists=true;}
  catch(error){if(!String(error.stderr??error.message).includes('404')) throw Error('E_DIRECT_LEDGER_READ');}
  if(ledgerExists) throw Error('E_DIRECT_ALREADY_ATTEMPTED');
  const runs=JSON.parse(run(['run','list','--repo',repo,'--workflow','update-posts.yml','--limit','100','--json','displayTitle,status,url']));
  const existing=runs.find(item=>item.displayTitle===`Update ${sourceId}`);
  if(existing) return {state:'EXISTING_RUN',url:existing.url,status:existing.status};
  // gh returns the accepted run URL. A transport error is not retried automatically.
  const output=run(['workflow','run','update-posts.yml','--repo',repo,'--ref','main','-f','update=true','-f',`source_id=${sourceId}`]);
  const url=output.match(/https:\/\/github\.com\/ansqhd5774-Choi\/nhunnhun_blog\/actions\/runs\/\d+/)?.[0];
  return {state:url?'DISPATCHED':'DISPATCH_ACCEPTED_RUN_UNCONFIRMED',...(url?{url}:{})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {
    // Optional operator CLI for existing updates. Chrome is checked by the runner.
    console.log(JSON.stringify(startDirectPublish(process.argv[2])));
  }
  catch(error){console.error(/^E_[A-Z0-9_]+$/.test(error.message)?error.message:'E_DIRECT_START_STATE_UNKNOWN');process.exitCode=1;}
}
