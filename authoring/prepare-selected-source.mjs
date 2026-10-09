import {readFileSync} from 'node:fs';
import {prepareDirectSource} from './prepare-direct-source.mjs';
import {assertImageReview} from '../publishing/image-review.mjs';

// Runner-side preparation before mutation. Never invent emphasis or review claims.
const kind=process.argv[2];
const id=process.env.UPDATE_SOURCE_ID||process.env.PUBLISH_SOURCE_ID;
if(!['posts','updates'].includes(kind)||!/^[a-z0-9][a-z0-9-]{2,79}$/.test(id||''))throw Error('E_PREPARATION_TARGET');
const source=JSON.parse(readFileSync(`${kind}/${id}.json`,'utf8'));
if(source.contentStandard==='SP1'&&source.id.startsWith('direct-')) {
  assertImageReview(source);
  const {report}=prepareDirectSource(source);
  console.log('SOURCE_PREPARATION '+JSON.stringify({...report,semanticVerification:'author-review-not-automated'}));
} else console.log('SOURCE_PREPARATION_EXISTING_STANDARD '+id);
