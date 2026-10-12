import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {reusableImages} from '../authoring/queue-draft.mjs';

function reviewedImages(){
  return [0,1,2].map(i=>({
    src:`https://commons.wikimedia.org/wiki/Special:Redirect/file/Test_${i}.jpg?width=960`,
    alt:`테스트 이미지 ${i}`,
    role:i===0?'hero':'detail',
    composition:i===0?'closeup':'context',
    sourcePage:`https://commons.wikimedia.org/wiki/File:Test_${i}.jpg`,
    author:'fixture',
    license:'CC BY 4.0',
    visualChecked:true
  }));
}

test('재사용 이미지 메타데이터는 visualChecked 관찰값을 새 원고로 승계하지 않는다',async()=>{
  const root=await mkdtemp(join(tmpdir(),'image-reuse-observation-'));
  try{
    await mkdir(join(root,'updates'),{recursive:true});
    await mkdir(join(root,'authoring','update-source-archive'),{recursive:true});
    await mkdir(join(root,'posts'),{recursive:true});
    const source={id:'direct-old',articleId:'54',title:'레티놀 이전 원고',imageReview:reviewedImages()};
    await writeFile(join(root,'updates','direct-old.json'),JSON.stringify(source));
    const reused=await reusableImages(root,{articleId:'54',keyword:'레티놀'});
    assert.equal(reused.length,3);
    assert.ok(reused.every(image=>!Object.hasOwn(image,'visualChecked')));
    assert.deepEqual(reused.map(image=>image.src),source.imageReview.map(image=>image.src));
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});

test('같은 주제 posts 재사용에서도 visualChecked를 승계하지 않는다',async()=>{
  const root=await mkdtemp(join(tmpdir(),'image-reuse-post-observation-'));
  try{
    await mkdir(join(root,'updates'),{recursive:true});
    await mkdir(join(root,'authoring','update-source-archive'),{recursive:true});
    await mkdir(join(root,'posts'),{recursive:true});
    const source={id:'direct-post',articleId:'999',title:'레티놀 식품과 섭취',imageReview:reviewedImages()};
    await writeFile(join(root,'posts','direct-post.json'),JSON.stringify(source));
    const reused=await reusableImages(root,{articleId:'54',keyword:'레티놀'});
    assert.equal(reused.length,3);
    assert.ok(reused.every(image=>!Object.hasOwn(image,'visualChecked')));
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});
