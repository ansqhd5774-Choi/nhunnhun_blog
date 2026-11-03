import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDirectSubmissionEmphasis} from '../publishing/direct-emphasis.mjs';

const body=({tone='positive'}={})=>{
  const plain=Array.from({length:14},(_,i)=>`<strong>핵심${i+1}</strong>`).join('');
  const marked=Array.from({length:2},(_,i)=>`<mark data-tone="${tone}"><strong>긍정 정보${i+1}</strong></mark>`).join('');
  const top=Array.from({length:2},(_,i)=>`<mark data-tone="${tone}"><u><strong>실천 기준${i+1}</strong></u></mark>`).join('');
  return `<h2>2. 핵심 정보</h2>${plain}${marked}${top}`;
};

test('semantic highlight diversity is optional, not a publication quota',()=>{
  assert.doesNotThrow(()=>assertDirectSubmissionEmphasis({
    id:'direct-food-highlight-policy',category:'음식',contentStandard:'SP1',bodyHtml:body({tone:'positive'})
  }));
});

import {assertFoodHighlightPhrases} from '../publishing/food-highlight-phrase.mjs';

const foodSixSections=({openingMark=false,emergencyMark=false}={})=>{
  const intro='<p>처음 고르는 생선을 알아볼 때 냉장 상태와 손질 방법을 함께 살펴보세요.</p>';
  const opening='<h2>1. 소개</h2><p>'+('이 생선은 구입할 때 냉장 상태를 확인하고 손질 방법을 선택해야 합니다. ').repeat(16)
    +(openingMark?'<mark data-tone="info"><strong>냉장 상태와 손질 방법 확인</strong></mark>':'')+'</p>';
  const middle='<h2>2. 영양소·핵심 성분</h2><mark data-tone="positive"><strong>단백질 · 근육 구성</strong></mark>'
    +'<h2>3. 꾸준 섭취 변화</h2><p>단백질 반찬으로 활용합니다.</p>'
    +'<h2>4. 궁합·시너지</h2><p>채소와 어울립니다.</p>';
  const emergency='<h2>5. 주의사항</h2><p>호흡이 어려워지면 '
    +(emergencyMark?'<mark data-tone="caution"><u><strong>즉시 119에 도움을 요청하세요</strong></u></mark>':'즉시 119에 도움을 요청하세요')+'.</p>';
  return intro+opening+middle+emergency+'<h2>6. 고르는 법·보관법</h2><p>냉장 보관합니다.</p>';
};
const scanSource=bodyHtml=>({id:'direct-food-scan-regression',title:'생선 조리법',category:'음식',contentStandard:'SP1',bodyHtml});

test('food scan detects an entirely empty long opening without requiring a number of marks',()=>{
  assert.throws(()=>assertFoodHighlightPhrases(scanSource(foodSixSections({emergencyMark:true}))),
    /E_DIRECT_FOOD_HIGHLIGHT_OPENING_GAP/);
});

test('food scan catches an unhighlighted emergency instruction even when other highlights exist',()=>{
  assert.throws(()=>assertFoodHighlightPhrases(scanSource(foodSixSections({openingMark:true}))),
    /E_DIRECT_FOOD_HIGHLIGHT_EMERGENCY_GAP/);
});

test('food scan accepts short actionable highlights without any per-section quota',()=>{
  assert.doesNotThrow(()=>assertFoodHighlightPhrases(scanSource(foodSixSections({openingMark:true,emergencyMark:true}))));
  assert.doesNotThrow(()=>assertFoodHighlightPhrases(scanSource('<h2>1. 소개</h2><mark data-tone="info"><strong>단백질 반찬으로 활용</strong></mark>')));
});
