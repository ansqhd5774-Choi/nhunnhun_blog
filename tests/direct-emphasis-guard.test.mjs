import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDirectEmphasis,assertDirectSubmissionEmphasis} from '../publishing/direct-emphasis.mjs';

test('direct submission rejects missing or standalone highlights',()=>{
  for(const bodyHtml of ['<strong>핵심</strong><u>조건</u>','<mark>핵심</mark>','<p>&lt;mark&gt;문자&lt;/mark&gt;</p>'])
    assert.throws(()=>assertDirectEmphasis({id:'direct-test',bodyHtml}),/E_DIRECT_EMPHASIS_MISSING/);
});
test('both approved emphasis levels pass without imposing quotas',()=>{
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

test('submission preserves valid emphasis and leaves historical loading unchanged',()=>{
  const source={id:'direct-test',contentStandard:'SP1',bodyHtml:'<strong>성분</strong><mark><strong>수치</strong></mark><mark><u><strong>행동</strong></u></mark>'};
  const before=JSON.stringify(source);
  assert.doesNotThrow(()=>assertDirectSubmissionEmphasis(source));
  assert.equal(JSON.stringify(source),before);
  for(const old of [{...source,id:'legacy-test',bodyHtml:'<mark>과거</mark>'},{...source,contentStandard:'R1',bodyHtml:'<p>기존</p>'}])
    assert.doesNotThrow(()=>assertDirectSubmissionEmphasis(old));
});
