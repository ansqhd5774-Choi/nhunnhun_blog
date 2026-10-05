import {execFileSync} from 'node:child_process';
import {eligible} from '../publishing/core.mjs';
import {eligibleUpdate} from '../publishing/update-core.mjs';
import {classifyRunners} from '../publishing/runner-gate.mjs';
const REPO='ansqhd5774-Choi/nhunnhun_blog';
const WORKFLOWS=['.github/workflows/publish-posts.yml','.github/workflows/update-posts.yml'];
export function mutationGroup(yaml,job){
  const block=yaml.match(new RegExp('^  '+job+':\\s*\\r?\\n([\\s\\S]*?)(?=^  [a-zA-Z_-]+:|$(?![\\s\\S]))','m'))?.[1];
  return block?.match(/^    concurrency:\s*\r?\n      group: ([a-z0-9-]+)\s*\r?\n      cancel-in-progress: false/m)?.[1]??null;
}
export function analyzeBacklog(posts,updates,states,updateStates){
  const pending=[],uncertain=[];
  for(const [items,ledger,check,kind] of [[posts,states,eligible,'NEW'],[updates,updateStates,eligibleUpdate,'UPDATE']]){
    for(const item of items){try{if(check(item,ledger[item.id]??null))pending.push({id:item.id,kind});}catch{uncertain.push({id:item.id,kind,status:'RECONCILIATION_REQUIRED'});}}
  }
  return {pending_sources:pending,uncertain_sources:uncertain};
}
export function ledgerLimits(states,updateStates){
  const entries=[...Object.values(states),...Object.values(updateStates)];
  const completed=entries.filter(s=>['published','updated'].includes(s.phase));
  if(completed.some(s=>!Number.isFinite(Date.parse(s.timestamp))))throw new Error('E_REMOTE_LEDGER_TIME');
  return {last_published_at:Math.max(0,...completed.map(s=>Date.parse(s.timestamp))),publication_holds:entries.filter(s=>['E_TISTORY_HUMAN_VERIFICATION_REQUIRED','E_TISTORY_DAILY_PUBLISH_LIMIT','E_PUBLISH_RATE_LIMIT'].includes(s.failureCode)).map(s=>({failure_code:s.failureCode,phase:s.phase}))};
}
// Git credentials remain in memory. Only GET requests and local fetch are permitted here.
export async function remoteSnapshot(source,{signal}={}){
  const git=args=>{try{return execFileSync(process.env.NH_GIT??'C:\\Program Files\\Git\\cmd\\git.exe',args,{cwd:source,encoding:'utf8',stdio:['pipe','pipe','pipe'],env:{...process.env,GCM_INTERACTIVE:'never'},timeout:30000}).trim();}catch{throw new Error('E_REMOTE_SNAPSHOT_GIT');}};
  git(['fetch','origin','main']);const sha=git(['rev-parse','origin/main']);
  if(!/^[a-f0-9]{40}$/.test(sha))throw new Error('E_REMOTE_SNAPSHOT_SHA');
  const paths=git(['ls-tree','-r','--name-only',sha]).split(/\r?\n/);
  const jsonDirectory=directory=>paths.filter(p=>new RegExp('^'+directory+'/[^/]+\\.json$').test(p)).map(p=>JSON.parse(git(['show',sha+':'+p])));
  const states=directory=>Object.fromEntries(paths.filter(p=>p.startsWith(directory+'/')&&p.endsWith('.json')).map(p=>[p.split('/').at(-1).slice(0,-5),JSON.parse(git(['show',sha+':'+p]))]));
  const newStates=states('publishing/state'),existingStates=states('publishing/update-state');
  const backlog=analyzeBacklog(jsonDirectory('posts'),jsonDirectory('updates'),newStates,existingStates),limits=ledgerLimits(newStates,existingStates);
  const groups=[mutationGroup(git(['show',sha+':'+WORKFLOWS[0]]),'publish'),mutationGroup(git(['show',sha+':'+WORKFLOWS[1]]),'update')];
  let credential;try{credential=execFileSync(process.env.NH_GIT??'C:\\Program Files\\Git\\cmd\\git.exe',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',stdio:['pipe','pipe','pipe'],env:{...process.env,GCM_INTERACTIVE:'never'},timeout:30000});}catch{throw new Error('E_GITHUB_AUTH');}
  const token=credential.split(/\r?\n/).find(s=>s.startsWith('password='))?.slice(9);if(!token)throw new Error('E_GITHUB_AUTH');
  const get=async path=>{const r=await fetch('https://api.github.com/repos/'+REPO+path,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});if(!r.ok)throw new Error('E_REMOTE_SNAPSHOT_API');return r.json();};
  const [runners,main,...runPages]=await Promise.all([get('/actions/runners?per_page=100'),get('/git/ref/heads/main'),...['queued','in_progress','waiting','pending','requested'].map(status=>get('/actions/runs?status='+status+'&per_page=100'))]);
  if(main.object?.sha!==sha||git(['ls-remote','origin','refs/heads/main']).split(/\s+/)[0]!==sha)throw new Error('BLOCKED_SOURCE_DRIFT');
  if(runners.total_count>100||runPages.some(p=>p.total_count>100))throw new Error('E_REMOTE_SNAPSHOT_INCOMPLETE');
  const active=[...new Map(runPages.flatMap(p=>p.workflow_runs).filter(r=>WORKFLOWS.includes(r.path)).map(r=>[r.id,r])).values()].map(r=>({id:r.id,path:r.path,sha:r.head_sha,status:r.status}));
  return {main_sha:sha,retrieved_at:new Date().toISOString(),active_runs:active,...backlog,...limits,
    shared_mutex_verified:groups.every(g=>g==='nhunnhun-tistory-mutation'),mutation_groups:groups,
    runner_status:classifyRunners(runners.runners),
    runner_ready:runners.runners.some(r=>r.status==='online'&&!r.busy&&['self-hosted','windows','x64','tistory-publisher'].every(label=>r.labels.some(l=>l.name.toLowerCase()===label))),
    public_backlog:backlog.pending_sources.length||backlog.uncertain_sources.length?'BLOCKED':'CLEAR'};
}
