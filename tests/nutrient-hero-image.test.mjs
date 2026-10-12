import test from 'node:test';
import assert from 'node:assert/strict';
import {assertImageReview} from '../publishing/image-review.mjs';

function fixture(heroPage='https://commons.wikimedia.org/wiki/File:Track_cycling_six_days_02.JPG'){
  const heroSrc='https://commons.wikimedia.org/wiki/Special:Redirect/file/Track%20cycling%20six%20days%2002.JPG?width=960';
  const secondSrc='https://commons.wikimedia.org/wiki/Special:Redirect/file/Rowing%20Machines.jpg?width=960';
  const thirdSrc='https://commons.wikimedia.org/wiki/Special:Redirect/file/Close-up%20of%20the%20chicken%20breast%20on%20a%20cutting%20board.jpg?width=960';
  const hero={src:heroSrc,alt:'고강도 트랙 사이클 경기 장면',role:'hero',composition:'closeup',sourcePage:heroPage,author:'Walter Mier',license:'CC BY-SA 3.0'};
  const review=[
    hero,
    {src:secondSrc,alt:'실내 로잉머신 고강도 훈련 장면',role:'context',composition:'context',sourcePage:'https://commons.wikimedia.org/wiki/File:Rowing_Machines.jpg',author:'Airman 1st Class Erin Currie',license:'Public Domain'},
    {src:thirdSrc,alt:'도마 위 닭가슴살 식품 사진',role:'context',composition:'closeup',sourcePage:'https://commons.wikimedia.org/wiki/File:Close-up_of_the_chicken_breast_on_a_cutting_board.jpg',author:'Shixart1985',license:'CC BY 2.0'}
  ];
  const bodyHtml=review.map(r=>`<p><img src="${r.src}" alt="${r.alt}"></p>`).join('')+
    '<h2>자료 출처</h2><ul>'+review.map(r=>`<li><a href="${r.sourcePage}">image</a></li>`).join('')+'</ul>';
  return {category:'영양소',representativeImageUrl:heroSrc,imageReview:review,bodyHtml};
}

test('nutrient hero accepts reader-facing real-world imagery',()=>{
  assert.doesNotThrow(()=>assertImageReview(fixture()));
});

test('nutrient hero rejects molecular, microscopy and crystal-style source filenames',()=>{
  for(const page of [
    'https://commons.wikimedia.org/wiki/File:Beta-alanine_structure.svg',
    'https://commons.wikimedia.org/wiki/File:Beta_alanyl_crystal.jpg',
    'https://commons.wikimedia.org/wiki/File:Vitamin_molecule_structure.png',
    'https://commons.wikimedia.org/wiki/File:Nutrient_microscope_view.jpg',
    'https://commons.wikimedia.org/wiki/File:Beta-alaniini_kristallid_polariseeritud_valguses.jpg'
  ]){
    const item=fixture(page);
    item.imageReview[0]={...item.imageReview[0],sourcePage:page};
    item.bodyHtml=item.bodyHtml.replace('https://commons.wikimedia.org/wiki/File:Track_cycling_six_days_02.JPG',page);
    assert.throws(()=>assertImageReview(item),/E_IMAGE_HERO_REJECTED/);
  }
});
