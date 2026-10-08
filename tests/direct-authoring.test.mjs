import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import YAML from 'yaml';
import {renderEditorialPost} from '../publishing/editorial.mjs';
import {checkUpdateSource} from '../publishing/update-core.mjs';
import {dispatchDirectSource} from '../authoring/direct-dispatch.mjs';
const source={id:'direct-179-test',articleId:'179',targetUrl:'https://nhunnhun.tistory.com/179',expectedCurrentTitle:'감자',title:'감자',category:'음식',contentStandard:'SP1',status:'ready',approved:true,representativeImageUrl:'https://upload.wikimedia.org/wikipedia/commons/f/f3/Potatoes.jpg',bodyHtml:'<p><img src="https://upload.wikimedia.org/wikipedia/commons/f/f3/Potatoes.jpg" alt="감자"></p><h2>소개</h2><p>소개 문장.</p><ul><li><strong>핵심:</strong> 설명 그대로.</li><li><strong>보관:</strong> 조건 그대로.</li></ul><table><tbody><tr><td>성분</td><td>값</td></tr></tbody></table>'};
test('varied renderer assigns layouts by section and preserves emphasis and image',()=>{
 const sections=['소개','영양','신체 변화','궁합','주의','보관'].map((x,i)=>'<h2>'+x+'</h2><ul><li><strong>항목</strong><mark><strong>중요 수치</strong></mark> 설명 그대로.</li></ul>').join('');
 const out=renderEditorialPost({...source,bodyHtml:source.bodyHtml.split('<h2>')[0]+sections});
 for(const name of ['effects','pairs','cautions','storage'])assert.ok(out.includes('class="'+name+'"'));
 assert.ok(!out.includes('card-grid'));assert.ok(out.includes('<small>03</small>'));
 assert.ok(out.includes('<mark><strong>중요 수치</strong></mark>'));assert.equal((out.match(/<img\b/g)||[]).length,1);
 assert.ok(out.includes('font-size:23px'));assert.ok(out.includes('@media(max-width:600px)'));
});
test('workflow starts only from explicit prepared-source dispatch with no AI generation',async()=>{
 const text=await readFile('.github/workflows/direct-author-update.yml','utf8');const workflow=YAML.parse(text.replace(/^\uFEFF/,''));
 assert.deepEqual(Object.keys(workflow.on),['workflow_dispatch']);assert.ok(!/OLLAMA_HOST|update-producer|api\/chat|schedule:/.test(text));
 assert.equal(workflow.jobs.dispatch['runs-on'],'windows-latest');
 const checkout=workflow.jobs.dispatch.steps.find(step=>step.uses==='actions/checkout@v5');
 assert.equal(checkout.with.ref,'${{ github.sha }}');assert.equal(checkout.with['persist-credentials'],false);
 assert.doesNotMatch(text,/RUNNER_WORKSPACE|DIRECT_CHECKOUT|externals\/node24/);
});
test('direct dispatch requires existing approved source and calls existing publish dispatcher once',async()=>{
 const root=await mkdtemp(join(tmpdir(),'nh-direct-'));let calls=0;
 try{await mkdir(join(root,'updates'));await writeFile(join(root,'updates',source.id+'.json'),JSON.stringify(source));const dispatch=async args=>{calls++;assert.equal(args.sourceId,source.id);return {submitted:true};};
 await dispatchDirectSource({root,sourceId:source.id,commitSha:'a'.repeat(40),token:'fixture',dispatch});assert.equal(calls,1);
 await writeFile(join(root,'updates',source.id+'.json'),JSON.stringify({...source,approved:false}));await assert.rejects(dispatchDirectSource({root,sourceId:source.id,dispatch}),/E_UPDATE_APPROVAL/);assert.equal(calls,1);
 await assert.rejects(dispatchDirectSource({root,sourceId:'auto-179-test',dispatch}),/E_DIRECT_SOURCE_ID/);
 }finally{await rm(root,{recursive:true,force:true});}
});
