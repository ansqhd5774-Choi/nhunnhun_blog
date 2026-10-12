import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  buildAuthorizationHeader,buildQueryString,buildSignedDate,CoupangPartnersClient,COUPANG_LIMITS,DEFAULT_RATE_STATE_PATH,
} from '../publishing/coupang-partners.mjs';
import {
  COUPANG_DISCLOSURE,validateAffiliateProducts,renderAffiliateProductsBlock,insertAffiliateProductsBlock,assertAffiliatePublicEvidence,
} from '../publishing/affiliate-products.mjs';
import {checkPost,fingerprint} from '../publishing/core.mjs';
import {renderEditorialPost} from '../publishing/editorial.mjs';
import {checkUpdateSource,updateFingerprint} from '../publishing/update-core.mjs';
import {publicFailureState} from '../publishing/finalize-update.mjs';
import YAML from 'yaml';
import {readFileSync} from 'node:fs';
import {directFixture} from './direct-source-fixture.mjs';

const approvedProducts={reviewed:true,products:[{
  name:'국산 건조 콩',landingUrl:'https://link.coupang.com/a/test-1',category:'food',
  rationale:'본문에서 다룬 콩 재료를 선택할 때 참고할 상품입니다.',
}]};
const withTempState=async fn=>{
  const root=await mkdtemp(join(tmpdir(),'coupang-partners-'));
  try{return await fn(join(root,'quota.json'));}finally{await rm(root,{recursive:true,force:true});}
};
const response=(status,body)=>({status,ok:status>=200&&status<300,json:async()=>body});

test('Coupang signature uses the documented UTC signed date and HMAC input',()=>{
  const now=new Date('2026-01-05T15:30:22.456Z');
  const signedDate='260105T153022Z';
  assert.equal(buildSignedDate(now),signedDate);
  const query='keyword=%ED%95%9C%EA%B5%AD%EC%BD%A9&limit=10';
  assert.equal(buildQueryString({keyword:'한국콩',limit:10,empty:''}),query);
  const signature=createHmac('sha256','secret-fixture').update(signedDate+'GET/v2/providers/affiliate_open_api/apis/openapi/v1/products/search'+query).digest('hex');
  assert.equal(buildAuthorizationHeader({method:'GET',path:'/v2/providers/affiliate_open_api/apis/openapi/v1/products/search',queryString:query,accessKey:'access-fixture',secretKey:'secret-fixture',now}),`CEA algorithm=HmacSHA256, access-key=access-fixture, signed-date=${signedDate}, signature=${signature}`);
});

test('search reserves the official hourly quota before a request and never retries',async()=>withTempState(async rateStatePath=>{
  let calls=0,now=new Date('2026-01-05T15:30:22.456Z');
  const client=new CoupangPartnersClient({accessKey:'access-fixture',secretKey:'secret-fixture',rateStatePath,clock:()=>now,fetchImpl:async(url,init)=>{
    calls++;assert.match(url,/\/products\/search\?keyword=/);assert.equal(init.method,'GET');assert.match(init.headers.Authorization,/^CEA algorithm=HmacSHA256,/);
    return response(200,{rCode:'0',data:{productData:[{productName:'콩',productPrice:1000,productUrl:'https://www.coupang.com/vp/products/1',productImage:'https://image.example/1'}],landingUrl:'https://link.coupang.com/a/search'}});
  }});
  const result=await client.searchProducts('콩');assert.equal(result.products.length,1);assert.equal(calls,1);
  for(let i=1;i<COUPANG_LIMITS.search;i++)await client.searchProducts('콩');
  await assert.rejects(client.searchProducts('콩'),/E_COUPANG_RATE_LIMIT_LOCAL/);assert.equal(calls,COUPANG_LIMITS.search);
  const state=JSON.parse(await readFile(rateStatePath,'utf8'));assert.equal(state.calls.length,COUPANG_LIMITS.search);
  now=new Date(now.getTime()+COUPANG_LIMITS.windowMs+1);await client.searchProducts('콩');assert.equal(calls,COUPANG_LIMITS.search+1);
}));

test('API envelope and HTTP errors fail closed without response-body leakage or retries',async()=>withTempState(async rateStatePath=>{
  let calls=0;
  const client=new CoupangPartnersClient({accessKey:'access-fixture',secretKey:'secret-fixture',rateStatePath,fetchImpl:async()=>{calls++;return response(200,{rCode:'1',message:'private response detail'});}});
  await assert.rejects(client.searchProducts('콩'),error=>error.message==='E_COUPANG_API_ENVELOPE'&&!error.message.includes('private'));
  const throttled=new CoupangPartnersClient({accessKey:'access-fixture',secretKey:'secret-fixture',rateStatePath:rateStatePath+'.429',fetchImpl:async()=>{calls++;return response(429,{message:'do not expose'});}});
  await assert.rejects(throttled.searchProducts('콩'),/E_COUPANG_RATE_LIMIT_REMOTE/);assert.equal(calls,2);
}));

test('deeplink accepts at most three first-party Coupang product URLs and validates returned links',async()=>withTempState(async rateStatePath=>{
  let posted;
  const client=new CoupangPartnersClient({accessKey:'access-fixture',secretKey:'secret-fixture',rateStatePath,fetchImpl:async(url,init)=>{
    posted={url,init};return response(200,{rCode:'0',data:[{landingUrl:'https://link.coupang.com/a/converted-1'}]});
  }});
  const result=await client.createDeeplinks(['https://www.coupang.com/vp/products/1']);
  assert.equal(result[0].landingUrl,'https://link.coupang.com/a/converted-1');assert.equal(posted.init.method,'POST');
  assert.deepEqual(JSON.parse(posted.init.body),{coupangUrls:['https://www.coupang.com/vp/products/1']});
  await assert.rejects(client.createDeeplinks(['https://evil.example/item']),/E_COUPANG_PRODUCT_URL/);
  await assert.rejects(client.createDeeplinks(Array(4).fill('https://www.coupang.com/item')),/E_COUPANG_LINK_COUNT/);
  const bad=new CoupangPartnersClient({accessKey:'access-fixture',secretKey:'secret-fixture',rateStatePath:rateStatePath+'.bad',fetchImpl:async()=>response(200,{rCode:'0',data:[{landingUrl:'https://evil.example/redirect'}]})});
  await assert.rejects(bad.createDeeplinks(['https://www.coupang.com/vp/products/1']),/E_COUPANG_RESPONSE_SHAPE/);
}));

test('API client requires credentials and a persistent external quota state path',()=>{
  assert.throws(()=>new CoupangPartnersClient({accessKey:'',secretKey:'x',rateStatePath:'C:\\temp\\quota.json'}),/E_COUPANG_CREDENTIALS/);
  assert.throws(()=>new CoupangPartnersClient({accessKey:'x',secretKey:'y',rateStatePath:'quota.json'}),/E_COUPANG_RATE_STATE_PATH/);
  assert.throws(()=>new CoupangPartnersClient({accessKey:'x',secretKey:'y',rateStatePath:join(process.cwd(),'quota.json')}),/E_COUPANG_RATE_STATE_MUST_BE_EXTERNAL/);
  assert.doesNotThrow(()=>new CoupangPartnersClient({accessKey:'x',secretKey:'y'}));
  assert.ok(DEFAULT_RATE_STATE_PATH.endsWith('.nhunnhun\\coupang-partners-rate-state.json'));
});

test('affiliate policy requires manual review, relevant category, rationale, safe URLs and no health claims',()=>{
  assert.equal(validateAffiliateProducts(undefined),undefined);
  assert.equal(validateAffiliateProducts(approvedProducts),approvedProducts);
  assert.throws(()=>validateAffiliateProducts({...approvedProducts,reviewed:false}),/E_AFFILIATE_REVIEW_REQUIRED/);
  assert.throws(()=>validateAffiliateProducts({reviewed:true,products:Array(4).fill(approvedProducts.products[0])}),/E_AFFILIATE_LINK_COUNT/);
  assert.throws(()=>validateAffiliateProducts({reviewed:true,products:[{...approvedProducts.products[0],category:'supplement'}]}),/E_AFFILIATE_CATEGORY/);
  assert.throws(()=>validateAffiliateProducts({reviewed:true,products:[{...approvedProducts.products[0],name:'혈당 개선 영양제'}]}),/E_AFFILIATE_HEALTH_CLAIM/);
  assert.throws(()=>validateAffiliateProducts({reviewed:true,products:[{...approvedProducts.products[0],landingUrl:'https://evil.example/a'}]}),/E_AFFILIATE_URL/);
});

test('affiliate renderer adds one visible disclosure and sponsored links in an unobtrusive section',()=>{
  const block=renderAffiliateProductsBlock(approvedProducts);
  assert.equal((block.match(/\[광고\]/g)||[]).length,1);assert.ok(block.includes(COUPANG_DISCLOSURE));
  assert.match(block,/rel="sponsored nofollow"/);assert.ok(block.includes('관련 상품 정보'));
  assert.ok(block.includes('본문에서 다룬 콩 재료'));
  const ordered=insertAffiliateProductsBlock('<h2>자료 출처</h2><ul></ul>',approvedProducts);
  assert.ok(ordered.indexOf('관련 상품 정보')<ordered.indexOf('<h2>자료 출처</h2>'));
  const evidence={disclosureCount:1,linkCounts:[1],sponsored:[true]};assert.doesNotThrow(()=>assertAffiliatePublicEvidence(evidence,approvedProducts));
  assert.throws(()=>assertAffiliatePublicEvidence({...evidence,sponsored:[false]},approvedProducts),/E_AFFILIATE_PUBLIC_UNVERIFIED/);
});

test('affiliate products are opt-in, fingerprinted and rendered for direct articles only when selected',()=>{
  const source=directFixture();
  const plain=renderEditorialPost(source);
  assert.ok(!plain.includes(COUPANG_DISCLOSURE));
  const post={...source,affiliateProducts:approvedProducts};
  const rendered=renderEditorialPost(post);
  assert.ok(rendered.includes(COUPANG_DISCLOSURE));assert.ok(rendered.includes('rel="sponsored nofollow"'));
  assert.ok(rendered.indexOf('관련 상품 정보')<rendered.indexOf('자료 출처'));
  assert.notEqual(fingerprint(post),fingerprint(source));
  const allowed=['id','title','category','tags','bodyHtml','representativeImageUrl','imageReview','scheduledAt','status','approved','contentStandard','affiliateProducts'];
  const validated=Object.fromEntries(Object.entries(post).filter(([key])=>allowed.includes(key)));
  validated.tags=[];
  assert.equal(checkPost(validated,`${validated.id}.json`),validated);
});

test('existing-URL update sources accept only reviewed affiliate metadata and fingerprint it',()=>{
  const update={id:'direct-264-example',articleId:'264',targetUrl:'https://nhunnhun.tistory.com/264',expectedCurrentTitle:'기존 제목',title:'수정 제목',
    representativeImageUrl:'https://img1.example/image.jpg',bodyHtml:'<p>본문 내용</p>',status:'ready',approved:true,category:'음식',contentStandard:'SP1',affiliateProducts:approvedProducts};
  assert.equal(checkUpdateSource(update,`${update.id}.json`),update);
  const base=updateFingerprint(update);
  assert.notEqual(updateFingerprint({...update,affiliateProducts:{...approvedProducts,products:[{...approvedProducts.products[0],rationale:'본문에서 다룬 콩을 요리에 사용할 때 선택을 돕는 상품입니다.'}]}}),base);
  assert.throws(()=>checkUpdateSource({...update,affiliateProducts:{...approvedProducts,reviewed:false}},`${update.id}.json`),/E_AFFILIATE_REVIEW_REQUIRED/);
  assert.deepEqual(publicFailureState(Error('E_AFFILIATE_PUBLIC_UNVERIFIED')),{status:'PUBLIC_VERIFICATION_MISMATCH',code:'E_AFFILIATE_PUBLIC_UNVERIFIED'});
});

test('manual GitHub workflow uses only persistent publisher runner, secrets, and validated lookup inputs',()=>{
  const workflow=YAML.parse(readFileSync('.github/workflows/coupang-partners-api.yml','utf8'));
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.operation.options,['search','deeplink']);
  assert.deepEqual(workflow.jobs.lookup['runs-on'],['self-hosted','windows','x64','tistory-publisher']);
  assert.equal(workflow.concurrency['cancel-in-progress'],false);
  const api=workflow.jobs.lookup.steps.find(step=>step.run==='node scripts/coupang-partners.mjs');
  assert.ok(api.env.COUPANG_ACCESS_KEY.includes('secrets.COUPANG_ACCESS_KEY'));
  assert.ok(api.env.COUPANG_SECRET_KEY.includes('secrets.COUPANG_SECRET_KEY'));
  assert.ok(!workflow.jobs.lookup.steps.some(step=>String(step.run).includes('pnpm publish')));
  const check=operation=>spawnSync(process.execPath,['scripts/coupang-api-input-check.mjs'],{encoding:'utf8',env:{...process.env,...operation}});
  assert.match(check({COUPANG_OPERATION:'search',COUPANG_SEARCH_KEYWORD:'콩'}).stdout,/PASS_COUPANG_INPUT: search/);
  assert.match(check({COUPANG_OPERATION:'deeplink',COUPANG_PRODUCT_URLS:'https://www.coupang.com/vp/products/1'}).stdout,/PASS_COUPANG_INPUT: deeplink/);
  assert.notEqual(check({COUPANG_OPERATION:'search',COUPANG_SEARCH_KEYWORD:'',COUPANG_PRODUCT_URLS:''}).status,0);
});
