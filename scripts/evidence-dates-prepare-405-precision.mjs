import fs from 'node:fs';
import cp from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {assertImageReview} from '../publishing/image-review.mjs';
import {renderEditorialPost} from '../publishing/editorial.mjs';
import {checkUpdateSource} from '../publishing/update-core.mjs';
const bytes=cp.execFileSync('git',['show','origin/main:posts/direct-tempeh-20261009.json']);
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'5c82019c3a3c3d7c542f1a3c373170041cb46508959b6ffd1866a5be32d7acf9');
const source=JSON.parse(bytes);
const changes=[['19.91','19.9'],['11.38','11.4'],['17.27','17.3']];
let body=source.bodyHtml;
const counts={};
for(const [old,value] of changes){counts[old]=body.split(old).length-1;assert(counts[old]>0);body=body.replaceAll(old,value);assert(!body.includes(old));}
const draft={...source,id:'direct-evidence-dates-405-usda-precision-fix-20261010',articleId:'405',targetUrl:'https://nhunnhun.tistory.com/405',expectedCurrentTitle:source.title,contentStandard:'SP1',bodyHtml:body};
delete draft.tags;
assertImageReview(draft);checkUpdateSource(draft,draft.id+'.json');
assert.deepEqual(draft.imageReview,source.imageReview);assert.equal(draft.title,source.title);
// Preserve the original direct-* rendering branch as well as explicit source markup.
for(const tag of ['strong','mark','u','img']){
 assert.equal((source.bodyHtml.match(new RegExp('<'+tag+'[ >]','g'))??[]).length,(draft.bodyHtml.match(new RegExp('<'+tag+'[ >]','g'))??[]).length);
 assert.equal((renderEditorialPost(source).match(new RegExp('<'+tag+'[ >]','g'))??[]).length,(renderEditorialPost(draft).match(new RegExp('<'+tag+'[ >]','g'))??[]).length);
}
assert.equal(renderEditorialPost(source).replaceAll('19.91','19.9').replaceAll('11.38','11.4').replaceAll('17.27','17.3'),renderEditorialPost(draft));
fs.writeFileSync('updates/'+draft.id+'.json',JSON.stringify(draft,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',counts,titleImagesEmphasisPreserved:true,scope:'USDA official SR Legacy displayed precision only'}));
