import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDirectSubmissionEmphasis} from '../publishing/direct-emphasis.mjs';

const quotaBody=()=>{
  const plain=Array.from({length:11},(_,i)=>`<strong>굵게${i+1}</strong>`).join('');
  const l2=Array.from({length:6},(_,i)=>`<mark><strong>핵심${i+1}</strong></mark>`).join('');
  const l3=Array.from({length:8},(_,i)=>`<mark><u><strong>최상위${i+1}</strong></u></mark>`).join('');
  return `<h2>1. 정의와 주요 성분 및 작용은 무엇인가?</h2>${plain}${l2}${l3}`;
};

const source=extra=>({
  id:'direct-nutrient-highlight-phrase-test',
  category:'영양소',
  contentStandard:'SP1',
  bodyHtml:quotaBody()+extra
});

test('nutrient rejects a full narrative sentence inside mark',()=>{
  const html='<h2>2. 한 달 복용 후 기대되는 신체 변화는 무엇인가?</h2><mark data-tone="positive"><strong>약 4주 전후에는 일부 성인에서 혈압이 조금 낮아질 수 있지만 운동 능력 변화는 뚜렷하지 않을 수 있습니다.</strong></mark>';
  assert.throws(()=>assertDirectSubmissionEmphasis(source(html)),/E_DIRECT_NUTRIENT_HIGHLIGHT_NARRATIVE/);
});

test('nutrient accepts a short result phrase instead of narrative highlight',()=>{
  const html='<h2>2. 한 달 복용 후 기대되는 신체 변화는 무엇인가?</h2><mark data-tone="positive"><strong>수축기 혈압 평균 6.4mmHg 감소</strong></mark>';
  assert.doesNotThrow(()=>assertDirectSubmissionEmphasis(source(html)));
});

test('nutrient rejects sentence punctuation even when the sentence is short',()=>{
  const html='<h2>3. 일일 권장 섭취량과 효과적인 섭취법은 무엇인가?</h2><mark data-tone="info"><strong>하루 3g을 섭취합니다.</strong></mark>';
  assert.throws(()=>assertDirectSubmissionEmphasis(source(html)),/E_DIRECT_NUTRIENT_HIGHLIGHT_NARRATIVE/);
});
