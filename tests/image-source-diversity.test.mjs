import test from 'node:test';
import assert from 'node:assert/strict';
import {assertImageReview} from '../publishing/image-review.mjs';

function fixture() {
  const review = [
    {src:'https://wwwn.cdc.gov/phil/PHIL_Images/24355/24355_lores.jpg',
      alt:'여드름 면포와 붉은 염증 병변을 보여 주는 CDC 임상사진',
      role:'hero',composition:'closeup',
      sourcePage:'https://wwwn.cdc.gov/phil/Details.aspx?pid=24355',
      author:'CDC / Dr. Hudson',license:'Public Domain'},
    {src:'https://medical.example.org/photos/a.jpg',
      alt:'얼굴의 구진 형태를 보여 주는 공개 사용 사진',
      role:'detail',composition:'closeup',
      sourcePage:'https://medical.example.org/source/a',
      author:'Clinical image fixture',license:'CC BY 4.0'},
    {src:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Test.jpg',
      alt:'다른 병변 형태를 보여 주는 진단 예시 사진',
      role:'detail',composition:'closeup',
      sourcePage:'https://commons.wikimedia.org/wiki/File:Test.jpg',
      author:'Commons fixture',license:'CC0'}
  ];
  const bodyHtml = review.map(x=>`<p><img src="${x.src}" alt="${x.alt}"></p>`).join('')+
    '<h2>자료 출처</h2><ul>'+
    review.map(x=>`<li><a href="${x.sourcePage}">사진 원출처</a></li>`).join('')+'</ul>';
  return {category:'질병',representativeImageUrl:review[0].src,imageReview:review,bodyHtml};
}

test('licensed medical images can have CDC, other HTTPS, or Wikimedia original pages',()=>{
  assert.doesNotThrow(()=>assertImageReview(fixture()));
});

test('source URL must remain HTTPS without embedded credentials',()=>{
  for(const wrong of ['http://wwwn.cdc.gov/phil/Details.aspx?pid=24355',
    'https://user:pass@wwwn.cdc.gov/phil/Details.aspx?pid=24355',
    'javascript:alert(1)']){
    const item=fixture();
    item.imageReview[0].sourcePage=wrong;
    assert.throws(()=>assertImageReview(item),/E_IMAGE_REVIEW_SOURCE/);
  }
});

test('original source still requires a matching attribution link',()=>{
  const item=fixture();
  item.bodyHtml=item.bodyHtml.replace('https://wwwn.cdc.gov/phil/Details.aspx?pid=24355',
    'https://wwwn.cdc.gov/phil/Details.aspx?pid=0');
  assert.throws(()=>assertImageReview(item),/E_IMAGE_REVIEW_ATTRIBUTION/);
});

test('unlicensed, missing-author and repeated image evidence remains rejected',()=>{
  const badLicense=fixture();
  badLicense.imageReview[0].license='All rights reserved';
  assert.throws(()=>assertImageReview(badLicense),/E_IMAGE_REVIEW_LICENSE/);
  const noAuthor=fixture();
  noAuthor.imageReview[0].author='';
  assert.throws(()=>assertImageReview(noAuthor),/E_IMAGE_REVIEW_LICENSE/);
  const duplicate=fixture();
  duplicate.imageReview[1].sourcePage=duplicate.imageReview[0].sourcePage;
  assert.throws(()=>assertImageReview(duplicate),/E_IMAGE_REVIEW_DUPLICATE/);
});
