import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDirectSubmissionEmphasis} from '../publishing/direct-emphasis.mjs';

const filler='<h2>2. 핵심 정보</h2>'+Array.from({length:10},(_,i)=>`<strong>굵게${i+1}</strong>`).join('')+Array.from({length:5},(_,i)=>`<mark><strong>하이라이트${i+1}</strong></mark>`).join('')+'<mark><u><strong>최상위1</strong></u></mark><mark><u><strong>최상위2</strong></u></mark>';
const table=top3=>`<h2>4. 카제인이 풍부한 식품 TOP7과 평균 함량은?</h2><table><tbody>
<tr><td>1</td><td>${top3[0]}</td><td>35.8g</td></tr>
<tr><td>2</td><td>${top3[1]}</td><td>24.0g</td></tr>
<tr><td>3</td><td>${top3[2]}</td><td>19.8g</td></tr>
<tr><td>4</td><td>크림치즈</td><td>5.9g</td></tr>
</tbody></table>`;
const source=bodyHtml=>({id:'direct-top3-test',category:'영양소',contentStandard:'SP1',bodyHtml:filler+bodyHtml});

test('nutrient TOP food table rejects an unhighlighted rank among 1-3',()=>{
  const body=table([
    '<mark data-tone="info"><u><strong>파르메산 치즈</strong></u></mark>',
    '<mark data-tone="info"><strong>체더 치즈</strong></mark>',
    '카망베르 치즈'
  ]);
  assert.throws(()=>assertDirectSubmissionEmphasis(source(body)),/E_DIRECT_TOP3_EMPHASIS_MISSING/);
});

test('nutrient TOP food table accepts visible emphasis on ranks 1-3',()=>{
  const body=table([
    '<mark data-tone="info"><u><strong>파르메산 치즈</strong></u></mark>',
    '<mark data-tone="info"><strong>체더 치즈</strong></mark>',
    '<mark data-tone="info"><strong>카망베르 치즈</strong></mark>'
  ]);
  assert.doesNotThrow(()=>assertDirectSubmissionEmphasis(source(body)));
});
