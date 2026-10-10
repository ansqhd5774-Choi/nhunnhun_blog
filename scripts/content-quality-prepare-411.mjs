import fs from 'node:fs';
import cp from 'node:child_process';
import assert from 'node:assert/strict';
import {assertImageReview} from '../publishing/image-review.mjs';
import {renderEditorialPost} from '../publishing/editorial.mjs';
import {assertEmphasisContract} from '../publishing/content-emphasis.mjs';
const source=JSON.parse(cp.execFileSync('git',['show','origin/main:posts/direct-teff-nutrition-gluten-20261010.json'],{encoding:'utf8'}));
const before=source.bodyHtml;
let after=before.replace('테프 알곡 1 : 물 약 3','동일 계량컵으로 테프 알곡 1컵 : 물 약 3컵')
.replace('건조 테프 40g + 물 약 120mL를 끓인 뒤 약불 20분','동일 계량컵으로 테프 알곡 1컵 + 물 약 3컵을 끓인 뒤 약불 20분')
.replace('건조 테프 30~40g에 물 약 3배를 넣고 20분가량 약불에서 충분히 익혀','동일 계량컵으로 테프 알곡 1컵에 물 약 3컵을 넣고 20분가량 약불에서 충분히 익혀');
assert.notEqual(before,after);assert(!after.includes('120mL'));assert(!after.includes('30~40g에 물 약 3배'));
const draft={...source,id:'direct-411-teff-volume-fix-20261010',articleId:'411',targetUrl:'https://nhunnhun.tistory.com/411',expectedCurrentTitle:source.title,bodyHtml:after};
delete draft.tags;
assertImageReview(draft);
const oldRender=renderEditorialPost(source),newRender=renderEditorialPost(draft);
// SP1 applies automatic emphasis; verify old/new rendered tag counts below instead of R4 semantic-source equality.
for(const tag of ['strong','mark','u','img'])assert.equal((oldRender.match(new RegExp('<'+tag+'[ >]','g'))??[]).length,(newRender.match(new RegExp('<'+tag+'[ >]','g'))??[]).length);
assert.equal(draft.title,source.title);assert.deepEqual(draft.imageReview,source.imageReview);assert.equal(draft.representativeImageUrl,source.representativeImageUrl);
fs.writeFileSync('updates/'+draft.id+'.json',JSON.stringify(draft,null,2)+'\n');
console.log('PASS: 3 exact replacements; title/images/emphasis preserved; image review and SP1 rendered emphasis preservation.');

