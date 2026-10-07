import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function createStageCache(directory, { now = () => Date.now(), maxAgeMs = 24 * 60 * 60 * 1000 } = {}) {
  return async function cached(stage, input, action, onHit = () => {}) {
    if (!/^[a-z][a-z0-9-]+$/.test(stage)) throw Error('E_QUEUE_CACHE_STAGE');
    const key = digest(input), path = resolve(directory, `${stage}-${key}.json`);
    let saved;
    try { saved = JSON.parse(await readFile(path, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
    const age = saved ? now() - saved.createdAt : Infinity;
    if (saved?.key === key && age >= 0 && age <= maxAgeMs) { onHit(stage); return saved.value; }
    const value = await action();
    await mkdir(directory, { recursive: true });
    const temporary = path + `.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify({ key, createdAt: now(), value }) + '\n');
    await rename(temporary, path);
    return value;
  };
}

// Fingerprint executable policy, not article/state commits, so safe reruns can reuse drafts.
export async function producerPolicyDigest(root) {
  const paths = ['authoring/queue-single-pass.mjs', 'authoring/queue-efficient.mjs', 'authoring/queue-r53.mjs', 'authoring/queue-plan.mjs',
    'authoring/queue-review.mjs', 'authoring/queue-research.mjs', 'authoring/queue-ollama.mjs','authoring/queue-evidence-support.mjs',
    'authoring/ollama.mjs', 'authoring/queue-checkpoint.mjs', 'authoring/update-producer.mjs',
    'publishing/content-standards.mjs', 'publishing/editorial.mjs', 'publishing/content-emphasis.mjs',
    'publishing/content-tone.mjs', 'publishing/content-decisions.mjs', 'publishing/cross-domain.mjs',
    'publishing/standards/common.mjs', ...['food','nutrient','medicine','disease'].map(d => `publishing/standards/${d}.mjs`),
    'package.json', 'pnpm-lock.yaml'];
  return digest(await Promise.all(paths.map(async path => [path, await readFile(resolve(root, path), 'utf8')])));
}

export async function recordAttempt(directory, articleId, metrics) {
  if(!/^\d+$/.test(articleId))throw Error('E_QUEUE_METRICS_TARGET');
  const path=resolve(directory,`attempts-${articleId}.json`);
  let attempts=[];
  try{attempts=JSON.parse(await readFile(path,'utf8')).attempts??[];}catch(error){if(error.code!=='ENOENT')throw error;}
  const entry={attemptId:metrics.attemptId,policyVersion:metrics.policyVersion,dryRun:metrics.dryRun,
    startedAt:metrics.startedAt,completedAt:metrics.completedAt,totalMs:metrics.totalMs,result:metrics.result,error:metrics.error,
    modelCalls:metrics.modelCalls,cacheHits:metrics.cacheHits};
  attempts=attempts.filter(a=>a.attemptId!==entry.attemptId);attempts.push(entry);
  const totalExecutionMs=attempts.reduce((sum,a)=>sum+a.totalMs,0);
  await mkdir(directory,{recursive:true});
  const temporary=path+`.${process.pid}.tmp`;
  await writeFile(temporary,JSON.stringify({articleId,attempts,totalExecutionMs})+'\n');await rename(temporary,path);
  return {recordedAttempts:attempts.length,totalExecutionMs,measurementScope:'local-R5.4-attempts'};
}
