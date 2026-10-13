import test from 'node:test';
import assert from 'node:assert/strict';
import {DIRECT_EMPHASIS_MINIMUMS,DIRECT_FOOD_EMPHASIS_MINIMUMS,assertDirectEmphasis,assertDirectSubmissionEmphasis} from '../publishing/direct-emphasis.mjs';

const quotaBody=({plainBold=10,level2=6,level3=2,heading='2. 핵심 정보'}={})=>{
  const plain=Array.from({length:plainBold},(_,i)=>`<strong>굵게${i+1}</strong>`).join('');
  const l2=Array.from({length:level2},(_,i)=>`<mark><strong>하이라이트${i+1}</strong></mark>`).join('');
  const l3=Array.from({length:level3},(_,i)=>`<mark><u><strong>최상위${i+1}</strong></u></mark>`).join('');
  return `<h2>${heading}</h2>${plain}${l2}${l3}`;
};

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

test('untagged positive-style highlights still reject evidence-limit disclaimers',()=>{
  const phrases=[
    '근거가 부족합니다','사람 대상 연구가 충분하지 않습니다','효과를 단정하기 어렵습니다','아직 입증되지 않았습니다',
    '기간 효과를 보장할 수 없습니다','뚜렷한 임상 이득을 확인하지 못했습니다','비교 가능한 공식 데이터베이스는 없습니다',
    '모든 사람이 보충제를 먹어야 하는 것은 아닙니다','큐민은 일반 성인을 위한 공식 하루 권장량이 따로 정해져 있지 않습니다',
    '공복혈당과 인슐린 지표가 유의하게 달라지지 않았습니다','같은 효과 크기로 계산하지 않습니다',
    '조리용 큐민과 보충제의 섭취 조건이 다릅니다','조리용 큐민과 보충제의 섭취 조건은 다릅니다',
    '연구 용량을 일반인의 하루 권장량이나 안전 상한으로 바꾸지 않습니다','같은 섭취 기준으로 판단하지 않습니다'
  ];
  for(const phrase of phrases){
    const source={id:'direct-test',contentStandard:'SP1',bodyHtml:`<h2>3. 몸에서 하는 일</h2><mark><strong>${phrase}</strong></mark>`};
    assert.throws(()=>assertDirectSubmissionEmphasis(source),/E_DIRECT_EMPHASIS_LIMITATION/,phrase);
  }
});

test('semantic info tone allows neutral absence of an official intake standard only',()=>{
  const bodyHtml=quotaBody()+`<h2>3. 섭취량</h2><mark data-tone="info"><strong>SAC의 공식 하루 권장량은 없습니다.</strong></mark>`;
  assert.doesNotThrow(()=>assertDirectSubmissionEmphasis({id:'direct-info-standard-test',category:'영양소',contentStandard:'SP1',bodyHtml}));
  const evidenceLimit=quotaBody()+`<h2>3. 섭취량</h2><mark data-tone="info"><strong>사람 대상 연구가 충분하지 않습니다.</strong></mark>`;
  assert.throws(()=>assertDirectSubmissionEmphasis({id:'direct-info-limit-test',category:'영양소',contentStandard:'SP1',bodyHtml:evidenceLimit}),/E_DIRECT_EMPHASIS_LIMITATION/);
});

test('semantic caution and negative tones allow important negative facts without weakening structure rules',()=>{
  for(const tone of ['caution','negative']){
    const bodyHtml=quotaBody()+`<h2>5. 부작용과 주의사항</h2><mark data-tone="${tone}"><strong>근거가 부족한 제품은 과장 광고를 확인합니다.</strong></mark>`;
    assert.doesNotThrow(()=>assertDirectSubmissionEmphasis({id:'direct-tone-test',contentStandard:'SP1',bodyHtml}));
  }
});

test('semantic positive and info tones are accepted for ordinary takeaways',()=>{
  for(const tone of ['positive','info']){
    const bodyHtml=quotaBody()+`<h2>4. 활용</h2><mark data-tone="${tone}"><strong>식사에 적용할 핵심 기준입니다.</strong></mark>`;
    assert.doesNotThrow(()=>assertDirectSubmissionEmphasis({id:'direct-tone-test',contentStandard:'SP1',bodyHtml}));
  }
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
  const source={id:'direct-test',contentStandard:'SP1',bodyHtml:quotaBody({heading:'6. 결핍·과다 복용의 위험, 예방 가능한 질병과 추천 제품'})};
  assert.doesNotThrow(()=>assertDirectSubmissionEmphasis(source));
});

test('food uses a lower highlight floor while other categories keep the shared quota',()=>{
  assert.deepEqual(DIRECT_EMPHASIS_MINIMUMS,{bold:18,highlight:8,underline:2});
  assert.deepEqual(DIRECT_FOOD_EMPHASIS_MINIMUMS,{bold:18,highlight:4,underline:2});
  const food={id:'direct-음식-test',category:'음식',contentStandard:'SP1',bodyHtml:quotaBody({plainBold:14,level2:2,level3:2})};
  assert.deepEqual(assertDirectSubmissionEmphasis(food),{boldCount:18,highlightCount:4,underlineCount:2});
  for(const category of ['영양소','약학','질병']){
    const source={id:`direct-${category}-test`,category,contentStandard:'SP1',bodyHtml:quotaBody()};
    assert.deepEqual(assertDirectSubmissionEmphasis(source),{boldCount:18,highlightCount:8,underlineCount:2});
  }
});

test('new submission rejects fewer than 18 bold effects',()=>{
  const source={id:'direct-test',category:'영양소',contentStandard:'SP1',bodyHtml:quotaBody({plainBold:9,level2:6,level3:2})};
  assert.throws(()=>assertDirectSubmissionEmphasis(source),/E_DIRECT_EMPHASIS_BOLD_MIN/);
});

test('non-food submission still rejects fewer than 8 highlight effects',()=>{
  const source={id:'direct-test',category:'영양소',contentStandard:'SP1',bodyHtml:quotaBody({plainBold:11,level2:5,level3:2})};
  assert.throws(()=>assertDirectSubmissionEmphasis(source),/E_DIRECT_EMPHASIS_HIGHLIGHT_MIN/);
});

test('food submission rejects fewer than 4 highlight effects',()=>{
  const source={id:'direct-food-test',category:'음식',contentStandard:'SP1',bodyHtml:quotaBody({plainBold:15,level2:1,level3:2})};
  assert.throws(()=>assertDirectSubmissionEmphasis(source),/E_DIRECT_EMPHASIS_HIGHLIGHT_MIN/);
});

test('new submission rejects fewer than 2 underline highlight effects',()=>{
  const source={id:'direct-test',category:'영양소',contentStandard:'SP1',bodyHtml:quotaBody({plainBold:10,level2:7,level3:1})};
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
