import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {checkUpdateSource} from '../publishing/update-core.mjs';
import {dispatchQueuedUpdate} from './update-queue-dispatch.mjs';
export async function dispatchDirectSource({sourceId,commitSha,token,root=process.cwd(),dispatch=dispatchQueuedUpdate}={}){
  if(!/^direct-[a-z0-9-]{2,70}$/.test(sourceId??''))throw Error('E_DIRECT_SOURCE_ID');
  const source=JSON.parse(await readFile(resolve(root,'updates',sourceId+'.json'),'utf8'));
  checkUpdateSource(source,sourceId+'.json');
  if(!source.representativeImageUrl)throw Error('E_UPDATE_REPRESENTATIVE');
  return dispatch({token,commitSha,sourceId});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  dispatchDirectSource({sourceId:process.env.SOURCE_ID,commitSha:process.env.SOURCE_COMMIT,token:process.env.GITHUB_TOKEN}).then(()=>console.log('DIRECT_SOURCE_DISPATCHED')).catch(e=>{console.error(/^E_[A-Z0-9_]+$/.test(e.message)?e.message:'E_DIRECT_DISPATCH_FAILED');process.exitCode=1;});
}
