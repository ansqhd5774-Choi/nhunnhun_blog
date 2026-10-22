// Read only approved disease handoffs from the disease repository.
// Only existing-article updates are bridged; new posts require target resolution.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {checkUpdateSource} from '../publishing/update-core.mjs';
import {assertDirectPreflight} from '../publishing/direct-preflight.mjs';

const OWNER='ansqhd5774-Choi';
const SOURCE_REPO=OWNER+'/nhunnhun_disease';
const RUNNER_REPO=OWNER+'/nhunnhun_blog';
const SOURCE_PREFIX='handoffs/approved/';
const EVIDENCE_PREFIX='evidence/authoring-handoffs/';
const ID=/^direct-[a-z0-9-]{2,70}$/;
const sha256=txt=>createHash('sha256').update(txt).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const exists=async path=>{try{await access(path);return true}catch{return false}};
const head=()=>({Accept:'application/vnd.github+json','User-Agent':'nhunnhun-disease-handoff'});
async function request(url,{token=null,method='GET',body=null}={}){
 const headers=head();
 if(token)headers.Authorization='Bearer '+token;
 if(body)headers['Content-Type']='application/json';
 const response=await fetch(url,{method,headers,...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('E_DISEASE_BRIDGE_HTTP_'+response.status);
 return response.status===204?null:await response.json();
}
function validateHandoff(source,name){
 if(!source||typeof source!=='object'||Array.isArray(source))throw Error('E_DISEASE_BRIDGE_SCHEMA');
 if(!ID.test(source.id||'')||name!==source.id+'.json')throw Error('E_DISEASE_BRIDGE_ID');
 if(source.category!=='질병'||source.contentStandard!=='SP1'||source.status!=='ready'||source.approved!==true)throw Error('E_DISEASE_BRIDGE_SCOPE');
 if(!/^\d+$/.test(String(source.articleId||''))||source.targetUrl!=='https://nhunnhun.tistory.com/'+source.articleId)throw Error('E_DISEASE_BRIDGE_EXISTING_ONLY');
 checkUpdateSource(source,name);
 assertDirectPreflight(source);
 return source;
}
async function publicTextAt(commit,path){
 const response=await fetch('https://raw.githubusercontent.com/'+SOURCE_REPO+'/'+commit+'/'+path,{
   headers:head(),signal:AbortSignal.timeout(20000)
 });
 if(!response.ok)throw Error('E_DISEASE_BRIDGE_SOURCE_HTTP_'+response.status);
 return response.text();
}
async function main(){
 const token=process.env.GITHUB_TOKEN;
 if(!token||process.env.GITHUB_REPOSITORY!==RUNNER_REPO)throw Error('E_DISEASE_BRIDGE_RUNTIME');
 if(process.env.GITHUB_REF!=='refs/heads/main')throw Error('E_DISEASE_BRIDGE_REF');
 const info=await request('https://api.github.com/repos/'+SOURCE_REPO+'/branches/main');
 const pinned=String(info.commit?.sha||'');
 if(!/^[a-f0-9]{40}$/.test(pinned))throw Error('E_DISEASE_BRIDGE_SOURCE_SHA');
 const tree=await request('https://api.github.com/repos/'+SOURCE_REPO+'/git/trees/'+pinned+'?recursive=1');
 if(tree.truncated||!Array.isArray(tree.tree))throw Error('E_DISEASE_BRIDGE_TREE_INCOMPLETE');
 const candidates=tree.tree.filter(x=>x.type==='blob'&&
   x.path.startsWith(SOURCE_PREFIX)&&x.path.endsWith('.json')&&!x.path.slice(SOURCE_PREFIX.length).includes('/'))
   .map(x=>x.path).sort();
 if(!candidates.length){console.log('DISEASE_HANDOFF_NO_APPROVED_SOURCES');return;}
 // At most one source per run, preserving the shared publication queue.
 for(const sourcePath of candidates){
   const name=sourcePath.slice(SOURCE_PREFIX.length);
   const id=name.replace(/\.json$/,'');
   if(!ID.test(id))throw Error('E_DISEASE_BRIDGE_ID');
   const dest=join('updates',name);
   const state=join('publishing','update-state',name);
   if(await exists(state)){console.log('DISEASE_HANDOFF_ALREADY_TRACKED '+id);continue;}
   if(await exists(dest)){
     // Never overwrite an already selected source or generate a second submission.
     console.log('DISEASE_HANDOFF_ALREADY_IN_RUNNER '+id);continue;
   }
   const text=await publicTextAt(pinned,sourcePath);
   const evidence=await publicTextAt(pinned,EVIDENCE_PREFIX+name);
   if(sha256(text)!==sha256(evidence))throw Error('E_DISEASE_BRIDGE_GATE0_MISMATCH');
   const source=validateHandoff(JSON.parse(text),name);
   await mkdir('updates',{recursive:true});
   await writeFile(dest,text,'utf8');
   git('config','user.name','github-actions[bot]');
   git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com');
   git('add','--',dest);
   git('commit','-m','handoff(disease): receive approved '+id);
   const commit=git('rev-parse','HEAD');
   git('push','origin','HEAD:main');
   // Pin content confirmation to the actual pushed commit before dispatch.
   const stored=await request('https://api.github.com/repos/'+RUNNER_REPO+'/contents/updates/'+name+'?ref='+commit,{token});
   const bytes=Buffer.from((stored.content||'').replace(/\s/g,''),'base64');
   if(sha256(bytes)!==sha256(text))throw Error('E_DISEASE_BRIDGE_GITHUB_SOURCE_MISMATCH');
   await request('https://api.github.com/repos/'+RUNNER_REPO+'/actions/workflows/direct-author-update.yml/dispatches',{
     token,method:'POST',body:{ref:'main',inputs:{source_id:id}}
   });
   console.log('DISEASE_HANDOFF_DISPATCH_REQUESTED '+JSON.stringify({sourceId:id,sourceCommit:commit,diseaseCommit:pinned,digest:sha256(text)}));
   return;
 }
 console.log('DISEASE_HANDOFF_NO_NEW_SOURCES');
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1].replace(/\\/g,'/')){
 main().catch(error=>{console.error(/^E_DISEASE_BRIDGE_[A-Z0-9_]+$/.test(error.message)?error.message:'E_DISEASE_BRIDGE_RUNTIME');process.exitCode=1});
}
export {validateHandoff,sha256};
