import test from 'node:test';
import assert from 'node:assert/strict';
import {assertImageReview} from '../publishing/image-review.mjs';
import {isRejectedHeroSource} from '../publishing/rejected-hero-sources.mjs';

const rejected='https://commons.wikimedia.org/wiki/File:Beef_liver_nicely_cooked_at_Phakwe_Cattle_post.jpg';

function fixture({heroPage='https://commons.wikimedia.org/wiki/File:Retinol_fixture.jpg'}={}){
  const review=[
    {
      src:heroPage===rejected
        ? 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Beef_liver_nicely_cooked_at_Phakwe_Cattle_post.jpg?width=960'
        : 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Retinol_fixture.jpg?width=960',
      alt:'레티놀 주제를 직접 보여 주는 대표 이미지',role:'hero',composition:'closeup',
      sourcePage:heroPage,author:'fixture',license:'CC BY 4.0'
    },
    {
      src:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Egg_fixture.jpg?width=960',
      alt:'비타민 A 공급 식품인 달걀 이미지',role:'detail',composition:'context',
      sourcePage:'https://commons.wikimedia.org/wiki/File:Egg_fixture.jpg',author:'fixture',license:'CC BY 4.0'
    },
    {
      src:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Serum_fixture.jpg?width=960',
      alt:'바르는 레티놀 제품을 보여 주는 이미지',role:'context',composition:'closeup',
      sourcePage:'https://commons.wikimedia.org/wiki/File:Serum_fixture.jpg',author:'fixture',license:'CC BY 4.0'
    }
  ];
  const bodyHtml=review.map(x=>`<p><img src="${x.src}" alt="${x.alt}"></p>`).join('')+
    '<h2>자료 출처</h2><ul>'+review.map(x=>`<li><a href="${x.sourcePage}">원출처</a></li>`).join('')+'</ul>';
  return {representativeImageUrl:review[0].src,imageReview:review,bodyHtml};
}

test('actual visual rejection registry blocks the known unsuitable retinol hero',()=>{
  assert.equal(isRejectedHeroSource(rejected),true);
  assert.throws(()=>assertImageReview(fixture({heroPage:rejected})),/E_IMAGE_HERO_REJECTED/);
});

test('hero rejection registry does not make visualChecked mandatory',()=>{
  const item=fixture();
  assert.doesNotThrow(()=>assertImageReview(item));
  assert.doesNotThrow(()=>assertImageReview({...item,imageReview:item.imageReview.map(x=>({...x,visualChecked:false}))}));
});
