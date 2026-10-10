import fs from 'node:fs';
import cp from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {assertImageReview} from '../publishing/image-review.mjs';
import {renderEditorialPost} from '../publishing/editorial.mjs';
import {checkUpdateSource} from '../publishing/update-core.mjs';

const bytes=cp.execFileSync('git',['show','origin/main:posts/chestnut-calories-benefits-storage-20261006.json']);
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'45716319a3f98c821f6046fce8f73532c5b743d0880cb238350cb5affa58e55a');
const source=JSON.parse(bytes.toString('utf8'));
const replacements=[
 ['<strong>제철:</strong> 보통 9~11월 수확철에 가장 많이 유통됩니다.','<strong>제철:</strong> 국내 밤은 늦여름부터 가을에 수확하며 지역·품종에 따라 시기가 다릅니다.'],
 ['밤은 일반적으로 <strong>9월 하순부터 11월 사이</strong>에 수확이 집중됩니다. USDA의 2025년 밤 농가 사례에서도 수확기가 9월 말부터 11월까지라고 소개합니다. 국내에서도 추석 전후부터 가을에 햇밤 유통이 크게 늘어납니다.','국내 밤은 <strong>늦여름부터 가을에 수확하며 지역·품종에 따라 시기가 다릅니다.</strong> 농식품정보누리는 국내 밤의 생산시기를 8~10월로 안내합니다. USDA의 2025년 미국 밤 농가 사례에 나온 9월 말~11월은 해당 농가의 수확기이며 국내 전체의 수확기간을 뜻하지 않습니다.'],
 ['<li>제철은 대체로 9월 하순~11월입니다.</li>','<li>국내 밤은 늦여름~가을에 수확하며 지역·품종에 따라 시기가 다릅니다. 미국 농가 사례의 수확기와 구분합니다.</li>']
];
let body=source.bodyHtml;
for(const [old,value] of replacements){assert.equal(body.split(old).length,2); body=body.replace(old,value);}
const draft={...source,id:'evidence-dates-381-season-fix-20261010',articleId:'381',targetUrl:'https://nhunnhun.tistory.com/381',expectedCurrentTitle:source.title,contentStandard:'SP1',bodyHtml:body};
delete draft.tags;
assertImageReview(draft); checkUpdateSource(draft,draft.id+'.json');
assert.equal(draft.title,source.title); assert.deepEqual(draft.imageReview,source.imageReview);
assert.equal(draft.representativeImageUrl,source.representativeImageUrl);
const oldRender=renderEditorialPost({...source,contentStandard:'SP1'}),newRender=renderEditorialPost(draft);
for(const tag of ['strong','mark','u','img'])assert.equal((oldRender.match(new RegExp('<'+tag+'[ >]','g'))??[]).length,(newRender.match(new RegExp('<'+tag+'[ >]','g'))??[]).length);
for(const [old,value] of replacements){assert(body.includes(value));assert(!body.includes(old));}
fs.writeFileSync('updates/'+draft.id+'.json',JSON.stringify(draft,null,2)+'\n');
console.log('PASS: exact 3 season replacements; URL/title/images/emphasis preserved; update source and image contract valid. SP1 semantic review is manual and recorded separately.');
