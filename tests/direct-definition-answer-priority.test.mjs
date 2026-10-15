import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDirectSubmissionEmphasis} from '../publishing/direct-emphasis.mjs';

const quota=()=>{
  const plain=Array.from({length:11},(_,i)=>`<strong>굵게${i+1}</strong>`).join('');
  const l2=Array.from({length:6},(_,i)=>`<mark><strong>하이라이트${i+1}</strong></mark>`).join('');
  const l3=Array.from({length:8},(_,i)=>`<mark><u><strong>최상위${i+1}</strong></u></mark>`).join('');
  return `<h2>2. 핵심 정보</h2>${plain}${l2}${l3}`;
};
const source=bodyHtml=>({id:'direct-definition-priority-test',category:'영양소',contentStandard:'SP1',bodyHtml:quota()+bodyHtml});

test('nutrient H2 #1 rejects product guidance emphasized above the direct definition answer',()=>{
  const body=`<h2>1. 정의와 주요 성분 및 작용은 무엇인가?</h2>
    <p><strong>대두이소플라본은 대두에 자연적으로 존재하는 파이토에스트로겐 계열 성분입니다.</strong></p>
    <p><mark data-tone="info"><u><strong>제품을 고를 때는 대두이소플라본 비배당체 표시량을 확인하십시오.</strong></u></mark></p>`;
  assert.throws(()=>assertDirectSubmissionEmphasis(source(body)),/E_DIRECT_DEFINITION_ANSWER_EMPHASIS_PRIORITY/);
});

test('nutrient H2 #1 passes when the direct definition answer has the strongest emphasis tier',()=>{
  const body=`<h2>1. 정의와 주요 성분 및 작용은 무엇인가?</h2>
    <p><mark data-tone="info"><u><strong>대두이소플라본은 대두에 자연적으로 존재하는 파이토에스트로겐 계열 성분입니다.</strong></u></mark> 대표 성분은 제니스테인·다이드제인·글리시테인입니다.</p>
    <p><mark data-tone="info"><strong>제품 비교에서는 비배당체 표시량을 확인합니다.</strong></mark></p>`;
  assert.doesNotThrow(()=>assertDirectSubmissionEmphasis(source(body)));
});
