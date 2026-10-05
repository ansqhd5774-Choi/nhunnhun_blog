import {readFile,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
export async function ruleDigest(){
  const paths=[...(await readdir(new URL('./',import.meta.url))).filter(p=>p.endsWith('.mjs')&&!p.endsWith('.test.mjs')).sort().map(p=>'./'+p),...(await readdir(new URL('../publishing/',import.meta.url))).filter(p=>p.endsWith('.mjs')).sort().map(p=>'../publishing/'+p),'../package.json','../pnpm-lock.yaml','../.github/workflows/publish-posts.yml','../.github/workflows/update-posts.yml','../docs/EDITORIAL_PUBLISH_STANDARD_R3.md'];
  const hash=createHash('sha256');for(const path of paths){hash.update(path);hash.update(await readFile(new URL(path,import.meta.url)));}return hash.digest('hex');
}
export function localSourceSha(){try{const sha=execFileSync(process.env.NH_GIT??'C:\\Program Files\\Git\\cmd\\git.exe',['rev-parse','HEAD'],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();return /^[a-f0-9]{40}$/.test(sha)?sha:null;}catch{return null;}}
export function assertIntegratedSource(source=fileURLToPath(new URL('../',import.meta.url))){
  try{
    const run=args=>execFileSync(process.env.NH_GIT??'C:\\Program Files\\Git\\cmd\\git.exe',args,{cwd:source,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    if(run(['status','--porcelain','--untracked-files=no']))throw new Error();
    run(['ls-files','--error-unmatch','producer/worker.mjs','producer/delivery.mjs','publishing/public-quality.mjs']);
  }catch{throw new Error('E_PROGRAM_NOT_INTEGRATED');}
}
