import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import YAML from 'yaml';
test('manual update prepares once while push validation remains read-only',()=>{
 const w=YAML.parse(fs.readFileSync('.github/workflows/update-posts.yml','utf8').replace(/^\uFEFF/,''));
 assert.equal(w.jobs['validate-update'].if,"github.event_name == 'push'");
 const job=w.jobs.update;
 assert.equal(job.needs,undefined);
 for(const guard of ['workflow_dispatch','inputs.update == true','TISTORY_PUBLISH_ENABLED',"refs/heads/main"])assert.ok(job.if.includes(guard));
 assert.equal(job.steps.filter(s=>s.uses==='actions/checkout@v5').length,1);
 assert.equal(job.steps.filter(s=>s.run==='pnpm install --frozen-lockfile --ignore-scripts').length,1);
 assert.ok(job.steps.some(s=>s.run?.includes("runContentCli(['--check'")));
 assert.equal(job.env.UPDATE_SOURCE_ID,'${{ inputs.source_id }}');
 assert.equal(job.concurrency.group,'nhunnhun-tistory-mutation');
 assert.ok(job.steps.some(s=>s.run==='node publishing/runner-gate.mjs'));
});
