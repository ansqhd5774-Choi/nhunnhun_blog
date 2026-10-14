import test from 'node:test';
import assert from 'node:assert/strict';
import {DIRECT_EMPHASIS_MINIMUMS,DIRECT_NUTRIENT_EMPHASIS_MINIMUMS,DIRECT_FOOD_EMPHASIS_MINIMUMS,assertDirectEmphasis,assertDirectSubmissionEmphasis} from '../publishing/direct-emphasis.mjs';

const quotaBody=({plainBold=10,level2=6,level3=2,heading='2. 핵심 정보'}={})=>{
  const plain=Array.from({length:plainBold},(_,i)=>`<strong>굵게${i+1}</strong>`).join('');
  const l2=Array.from({length:level2},(_,i)=>`<mark><strong>하이라이트${i+1}</strong></mark>`).join('');
  const l3=Array.from({length:level3},(_,i)=>`<mark><u><strong>최상위${i+1}</strong></u></mark>`).join('');
  return `<h2>${heading}</h2>${plain}${l2}${l3}`;
};
const nutrientQuotaBody=({heading='2. 핵심 정보'}={})=>quotaBody({plainBold:11,level2:6,level3:8,heading});

test('direct submission rejects missing or standalone highlights',()=>{
  for(const bodyHtml of ['<strong>핵심</strong><u>조건</u>','<mark>핵심</mark>','<p>&lt;mark&gt;문자&lt;/mark&gt;</p>'])
    assert.throws(()=>assertDirectEmphasis({id:'direct-test',bodyHtml}),/E_DIRECT_EMPHASIS_MISSING/);
});
test('both approved emphasis levels pass the legacy structural presence guard',()=>{
  for(const bodyHtml of ['<mark><strong>핵심</strong></mark>','<mark><u><strong>주의 행동</strong></u></mark>'])
    assert.doesNotThrow(()=>assertDirectEmphasis({id:'direct-test',bodyHtml}));
  assert.doesNotThrow(()=>assertDirectEmphasis({id:'legacy-test',bodyHtml:'<p>기존 원고</p>'}));
});

test('new submission rejects mixed valid and standalone marks before publication',()=>{
  const prefix='<mark><strong>핵심</strong></mark>';
  for(const extra of ['<mark>수치</mark>','<mark><strong>일부</strong> 나머지</mark>','<mark><u>행동</u></mark>']) {
    const source={id:'direct-test',contentStandard:'SP1',bodyHtml:prefix+extra};
    assert.doesNotThrow(()=>assertDirectEmphasis(source));
    assert.throws(()=>assertDirectSubmissionEmphasis(source),/E_DIRECT_EMPHASIS_STRUCTURE/);
  }
});

test('limitation and no-effect statements stay plain or bold instead of highlighted',()=>{
  const phrases=[
    '근거가 부족합니다','사람 대상 연구가 충분하지 않습니다','효과를 단정하기 어렵습니다','아직 입증되지 않았습니다',
    '기간 효과를 보장할 수 없습니다','뚜렷한 임상 이득을 확인하지 못했습니다','비교 가능한 공식 데이터베이스는 없습니다',
    '모든 사람이 보충제를 먹어야 하는 것은 아닙니다','큐민은 일반 성인을 위한 공식 하루 권장량이 따로 정해져 있지 않습니다',
    '공복혈당과 인슐린 지표가 유의하게 달라지지 않았습니다','같은 효과 크기로 계산하지 않습니다',
    '조리용 큐민과 보충제의 섭취 조건이 다릅니다','조리용 큐민과 보충제의 섭취 조건은 다릅니다',
    '연구 용량을 일반인의 하루 권장량이나 안전 상한으로 바꾸지 않습니다','같은 섭취 기준으로 판단하지 않습니다',
    '호모시스테인 수치 감소를 심혈관질환 예방 효과로 바꾸어 해석하면 안 됩니다',
    '호모시스테인 개선을 심혈관질환 예방 효과로 확대해 표현하지 않습니다'
  ];
  for(const phrase of phrases){
    for(const attrs of ['', ' data-tone="info"', ' data-tone="caution"', ' data-tone="negative"']){
      const source={id:'direct-test',contentStandard:'SP1',bodyHtml:`<h2>3. 몸에서 하는 일</h2><mark${attrs}><strong>${phrase}</strong></mark>`};
      assert.throws(()=>assertDirectSubmissionEmphasis(source),/E_DIRECT_EMPHASIS_LIMITATION/,`${attrs}:${phrase}`);
    }
  }
});

test('absence of an official intake standard is neutral information and must not be highlighted',()=>{
  const bodyHtml=nutrientQuotaBody()+`<h2>3. 섭취량</h2><mark data-tone="info"><strong>SAC의 공식 하루 권장량은 없습니다.</strong></mark>`;
  assert.throws(()=>assertDirectSubmissionEmphasis({id:'direct-info-standard-test',category:'영양소',contentStandard:'SP1',bodyHtml}),/E_DIRECT_EMPHASIS_LIMITATION/);
});

test('semantic positive and info tones are accepted for ordinary takeaways',()=>{
  for(const tone of ['positive','info']){
    const bodyHtml=quotaBody()+`<h2>4. 활용</h2><mark data-tone="${tone}"><strong>식사에 적용할 핵심 기준입니다.</strong></mark>`;
    assert.doesNotThrow(()=>assertDirectSubmissionEmphasis({id:'direct-tone-test',contentStandard:'SP1',bodyHtml}));
  }
});

test('nutrient benefit section rejects evidence-quality highlight without an actual health outcome highlight',()=>{
  const bodyHtml=nutrientQuotaBody()+`<h2>2. 어떤 효능이 확인됐을까?</h2><mark data-tone="positive"><strong>장기간 섭취했을 때 사람 자료가 더 탄탄합니다.</strong></mark>`;
  assert.throws(()=>assertDirectSubmissionEmphasis({id:'direct-benefit-test',category:'영양소',contentStandard:'SP1',bodyHtml}),/E_DIRECT_BENEFIT_EMPHASIS_MISSING/);
});

test('nutrient benefit section accepts a positive highlight that states the confirmed health outcome',()=>{
  const bodyHtml=nutrientQuotaBody()+`<h2>2. 어떤 효능이 확인됐을까?</h2><mark data-tone="positive"><strong>황반색소밀도가 증가하고 대비감도와 강한 빛 노출 뒤 시각 회복이 개선됐습니다.</strong></mark>`;
  assert.doesNotThrow(()=>assertDirectSubmissionEmphasis({id:'direct-benefit-test',category:'영양소',contentStandard:'SP1',bodyHtml}));
});

test('nutrient benefit guard recognizes natural Korean decrease wording',()=>{
  const bodyHtml=nutrientQuotaBody()+`<h2>2. 어떤 효능이 확인됐고 누가 우선 확인해야 할까?</h2><mark data-tone="positive"><strong>철결핍이 교정되면 피로와 숨참, 운동 시 부담이 줄어드는 방향을 기대할 수 있습니다.</strong></mark>`;
  assert.doesNotThrow(()=>assertDirectSubmissionEmphasis({id:'direct-benefit-korean-inflection-test',category:'영양소',contentStandard:'SP1',bodyHtml}));
});

test('unknown semantic highlight tone fails closed',()=>{
  const bodyHtml=quotaBody()+'<mark data-tone="purple"><strong>임의 색상</strong></mark>';
  assert.throws(()=>assertDirectSubmissionEmphasis({id:'direct-tone-test',contentStandard:'SP1',bodyHtml}),/E_DIRECT_EMPHASIS_TONE/);
});

test('new submission requires at least one core highlight outside pure safety-only sections',()=>{
  const source={id:'direct-test',contentStandard:'SP1',bodyHtml:quotaBody({heading:'5. 부작용과 주의사항'})};
  assert.throws(()=>assertDirectSubmissionEmphasis(source),/E_DIRECT_PRIMARY_EMPHASIS_MISSING/);
});

test('mixed nutrient risk section still counts as a primary information section',()=>{
  const source={id:'direct-test',category:'영양소',contentStandard:'SP1',bodyHtml:nutrientQuotaBody({heading:'6. 결핍·과다 복용의 위험, 예방 가능한 질병과 추천 제품'})};
  assert.doesNotThrow(()=>assertDirectSubmissionEmphasis(source));
});

test('food and nutrient use dedicated emphasis minimums while medicine and disease keep the shared quota',()=>{
  assert.deepEqual(DIRECT_EMPHASIS_MINIMUMS,{bold:18,highlight:8,underline:2});
  assert.deepEqual(DIRECT_NUTRIENT_EMPHASIS_MINIMUMS,{bold:25,highlight:14,underline:8});
  assert.deepEqual(DIRECT_FOOD_EMPHASIS_MINIMUMS,{bold:25,highlight:12,underline:8});
  const food={id:'direct-음식-test',category:'음식',contentStandard:'SP1',bodyHtml:quotaBody({plainBold:13,level2:4,level3:8})};
  assert.deepEqual(assertDirectSubmissionEmphasis(food),{boldCount:25,highlightCount:12,underlineCount:8});
  const nutrient={id:'direct-영양소-test',category:'영양소',contentStandard:'SP1',bodyHtml:nutrientQuotaBody()};
  assert.deepEqual(assertDirectSubmissionEmphasis(nutrient),{boldCount:25,highlightCount:14,underlineCount:8});
  for(const category of ['약학','질병']){
    const source={id:`direct-${category}-test`,category,contentStandard:'SP1',bodyHtml:quotaBody()};
    assert.deepEqual(assertDirectSubmissionEmphasis(source),{boldCount:18,highlightCount:8,underlineCount:2});
  }
});

test('nutrient submission rejects fewer than 25 bold effects',()=>{
  const source={id:'direct-test',category:'영양소',contentStandard:'SP1',bodyHtml:quotaBody({plainBold:10,level2:6,level3:8})};
  assert.throws(()=>assertDirectSubmissionEmphasis(source),/E_DIRECT_EMPHASIS_BOLD_MIN/);
});

test('nutrient submission rejects fewer than 14 highlight effects',()=>{
  const source={id:'direct-test',category:'영양소',contentStandard:'SP1',bodyHtml:quotaBody({plainBold:12,level2:5,level3:8})};
  assert.throws(()=>assertDirectSubmissionEmphasis(source),/E_DIRECT_EMPHASIS_HIGHLIGHT_MIN/);
});

test('food submission rejects fewer than 12 highlight effects',()=>{
  const source={id:'direct-food-test',category:'음식',contentStandard:'SP1',bodyHtml:quotaBody({plainBold:14,level2:3,level3:8})};
  assert.throws(()=>assertDirectSubmissionEmphasis(source),/E_DIRECT_EMPHASIS_HIGHLIGHT_MIN/);
});

test('food submission rejects fewer than 8 underline highlight effects',()=>{
  const source={id:'direct-food-underline-test',category:'음식',contentStandard:'SP1',bodyHtml:quotaBody({plainBold:13,level2:5,level3:7})};
  assert.throws(()=>assertDirectSubmissionEmphasis(source),/E_DIRECT_EMPHASIS_UNDERLINE_MIN/);
});

test('nutrient submission rejects fewer than 8 underline highlight effects',()=>{
  const source={id:'direct-test',category:'영양소',contentStandard:'SP1',bodyHtml:quotaBody({plainBold:12,level2:7,level3:7})};
  assert.throws(()=>assertDirectSubmissionEmphasis(source),/E_DIRECT_EMPHASIS_UNDERLINE_MIN/);
});

test('actionable safety warning can stay strong when core benefits and common quotas are satisfied',()=>{
  const source={id:'direct-test',contentStandard:'SP1',bodyHtml:quotaBody()+'<h2>5. 부작용과 주의사항</h2><mark data-tone="negative"><u><strong>호흡곤란이 생기면 즉시 진료를 받습니다.</strong></u></mark>'};
  assert.doesNotThrow(()=>assertDirectSubmissionEmphasis(source));
});

test('submission preserves valid emphasis and leaves historical loading unchanged',()=>{
  const source={id:'direct-test',contentStandard:'SP1',bodyHtml:quotaBody()};
  const before=JSON.stringify(source);
  assert.doesNotThrow(()=>assertDirectSubmissionEmphasis(source));
  assert.equal(JSON.stringify(source),before);
  for(const old of [{...source,id:'legacy-test',bodyHtml:'<mark>과거</mark>'},{...source,contentStandard:'R1',bodyHtml:'<p>기존</p>'}])
    assert.doesNotThrow(()=>assertDirectSubmissionEmphasis(old));
});

test('nutrient TOP food table requires visible emphasis on ranks 1-3',()=>{
  const source=third=>({
    id:'direct-top3-test',category:'영양소',contentStandard:'SP1',
    bodyHtml:nutrientQuotaBody()+`<h2>4. 풍부한 식품 TOP7과 평균 함량은?</h2><table><tbody>
      <tr><td>1</td><td><mark data-tone="info"><u><strong>파르메산 치즈</strong></u></mark></td><td>35.8g</td></tr>
      <tr><td>2</td><td><mark data-tone="info"><strong>체더 치즈</strong></mark></td><td>24.0g</td></tr>
      <tr><td>3</td><td>${third}</td><td>19.8g</td></tr>
    </tbody></table>`
  });
  assert.throws(()=>assertDirectSubmissionEmphasis(source('카망베르 치즈')),/E_DIRECT_TOP3_EMPHASIS_MISSING/);
  assert.doesNotThrow(()=>assertDirectSubmissionEmphasis(source('<mark data-tone="info"><strong>카망베르 치즈</strong></mark>')));
});
