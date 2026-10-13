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
