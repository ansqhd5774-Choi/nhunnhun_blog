import {execFile,execFileSync} from 'node:child_process';import {promisify} from 'node:util';import {join,resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {setTimeout as delay} from 'node:timers/promises';
import {GitWriter} from './git-writer.mjs';import {remoteSnapshot} from './remote-snapshot.mjs';import {publicAudit} from './public-audit.mjs';
const REPO='ansqhd5774-Choi/nhunnhun_blog',execute=promisify(execFile);
function githubToken(){
  try{
    const credential=execFileSync(process.env.NH_GIT??'C:\\Program Files\\Git\\cmd\\git.exe',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',stdio:['pipe','pipe','pipe'],env:{...process.env,GCM_INTERACTIVE:'never'},timeout:30000});
    const token=credential.split(/\r?\n/).find(s=>s.startsWith('password='))?.slice(9);if(!token)throw new Error();return token;
  }catch{throw new Error('E_GITHUB_AUTH');}
}
async function get(path,token,signal){
  const response=await fetch('https://api.github.com/repos/'+REPO+path,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
  if(response.status===404)return null;if(!response.ok)throw new Error('E_DELIVERY_OBSERVATION');return response.json();
}
export function standardDeliveryServices(source,runtime,{signal}={}){
  const writer=new GitWriter(source,runtime);
  return {writer,snapshot:()=>remoteSnapshot(source,{signal}),
    checks:async prepared=>{
      const pnpm=fileURLToPath(new URL('../../../outputs/tools/pnpm/node_modules/pnpm/bin/pnpm.cjs',import.meta.url));
      const token=githubToken(),env={...process.env,GITHUB_TOKEN:token,GITHUB_REPOSITORY:REPO,PUBLISH_ENABLED:'false',UPDATE_ENABLED:'false'},options={cwd:prepared.worktree,env,windowsHide:true,timeout:180000,signal,maxBuffer:2*1024*1024};
      // No publishing script is invoked by local checks. Mutations remain in Windows CMD workflow jobs.
      for(const args of [[pnpm,'install','--offline','--frozen-lockfile','--ignore-scripts'],['--test','tests/publishing.test.mjs','tests/runner-gate.test.mjs','tests/verification-context.test.mjs','tests/public-verification.test.mjs','tests/active-standard.test.mjs','producer/*.test.mjs'],['publishing/validate.mjs'],['publishing/validate-update.mjs']]){
        try{await execute(process.execPath,args,options);}catch{throw new Error('E_DELIVERY_CHECKS');}
      }
      return {regression:'PASS',source_validation:'PASS',public_backlog:'CLEAR'};
    },
    observe:async job=>{
      if(!/^[a-f0-9]{40}$/.test(job.metadata.source_sha??'')||!/^nh-[a-f0-9-]{36}$/.test('nh-'+job.job_id))throw new Error('E_OBSERVER_IDENTITY');
      const token=githubToken(),sha=job.metadata.source_sha;
      const [page,file]=await Promise.all([get('/actions/workflows/publish-posts.yml/runs?head_sha='+sha+'&event=push&branch=main&per_page=100',token,signal),get('/contents/publishing/state/nh-'+job.job_id+'.json?ref=main',token,signal)]);
      if(!page||page.total_count>100)throw new Error('E_DELIVERY_OBSERVATION');
      let ledger=null;if(file){if(file.encoding!=='base64'||file.type!=='file'||file.size>100000)throw new Error('E_DELIVERY_LEDGER');try{ledger=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));}catch{throw new Error('E_DELIVERY_LEDGER');}}
      return {runs:page.workflow_runs,ledger};
    },
    audit:(post,url)=>publicAudit(post,url,{signal}),wait:()=>delay(15000,undefined,{signal})};
}
