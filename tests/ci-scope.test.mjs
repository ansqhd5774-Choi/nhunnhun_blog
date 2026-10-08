import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import YAML from 'yaml';
const read=n=>YAML.parse(fs.readFileSync('.github/workflows/'+n,'utf8').replace(/^\uFEFF/,''));
test('content CI owns code checks, mutation workflows retain boundary validation',()=>{
 const ci=read('content-standard-ci.yml');
 for(const event of ['push','pull_request']){
  assert.ok(!ci.on[event].paths.includes('.github/workflows/**'));
  assert.ok(!ci.on[event].paths.includes('docs/**'));
  assert.ok(ci.on[event].paths.includes('updates/**'));
 }
 const u=read('update-posts.yml');assert.equal(u.on.push,undefined);
 assert.ok(u.jobs.update.steps.some(s=>s.run==='pnpm run validate:update'));
 const p=read('publish-posts.yml');assert.deepEqual(p.on.push.paths,['posts/**','.github/workflows/publish-posts.yml']);
 assert.ok(p.jobs.publish.steps.some(s=>s.run==='pnpm validate'));
 assert.ok(!p.jobs.publish.steps.some(s=>s.run==='pnpm test'));
 const author=read('generate-draft.yml');assert.ok(author.concurrency.group.includes('github.event.pull_request.number'));
 assert.ok(author.jobs.test.steps.some(s=>s.run==='node --test tests/authoring.test.mjs tests/ollama-authoring.test.mjs'));
});
test('all workflows use dedicated self-hosted runners without hosted fallback',()=>{
 for(const file of fs.readdirSync('.github/workflows').filter(n=>/\.ya?ml$/.test(n))){
  const workflow=read(file);
  for(const [name,job] of Object.entries(workflow.jobs)){
   if(job.uses) continue;
   assert.ok(Array.isArray(job['runs-on']),`${file}/${name}: explicit runner labels required`);
   const labels=job['runs-on'].map(s=>s.toLowerCase());
   assert.ok(labels.includes('self-hosted'),`${file}/${name}: hosted execution prohibited`);
   assert.ok(labels.includes('tistory-validation')||labels.includes('tistory-publisher'),`${file}/${name}: dedicated runner required`);
  }
 }
});
test('runner maintenance executes only on explicit dispatch',()=>{
 const workflow=read('disable-tistory-chrome-autostart.yml');
 assert.deepEqual(Object.keys(workflow.on),['workflow_dispatch']);
});
