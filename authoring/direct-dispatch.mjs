import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {checkUpdateSource,updateFingerprint} from '../publishing/update-core.mjs';
import {dispatchQueuedUpdate} from './update-queue-dispatch.mjs';

// A push may include several commits. Never guess which update should be mutated.
export function sourceIdForEvent({eventName,sourceId,eventPayload}={}) {
  if(eventName!=='push') {
    if(!/^direct-[a-z0-9-]{2,70}$/.test(sourceId??''))throw Error('E_DIRECT_SOURCE_ID');
    return sourceId;
  }
  if(eventPayload?.ref!=='refs/heads/main'||eventPayload?.deleted===true)
    throw Error('E_DIRECT_PUSH_REF');
  const changed=new Set((eventPayload.commits??[]).flatMap(commit=>[
    ...(commit.added??[]),...(commit.modified??[])
  ]).filter(path=>/^updates\/direct-[a-z0-9-]{2,70}\.json$/.test(path)));
  if(changed.size!==1)throw Error('E_DIRECT_PUSH_SOURCE_COUNT');
  return [...changed][0].slice('updates/'.length,-'.json'.length);
}

export async function dispatchDirectSource({sourceId,commitSha,token,root=process.cwd(),dispatch=dispatchQueuedUpdate}={}){
  if(!/^direct-[a-z0-9-]{2,70}$/.test(sourceId??''))throw Error('E_DIRECT_SOURCE_ID');
  const source=JSON.parse(await readFile(resolve(root,'updates',sourceId+'.json'),'utf8'));
  checkUpdateSource(source,sourceId+'.json');
  if(!source.representativeImageUrl)throw Error('E_UPDATE_REPRESENTATIVE');
  let ledger=null;
  try { ledger=JSON.parse(await readFile(resolve(root,'publishing/update-state',sourceId+'.json'),'utf8')); }
  catch(e) { if(e?.code!=='ENOENT')throw e; }
  if(ledger?.phase==='updated' && ledger.fingerprint===updateFingerprint(source) && ledger.url===source.targetUrl)
    return {alreadyUpdated:true,sourceId};
  return dispatch({token,commitSha,sourceId});
}

async function main(){
  const eventName=process.env.GITHUB_EVENT_NAME??'workflow_dispatch';
  let eventPayload=null;
  if(eventName==='push'){
    if(!process.env.GITHUB_EVENT_PATH)throw Error('E_DIRECT_PUSH_EVENT_PATH');
    eventPayload=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
  }
  const sourceId=sourceIdForEvent({eventName,sourceId:process.env.SOURCE_ID,eventPayload});
  const result=await dispatchDirectSource({sourceId,commitSha:process.env.SOURCE_COMMIT,token:process.env.GITHUB_TOKEN});
  console.log(result.alreadyUpdated?'DIRECT_SOURCE_ALREADY_UPDATED':'DIRECT_SOURCE_DISPATCHED',sourceId);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(e=>{console.error(/^E_[A-Z0-9_]+$/.test(e.message)?e.message:'E_DIRECT_DISPATCH_FAILED');process.exitCode=1;});
