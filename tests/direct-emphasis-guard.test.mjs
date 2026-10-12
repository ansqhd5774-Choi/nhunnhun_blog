import test from 'node:test';
import assert from 'node:assert/strict';
import {DIRECT_EMPHASIS_MINIMUMS,assertDirectEmphasis,assertDirectSubmissionEmphasis} from '../publishing/direct-emphasis.mjs';

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

test('new submission rejects evidence-limit disclaimers as highlighted takeaways',()=>{
  const phrases=[
    '근거가 부족합니다','사람 대상 연구가 충분하지 않습니다','효과를 단정하기 어렵습니다','아직 입증되지 않았습니다',
    '기간 효과를 보장할 수 없습니다','뚜렷한 임상 이득을 확인하지 못했습니다','비교 가능한 공식 데이터베이스는 없습니다',
    '모든 사람이 보충제를 먹어야 하는 것은 아닙니다'
  ];
  for(const phrase of phrases){
    const source={id:'direct-test',contentStandard:'SP1',bodyHtml:`<h2>3. 몸에서 하는 일</h2><mark><strong>${phrase}</strong></mark>`};
    assert.throws(()=>assertDirectSubmissionEmphasis(source),/E_DIRECT_EMPHASIS_LIMITATION/);
  }
});

test('new submission requires at least one core highlight outside pure safety-only sections',()=>{
  const source={id:'direct-test',contentStandard:'SP1',bodyHtml:quotaBody({heading:'5. 부작용과 주의사항'})};
  assert.throws(()=>assertDirectSubmissionEmphasis(source),/E_DIRECT_PRIMARY_EMPHASIS_MISSING/);
});

test('mixed nutrient risk section still counts as a primary information section',()=>{
  const source={id:'direct-test',contentStandard:'SP1',bodyHtml:quotaBody({heading:'6. 결핍·과다 복용의 위험, 예방 가능한 질병과 추천 제품'})};
  assert.doesNotThrow(()=>assertDirectSubmissionEmphasis(source));
});

test('four categories share the same minimum emphasis quota',()=>{
  assert.deepEqual(DIRECT_EMPHASIS_MINIMUMS,{bold:18,highlight:8,underline:2});
  for(const category of ['음식','영양소','약학','질병']){
    const source={id:`direct-${category}-test`,category,contentStandard:'SP1',bodyHtml:quotaBody()};
    assert.deepEqual(assertDirectSubmissionEmphasis(source),{boldCount:18,highlightCount:8,underlineCount:2});
  }
});

test('new submission rejects fewer than 18 bold effects',()=>{
  const source={id:'direct-test',contentStandard:'SP1',bodyHtml:quotaBody({plainBold:9,level2:6,level3:2})};
  assert.throws(()=>assertDirectSubmissionEmphasis(source),/E_DIRECT_EMPHASIS_BOLD_MIN/);
});

test('new submission rejects fewer than 8 highlight effects',()=>{
  const source={id:'direct-test',contentStandard:'SP1',bodyHtml:quotaBody({plainBold:11,level2:5,level3:2})};
  assert.throws(()=>assertDirectSubmissionEmphasis(source),/E_DIRECT_EMPHASIS_HIGHLIGHT_MIN/);
});

test('new submission rejects fewer than 2 underline highlight effects',()=>{
  const source={id:'direct-test',contentStandard:'SP1',bodyHtml:quotaBody({plainBold:10,level2:7,level3:1})};
  assert.throws(()=>assertDirectSubmissionEmphasis(source),/E_DIRECT_EMPHASIS_UNDERLINE_MIN/);
});

test('actionable safety warning can stay strong when core benefits and common quotas are satisfied',()=>{
  const source={id:'direct-test',contentStandard:'SP1',bodyHtml:quotaBody()+'<h2>5. 부작용과 주의사항</h2><mark><u><strong>호흡곤란이 생기면 즉시 진료를 받습니다.</strong></u></mark>'};
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
