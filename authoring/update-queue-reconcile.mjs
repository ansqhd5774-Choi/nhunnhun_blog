import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { finalizeQueuedUpdate } from './update-queue-finalize.mjs';

export async function reconcileReadyUpdates({root=process.cwd(),token=process.env.GITHUB_TOKEN,fetcher=fetch,finalize=finalizeQueuedUpdate}={}) {
  if(!token)throw Error('E_QUEUE_RECONCILE_TOKEN');
  const directory=resolve(root,'authoring/update-queue-state');
  const results=[];
  for(const file of await readdir(directory)){
    if(!/^\d+\.json$/.test(file))continue;
    const state=JSON.parse(await readFile(resolve(directory,file),'utf8'));
    if(state.status!=='READY_FOR_UPDATE'&&!(state.status==='BLOCKED'&&['E_QUEUE_MUTATION_UNCERTAIN','E_QUEUE_UPDATE_NOT_COMPLETED'].includes(state.error)))continue;
    if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(state.sourceId??''))throw Error('E_QUEUE_RECONCILE_SOURCE');
    const response=await fetcher('https://api.github.com/repos/ansqhd5774-Choi/nhunnhun_blog/commits?path='+encodeURIComponent('updates/'+state.sourceId+'.json')+'&per_page=1',
      {headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('E_QUEUE_RECONCILE_COMMIT');
    const commitSha=(await response.json())[0]?.sha;
    if(!/^[a-f0-9]{40}$/.test(commitSha??''))throw Error('E_QUEUE_RECONCILE_COMMIT');
    results.push(await finalize({sourceId:state.sourceId,articleId:state.item?.articleId??file.slice(0,-5),commitSha,token,timeoutMs:0}));
  }
  console.log('QUEUE_RECONCILE '+JSON.stringify(results));
  return results;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  reconcileReadyUpdates().catch(error=>{console.error(/^E_[A-Z0-9_]+$/.test(error.message)?error.message:'E_QUEUE_RECONCILE');process.exitCode=1;});
