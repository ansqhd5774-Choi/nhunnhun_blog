import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';
import { fileURLToPath } from 'node:url';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const workflow=path=>parse(read('.github/workflows/'+path));
test('queue code maintenance does not start production and cancelled runs do not occupy summary runner',()=>{
  const w=workflow('ollama-update-queue.yml');
  assert.deepEqual(w.on.push.paths,['authoring/update-queue.txt']);
  assert.ok(w.on.workflow_dispatch);
  assert.ok(w.on.schedule.length>0);
  assert.match(w.jobs.summary.if,/!cancelled\(\)/);
  assert.match(w.jobs.summary.if,/needs\.produce\.result != 'skipped'/);
  assert.ok(!w.jobs.summary.steps.some(s=>s.run?.includes('pnpm install')));
  assert.ok(w.jobs.summary.steps.some(s=>s.uses==='actions/setup-node@v5'));
});
for(const [file,job,kind]of [['publish-posts.yml','publish','posts'],['update-posts.yml','update','updates']]) {
 test(`${job}: common content paths are watched without broad publish-all paths`,()=>{const w=workflow(file);assert.ok(w.on.push.paths.includes('publishing/content-*.mjs'));assert.ok(w.on.push.paths.includes('publishing/standards/**'));assert.ok(w.on.push.paths.includes('content-reviews/**'));assert.ok(!w.on.push.paths.includes('publishing/**'));});
 test(`${job}: CMD, main-only approval, checkpoint and one-item guards remain`,()=>{const w=workflow(file);assert.equal(w.jobs[job].defaults.run.shell,'cmd');assert.ok(w.jobs[job].if.includes("github.ref == 'refs/heads/main'"));assert.ok(w.jobs[job].if.includes('TISTORY_PUBLISH_ENABLED'));const code=read(`publishing/${job}.mjs`);assert.match(code,job==='publish'?/E_ONE_POST_PER_RUN/:/E_ONE_UPDATE_PER_RUN/);assert.match(code,/phase:'submitting'/);assert.ok(code.indexOf(`assertContentStandard(${job==='publish'?'post':'update'})`)<code.indexOf('await openEditorConnection'));});
 test(`${job}: hosted validation is not the only enforcement point`,()=>{const code=read(`publishing/${job}.mjs`);assert.match(code,/assertContentStandard/);assert.match(code,/assertEmphasisContract/);const w=workflow(file);const validationJob=Object.values(w.jobs)[0];assert.ok(validationJob.steps.some(s=>s.run==='pnpm run validate:content:changed'));});
 test(`${job}: standards-only push does not request public mutation`,()=>{const dir=mkdtempSync(join(tmpdir(),'gate-content-'));try{execFileSync('git',['init','-q'],{cwd:dir});execFileSync('git',['config','user.email','tests@example.invalid'],{cwd:dir});execFileSync('git',['config','user.name','test'],{cwd:dir});writeFileSync(join(dir,'rule.txt'),'one');execFileSync('git',['add','.'],{cwd:dir});execFileSync('git',['commit','-qm','first'],{cwd:dir});const before=execFileSync('git',['rev-parse','HEAD'],{cwd:dir,encoding:'utf8'}).trim();writeFileSync(join(dir,'rule.txt'),'two');execFileSync('git',['add','.'],{cwd:dir});execFileSync('git',['commit','-qm','second'],{cwd:dir});const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:dir,encoding:'utf8'}).trim();const event=join(dir,'event.json');writeFileSync(event,JSON.stringify({before}));const output=execFileSync(process.execPath,[fileURLToPath(new URL('../publishing/mutation-gate.mjs',import.meta.url)),kind],{cwd:dir,encoding:'utf8',env:{...process.env,GITHUB_EVENT_NAME:'push',GITHUB_EVENT_PATH:event,GITHUB_SHA:sha,GITHUB_OUTPUT:''}});assert.match(output,/=false/);}finally{rmSync(dir,{recursive:true,force:true});}});
}
test('publish and update share the physical-browser mutex',()=>assert.equal(workflow('publish-posts.yml').jobs.publish.concurrency.group,workflow('update-posts.yml').jobs.update.concurrency.group));
test('quality CI is read-only on the Windows self-hosted runner and cannot invoke publisher',()=>{const w=workflow('content-standard-ci.yml');assert.deepEqual(w.permissions,{contents:'read'});for(const job of Object.values(w.jobs)){assert.deepEqual(job['runs-on'],['self-hosted','Windows','X64','tistory-publisher']);assert.equal(job.defaults.run.shell,'cmd');assert.ok(job.steps.every(s=>!/(pnpm run (publish|update)\b|publishing\/(publish|update)\.mjs|workflow_dispatch.*publish)/.test(s.run??'')));}assert.ok(w.on.pull_request);});
test('no AI API or paid content service is required by quality modules',()=>{for(const f of ['content-standards','content-tone','content-emphasis','content-decisions','cross-domain'])assert.doesNotMatch(read(`publishing/${f}.mjs`),/OPENAI_API_KEY|ANTHROPIC_API_KEY|api\.openai\.com|api\.anthropic\.com|fetch\(/);});
test('writer instructions and onboarding point to active standards',()=>{for(const p of ['AGENTS.md','README.md','docs/CHATGPT_HANDOFF.md'])assert.match(read(p),/CONTENT_STANDARD_R1/);});
