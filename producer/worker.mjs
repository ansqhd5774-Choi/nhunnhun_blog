import { Queue } from './queue.mjs';
import { processOne } from './orchestrator.mjs';
import { collectEvidence } from './research.mjs';
import { generateDraft } from './draft.mjs';
import { validateDraft } from './validate-draft.mjs';
import { keywordManifest,assertSupportedKeyword } from './keyword.mjs';
import {articleInventory,matchingIntent} from './inventory.mjs';
import {reviewedRelatedLinks} from './related-links.mjs';
import {fileURLToPath} from 'node:url';
import {artifactPath} from './artifacts.mjs';
import { atomicJson } from './artifacts.mjs';
import {authorizeReviewedJob} from './approval.mjs';
import {processDeliveryOne} from './delivery.mjs';
import {standardDeliveryServices} from './delivery-services.mjs';
import {ruleDigest} from './identity.mjs';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { resolve,join } from 'node:path';
import { unlink } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
const runtime=resolve(process.argv[2]??'');
const loadedRuleDigest=await ruleDigest();
if(!process.argv[2])throw new Error('E_RUNTIME_REQUIRED');
const queue=new Queue(join(runtime,'queue.db')),owner=randomUUID(),controller=new AbortController();
queue.db.exec('CREATE TABLE IF NOT EXISTS worker_lock(id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT NOT NULL,lease_until INTEGER NOT NULL)');
const acquired=queue.transaction(()=>{
  const lock=queue.db.prepare('SELECT * FROM worker_lock WHERE id=1').get();
  if(lock&&lock.lease_until>Date.now())return false;
  queue.db.prepare('INSERT INTO worker_lock(id,owner,lease_until) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,lease_until=excluded.lease_until').run(owner,Date.now()+60000);
  return true;
});
if(!acquired){console.log('WORKER_ALREADY_RUNNING');queue.close();process.exit(0);}
const token=randomUUID();
const server=createServer((req,res)=>{
  if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(403);res.end();return;}
  if(req.method==='GET'&&req.url==='/status'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({status:controller.signal.aborted?'STOPPING':'RUNNING',owner,pid:process.pid}));return;}
  if(req.method==='POST'&&req.url==='/stop'){controller.abort();res.writeHead(202);res.end('STOPPING');return;}
  res.writeHead(404);res.end();
});
await new Promise((r,j)=>{server.on('error',j);server.listen(0,'127.0.0.1',r);});
await atomicJson(join(runtime,'worker-control.json'),{owner,token,pid:process.pid,port:server.address().port,started_at:new Date().toISOString()});
const timer=setInterval(()=>{
  const result=queue.db.prepare('UPDATE worker_lock SET lease_until=? WHERE id=1 AND owner=?').run(Date.now()+60000,owner);
  if(!result.changes)controller.abort();
  ruleDigest().then(current=>{if(current!==loadedRuleDigest){console.log('E_RUNNING_PROGRAM_CHANGED');controller.abort();}}).catch(()=>controller.abort());
},10000);
process.on('SIGINT',()=>controller.abort());process.on('SIGTERM',()=>controller.abort());
console.log('WORKER_STARTED');
try{
  while(!controller.signal.aborted){
    if(await ruleDigest()!==loadedRuleDigest){console.log('E_RUNNING_PROGRAM_CHANGED');controller.abort();break;}
    const job=await processOne(queue,runtime,{
      research:async context=>{
        if(context.job.task_type==='NEW'&&!context.job.payload.manifest)await assertSupportedKeyword(context.job.topic,runtime);
        const inventory=await articleInventory(fileURLToPath(new URL('../',import.meta.url)),{signal:context.signal});
        const matches=matchingIntent(context.job.topic,inventory.entries);
        await atomicJson(artifactPath(runtime,context.job.job_id,'intent-review.json'),{coverage:inventory.coverage,matches,status:matches.length?'KNOWN_TOPIC_EXISTS':'COVERAGE_INCOMPLETE'});
        if(context.job.task_type==='NEW'&&matches.length)throw new Error('BLOCKED_EXISTING_TOPIC');
        const related=await reviewedRelatedLinks(context.job.topic,inventory,{signal:context.signal,excludeUrl:context.job.target_url});
        await atomicJson(artifactPath(runtime,context.job.job_id,'related-review.json'),related);
        const manifest=await keywordManifest(context.job,runtime,{signal:context.signal,relatedLinks:related.links});
        if(!manifest.internal_links?.length)throw new Error('BLOCKED_RELATED_LINKS');
        return collectEvidence({...context,job:{...context.job,payload:{...context.job.payload,manifest}}});
      },
      draft:generateDraft,
      validate:validateDraft,
    },{owner,signal:controller.signal});
    if(job){
      if(job.state==='AWAITING_APPROVAL'){
        try{const result=await authorizeReviewedJob(queue,runtime,job.job_id,{pending:queue.list().filter(j=>['READY_TO_INTEGRATE','INTEGRATING','SOURCE_PUSHED','WAITING_RUNNER','RUNNING_WORKFLOW','PUBLIC_VERIFY'].includes(j.state)).length});
          console.log(JSON.stringify({job_id:job.job_id,state:queue.get(job.job_id).state,policy_result:result.allowed?'BOUND':result.reason}));
        }catch(error){console.log(JSON.stringify({job_id:job.job_id,state:queue.get(job.job_id).state,error_code:/^[A-Z_]+$/.test(error.message)?error.message:'E_POLICY_RUNTIME'}));}
      }else console.log(JSON.stringify({job_id:job.job_id,state:job.state,error_code:job.last_error_code}));
    }
    else{
      const delivery=await processDeliveryOne(queue,runtime,standardDeliveryServices(fileURLToPath(new URL('../',import.meta.url)),runtime,{signal:controller.signal}),{owner,signal:controller.signal});
      if(delivery&&delivery.state!=='DELIVERY_DISABLED')console.log(JSON.stringify({job_id:delivery.job_id,state:delivery.state,error_code:delivery.last_error_code}));
      else await delay(1000,undefined,{signal:controller.signal}).catch(()=>{});
    }
  }
}finally{
  clearInterval(timer);server.close();
  const current=queue.db.prepare('SELECT owner FROM worker_lock WHERE id=1').get();
  if(current?.owner===owner){queue.db.prepare('DELETE FROM worker_lock WHERE id=1 AND owner=?').run(owner);await unlink(join(runtime,'worker-control.json')).catch(()=>{});}
  queue.close();console.log('WORKER_STOPPED');
}
