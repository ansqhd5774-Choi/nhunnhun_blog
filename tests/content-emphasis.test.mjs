import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { renderSemanticEmphasis, emphasisExpectations, assertEmphasisContract, inspectScanDensity, scanDensityReport, SCAN_DENSITY_POLICY, EMPHASIS_PALETTE, CALLOUTS } from '../publishing/content-emphasis.mjs';
import { inspectHtml } from '../publishing/content-html.mjs';
import { renderEditorialPost, editorialExpectations, assertEditorialContract } from '../publishing/editorial.mjs';
import { checkPublishHtml } from '../publishing/core.mjs';
import { checkMeasurements } from '../publishing/verify-updated-public.mjs';
import { fixture } from './fixtures/content-r1/factory.mjs';

test('R4 preserves real underline separately from highlighting',()=>{const html='<p>표시의 <u>일회분과 전체 용량</u> 차이를 살펴봅니다.</p>';const out=renderSemanticEmphasis(html);assert.match(out,/<u style=/);assert.doesNotMatch(out,/linear-gradient/);assert.doesNotThrow(()=>assertEmphasisContract(out,html));});
test('same-meaning highlights use the same color',()=>{const html='<p><mark data-tone="key">실제 함량</mark>을 확인하고 <mark data-tone="key">일회분</mark>을 비교합니다.</p>';const out=renderSemanticEmphasis(html);assert.equal(emphasisExpectations(html).minimumHighlightColors,1);assert.equal((out.match(/#fff1a8/g)||[]).length,2);assert.doesNotThrow(()=>assertEmphasisContract(out,html));});
test('semantic color is not chosen by occurrence order',()=>{const html='<p><mark data-tone="caution">성분 중복 주의</mark> 다음 <mark data-tone="key">일회분 표시</mark>를 확인합니다.</p>';const out=renderSemanticEmphasis(html);assert.ok(out.indexOf('#ffedd5')<out.indexOf('#fff1a8'));});
for(const kind of Object.keys(CALLOUTS))test(`callout ${kind} includes an explicit visible label`,()=>{const html=`<blockquote data-kind="${kind}"><p>구체적인 행동과 확인할 이유를 함께 설명합니다.</p></blockquote>`;const out=renderSemanticEmphasis(html);assert.ok(out.includes(CALLOUTS[kind].label));assert.doesNotThrow(()=>assertEmphasisContract(out,html));});
test('text color has its own marker and contract',()=>{const html='<p><span data-tone="info">기준을 확인하는 방법</span>을 안내합니다.</p>';const out=renderSemanticEmphasis(html);assert.match(out,/data-nh-color="info"/);assert.doesNotThrow(()=>assertEmphasisContract(out,html));});
test('invalid emphasis meaning fails',()=>assert.throws(()=>renderSemanticEmphasis('<p><mark data-tone="pretty">꾸미기</mark></p>'),/E_CONTENT_EMPHASIS_TONE/));
test('unknown badge fails',()=>assert.throws(()=>renderSemanticEmphasis('<blockquote data-kind="sales">구매</blockquote>'),/E_CONTENT_CALLOUT_KIND/));
test('nested inline emphasis fails inside a highlight',()=>assert.throws(()=>renderSemanticEmphasis('<p><mark data-tone="key"><strong>겹침</strong></mark></p>'),/E_CONTENT_EMPHASIS_NESTING/));
test('excessively long highlighted text fails',()=>assert.throws(()=>renderSemanticEmphasis(`<p><mark data-tone="key">${'가'.repeat(81)}</mark></p>`),/E_CONTENT_EMPHASIS_PHRASE/));
test('whole-paragraph highlighting fails',()=>assert.throws(()=>renderSemanticEmphasis(`<p><mark data-tone="key">${'단락 전체를 형광펜으로 칠하지 않습니다. '.repeat(2)}</mark></p>`),/E_CONTENT_EMPHASIS_PARAGRAPH/));
test('stripped semantic marker fails the public contract',()=>{const s='<p><mark data-tone="key">핵심 표시</mark></p>';const r=renderSemanticEmphasis(s).replace('data-nh-mark="key"','');assert.throws(()=>assertEmphasisContract(r,s),/E_EDITORIAL_R4_EMPHASIS_CONTRACT/);});
test('changed highlighted text fails even if the count is unchanged',()=>{const s='<p><mark data-tone="key">핵심 표시</mark></p>';assert.throws(()=>assertEmphasisContract(renderSemanticEmphasis(s).replace('핵심 표시','잘못된 표시'),s),/E_EDITORIAL_R4_EMPHASIS_CONTRACT/);});
test('wrong highlight color fails',()=>{const s='<p><mark data-tone="key">핵심 표시</mark></p>';assert.throws(()=>assertEmphasisContract(renderSemanticEmphasis(s).replace('#fff1a8','#000000'),s),/E_EDITORIAL_R4_COLOR_CONTRACT/);});
test('missing underline fails separately',()=>{const s='<p><u>서로 다른 기준</u>을 구분합니다.</p>';assert.throws(()=>assertEmphasisContract('<p>서로 다른 기준을 구분합니다.</p>',s),/E_EDITORIAL_R4_UNDERLINE_CONTRACT/);});
test('R4 works through the full editorial renderer and sanitizer',()=>{const p=fixture().source;p.bodyHtml=p.bodyHtml.replace('원문과 검토기록이 일치하는지 확인합니다.','<mark data-tone="key">원문과 검토기록</mark>을 확인하고 <u>단위를 구분</u>합니다.').replace('<h2>핵심 정리','<blockquote data-kind="caution"><p>중요한 주의사항은 이유와 행동을 함께 설명합니다.</p></blockquote><h2>핵심 정리');assert.doesNotThrow(()=>checkPublishHtml(p));const out=renderEditorialPost(p);assert.doesNotThrow(()=>assertEditorialContract(out,p.bodyHtml,{version:'R4'}));assert.match(out,/주의<\/p>/);});
test('new attributes do not allow arbitrary HTML style or script attributes',()=>{for(const html of ['<mark data-tone="key" onclick="bad()">문장</mark>','<span style="color:red">문장</span>','<blockquote data-kind="tip" id="x">문장</blockquote>'])assert.throws(()=>checkPublishHtml({bodyHtml:html}),/E_HTML_REQUIRES_REVIEW/);});
test('R3 still uses rotating highlights for legacy source',()=>{const p=fixture().source;delete p.contentStandard;p.bodyHtml=p.bodyHtml.replace('원문과 검토기록이 일치하는지 확인합니다.','<u>원문</u>과 <u>검토기록</u>이 일치하는지 확인합니다.');const out=renderEditorialPost(p);assert.match(out,/#fff1a8/);assert.match(out,/#d9f99d/);assert.doesNotMatch(out,/<u\b/);assert.doesNotThrow(()=>assertEditorialContract(out,p.bodyHtml));});
function luminance(hex){const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;}
function contrast(a,b){const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+0.05)/(values[1]+0.05);}
for(const [name,p]of Object.entries(EMPHASIS_PALETTE))test(`palette ${name}: minimum 4.5:1 text contrast`,()=>{assert.ok(contrast(p.color,p.background)>=4.5);assert.ok(contrast(p.color,'#ffffff')>=4.5);assert.ok(contrast('#111827',p.background)>=4.5);});
test('unchanged historical source retains its original R3 output hash',()=>{const path=new URL('./fixtures/content-r1/legacy-render-hashes.json',import.meta.url);assert.ok(existsSync(path));const data=JSON.parse(readFileSync(path,'utf8'));let count=0;for(const item of data){const rawSource=readFileSync(new URL('../'+item.path,import.meta.url),'utf8');const source=rawSource.replace(/\r\n/g,'\n');const inputHash=createHash('sha256').update(source).digest('hex');if(inputHash!==item.sourceSha256)continue;const p=JSON.parse(source);if(item.error){assert.throws(()=>renderEditorialPost(p),new RegExp(item.error));}else{assert.equal(createHash('sha256').update(renderEditorialPost(p)).digest('hex'),item.renderSha256,item.path);}count++;}assert.ok(count>0);});


test('scan density requires both bold and highlight for a normal 120+ character section',()=>{
  const doc=inspectHtml('<h2>1. 훑어보기 테스트</h2><p><strong>핵심 사실</strong>'+ '가'.repeat(170) +'</p>');
  const errors=[]; inspectScanDensity(doc,(code,detail)=>errors.push({code,detail}));
  assert.ok(errors.some(e=>e.code==='E_CONTENT_SCAN_EMPHASIS'));
});
test('scan density passes a 120+ character section with bold plus semantic highlight',()=>{
  const doc=inspectHtml('<h2>1. 훑어보기 테스트</h2><p><strong>핵심 사실</strong> <mark data-tone="key">한눈에 볼 결론</mark>'+ '가'.repeat(170) +'</p>');
  const errors=[]; inspectScanDensity(doc,(code,detail)=>errors.push({code,detail}));
  assert.deepEqual(errors,[]);
});
test('250+ character sections need three scan anchors, not merely one bold and one mark',()=>{
  const thin=inspectHtml('<h2>1. 중간 길이</h2><p><strong>조건</strong> <mark data-tone="key">결론</mark>'+ '가'.repeat(280) +'</p>');
  const errors=[]; inspectScanDensity(thin,(code,detail)=>errors.push({code,detail}));
  assert.ok(errors.some(e=>e.code==='E_CONTENT_SCAN_EMPHASIS'));
  const dense=inspectHtml('<h2>1. 중간 길이</h2><p><strong>조건</strong> <mark data-tone="key">결론</mark> <strong>행동 기준</strong>'+ '가'.repeat(280) +'</p>');
  const denseErrors=[]; inspectScanDensity(dense,(code,detail)=>denseErrors.push({code,detail}));
  assert.deepEqual(denseErrors,[]);
});
test('a labeled safety callout counts as a strong scan anchor',()=>{
  const doc=inspectHtml('<h2>1. 위험 신호</h2><blockquote data-kind="danger"><p>'+ '가'.repeat(280) +'</p></blockquote>');
  const errors=[]; inspectScanDensity(doc,(code,detail)=>errors.push({code,detail}));
  assert.deepEqual(errors,[]);
});
test('summary, FAQ, related links and sources are excluded from scan-density minimums',()=>{
  const doc=inspectHtml('<h2>핵심 정리</h2><p>'+ '가'.repeat(500) +'</p><h2>자주 묻는 FAQ</h2><p>'+ '나'.repeat(500) +'</p><h2>함께 보면 좋은 글</h2><p>'+ '다'.repeat(500) +'</p><h2>자료 출처</h2><p>'+ '라'.repeat(500) +'</p>');
  assert.equal(scanDensityReport(doc).length,0);
  const errors=[]; inspectScanDensity(doc,(code,detail)=>errors.push({code,detail}));
  assert.deepEqual(errors,[]);
});
test('scan density policy is versioned for diagnostics',()=>assert.equal(SCAN_DENSITY_POLICY.version,'R4-scan-v1'));
