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

test('missing source or rights description and repeated image URLs remain rejected',()=>{
  const badLicense=fixture();
  badLicense.imageReview[0].license='';
  assert.throws(()=>assertImageReview(badLicense),/E_IMAGE_REVIEW_LICENSE/);
  const noAuthor=fixture();
  noAuthor.imageReview[0].author='';
  assert.throws(()=>assertImageReview(noAuthor),/E_IMAGE_REVIEW_LICENSE/);
  const duplicate=fixture();
  duplicate.imageReview[1].sourcePage=duplicate.imageReview[0].sourcePage;
  assert.throws(()=>assertImageReview(duplicate),/E_IMAGE_REVIEW_DUPLICATE/);
});

test('factual product identification and credited editorial images are not restricted to CC licenses',()=>{
  const item=fixture();
  item.imageReview[0].license='제조사 공식 제품 식별 사진 · 설명 목적';
  item.imageReview[0].author='제조사 공식 제품 페이지 (촬영자 미표기)';
  item.imageReview[0].composition='context';
  item.imageReview[1].license='출처 표시 · 실물 식별 참고 사진';
  item.imageReview[1].composition='serving';
  assert.doesNotThrow(()=>assertImageReview(item));
});

test('distinct photos may share one original source page while duplicate images stay blocked',()=>{
  const item=fixture();
  const samePage=item.imageReview[0].sourcePage;
  const oldPage=item.imageReview[1].sourcePage;
  item.imageReview[1].sourcePage=samePage;
  item.bodyHtml=item.bodyHtml.replace('<li><a href="'+oldPage+'">사진 원출처</a></li>','');
  assert.doesNotThrow(()=>assertImageReview(item));
  item.imageReview[1].src=item.imageReview[0].src;
  item.bodyHtml=item.bodyHtml.replace('https://medical.example.org/photos/a.jpg',item.imageReview[0].src);
  assert.throws(()=>assertImageReview(item),/E_IMAGE_REVIEW_DUPLICATE/);
});

test('explicitly missing credit information does not become a false permission claim',()=>{
  for(const value of ['Unknown','미확인','없음']){
    const item=fixture();
    item.imageReview[0].license=value;
    assert.throws(()=>assertImageReview(item),/E_IMAGE_REVIEW_LICENSE/);
  }
});
