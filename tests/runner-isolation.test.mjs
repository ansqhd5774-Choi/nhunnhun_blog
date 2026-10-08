import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import YAML from 'yaml';
const read=name=>YAML.parse(fs.readFileSync('.github/workflows/'+name,'utf8').replace(/^\uFEFF/,''));
test('validation and dispatch never occupy publishing runner',()=>{
 for(const file of ['content-standard-ci.yml','generate-draft.yml','validate-blog-source.yml','direct-author-update.yml']){
  for(const job of Object.values(read(file).jobs))assert.ok(job['runs-on'].includes('tistory-validation'));
 }
 for(const [file,validation,publish]of [['update-posts.yml','validate-update','update'],['publish-posts.yml','validate','publish']]){
  const w=read(file);
  if(w.jobs[validation])assert.ok(w.jobs[validation]['runs-on'].includes('tistory-validation'));
  assert.ok(w.jobs[publish]['runs-on'].includes('tistory-publisher'));
  assert.equal(w.jobs[publish].concurrency.group,'nhunnhun-tistory-mutation');
 }
});
