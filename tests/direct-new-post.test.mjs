import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {checkPost,checkPublishHtml,loadPosts} from '../publishing/core.mjs';

const post={id:'direct-new-test',title:'신규 글',category:'음식',tags:[],status:'ready',approved:true,contentStandard:'SP1',representativeImageUrl:'https://example.com/a.jpg',bodyHtml:'<p><mark><strong>핵심 조건</strong></mark></p>'};
test('new direct post keeps approval, image and emphasis protections',()=>{
  assert.doesNotThrow(()=>{checkPost(post,post.id+'.json');checkPublishHtml(post);});
  assert.throws(()=>checkPublishHtml({...post,bodyHtml:'<p>강조 없음</p>'}),/E_DIRECT_EMPHASIS_MISSING/);
  assert.throws(()=>checkPublishHtml({...post,representativeImageUrl:undefined}),/E_REPRESENTATIVE_IMAGE/);
  assert.throws(()=>checkPost({...post,id:'legacy-test'},'legacy-test.json'),/E_CONTENT_STANDARD_VERSION/);
});
test('selected new post does not load unrelated pending posts',async()=>{
  const root=await mkdtemp(join(tmpdir(),'nh-new-post-'));
  try{
    await writeFile(join(root,post.id+'.json'),JSON.stringify(post));
    await writeFile(join(root,'unrelated.json'),'invalid unrelated source');
    assert.deepEqual((await loadPosts(root,post.id)).map(p=>p.id),[post.id]);
    await assert.rejects(loadPosts(root,'missing-test'),/E_POST_TARGET_SOURCE_NOT_FOUND/);
    await assert.rejects(loadPosts(root,'../bad'),/E_POST_TARGET_ID/);
  }finally{await rm(root,{recursive:true,force:true});}
});
