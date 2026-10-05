import { open,rename,mkdir,readFile } from 'node:fs/promises';
import { join,resolve,dirname,relative,isAbsolute } from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
export function artifactPath(runtime,jobId,name){
  if(!/^[a-f0-9-]{36}$/.test(jobId)||!/^[a-z][a-z0-9-]*\.(json|html|txt)$/.test(name))throw new Error('E_ARTIFACT_PATH');
  const root=resolve(runtime,'jobs'),path=resolve(root,jobId,name),rel=relative(root,path);
  if(rel.startsWith('..')||isAbsolute(rel))throw new Error('E_ARTIFACT_PATH');return path;
}
export async function atomicJson(path,value){
  await mkdir(dirname(path),{recursive:true});const temp=path+'.'+randomUUID()+'.tmp';const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n','utf8');
  const handle=await open(temp,'wx',0o600);try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
  await rename(temp,path);return createHash('sha256').update(bytes).digest('hex');
}
export async function readArtifact(runtime,id,name){return JSON.parse(await readFile(artifactPath(runtime,id,name),'utf8'));}
export async function readVerifiedArtifact(runtime,id,name,expectedDigest){
  if(!/^[a-f0-9]{64}$/.test(expectedDigest??''))throw new Error('E_ARTIFACT_DIGEST');
  const bytes=await readFile(artifactPath(runtime,id,name));
  if(createHash('sha256').update(bytes).digest('hex')!==expectedDigest)throw new Error('E_ARTIFACT_CHANGED');
  return JSON.parse(bytes.toString('utf8'));
}
