import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect, locations } from '../scripts/audit-search-foundation.mjs';
import { compareInventory } from '../scripts/compare-public-inventory.mjs';
import { normalizeSkinHead } from '../scripts/normalize-skin-head.mjs';
import { metadata,duplicateGroups } from '../scripts/audit-public-metadata.mjs';
import { installGrowthNavigation } from '../scripts/install-growth-navigation.mjs';
import { summarizeSchemaDates } from '../scripts/summarize-schema-dates.mjs';
import { extractEvidence, accessState, reconcileSourceAccess } from '../scripts/audit-health-evidence.mjs';
import { installGrowthEvents, protectExistingAnalytics } from '../scripts/install-growth-events.mjs';
import { installRuntimeQuality } from '../scripts/install-health-runtime-quality.mjs';
import fs from 'node:fs/promises';
import vm from 'node:vm';

test('runtime repair changes only same-page equivalent Article headline and preserves dates and other schemas',async()=>{
  const code=await fs.readFile(new URL('../skin/proposals/health-runtime-quality-20261010.js',import.meta.url),'utf8');
  const article={'@type':'BlogPosting',url:'https://nhunnhun.tistory.com/1',headline:'영양&middot;안내',datePublished:'2024-01-01',dateModified:'2026-10-10',image:'https://image.example/1.jpg'};
  const foreign={...article,url:'https://nhunnhun.tistory.com/2'};
  const different={...article,headline:'다른&middot;글'};
  const product={'@type':'Product',url:article.url,headline:article.headline};
  const block={textContent:JSON.stringify({'@graph':[article,foreign,different,product]})};
  const document={readyState:'complete',body:{},querySelector:()=>({content:'영양·안내'}),querySelectorAll:s=>s.startsWith('script')?[block]:[],createElement:()=>({set innerHTML(value){this.value=value.replaceAll('&middot;','·').replaceAll('&lt;','<');}})};
  vm.runInNewContext(code,{document,location:{origin:'https://nhunnhun.tistory.com',pathname:'/1'},MutationObserver:class{observe(){}}});
  const result=JSON.parse(block.textContent)['@graph'];
  assert.deepEqual(result[0],{...article,headline:'영양·안내'});
  assert.deepEqual(result.slice(1),[foreign,different,product]);
  const first=block.textContent;
  vm.runInNewContext(code,{document,location:{origin:'https://nhunnhun.tistory.com',pathname:'/1'},MutationObserver:class{observe(){}}});
  assert.equal(block.textContent,first);
});

test('runtime installer preserves manuscript placeholders and refuses duplicate or unsafe boundaries',()=>{
  const skin='<html><head><title>[##_page_title_##]</title></head><body>[##_article_rep_desc_##]</body></html>';
  const output=installRuntimeQuality(skin,'/* repair */','a:focus-visible{outline:3px solid green}');
  assert.ok(output.includes('[##_article_rep_desc_##]'));
  assert.equal((output.match(/nh-runtime-quality-20261010/g)||[]).length,1);
  assert.throws(()=>installRuntimeQuality(output,'',''),/E_ALREADY_INSTALLED/);
  assert.throws(()=>installRuntimeQuality(skin,'</script>',''),/E_SCRIPT_STYLE_BOUNDARY/);
  assert.throws(()=>installRuntimeQuality('REDACTED'+skin,'',''),/E_LIVE_SOURCE_REQUIRED/);
});

test('source audit scopes evidence to the article and redacts signed image URLs',()=>{
  const result=extractEvidence('<nav><a href="https://unrelated.example/">nav</a></nav><div class="contents_style"><p>철분 <a href="https://ods.od.nih.gov/factsheets/Iron/">원문</a></p><img src="https://cdn.example/image.jpg?signature=secret" alt="음식"></div>','https://nhunnhun.tistory.com/1');
  assert.equal(result.external.length,1);assert.equal(result.external[0].contentReview,'NOT_PERFORMED');
  assert.equal(result.images[0].host,'cdn.example');assert.equal(result.images[0].path,'/image.jpg');
  assert.equal(accessState(200,'text/html','<title>Just a moment...</title>'),'SOFT_ERROR_CANDIDATE');
  assert.equal(accessState(403,'text/html'),'ACCESS_RESTRICTED');
  assert.equal(accessState(200,'text/html','<title>자료</title><p>철분</p>'),'HTTP_ACCESSIBLE_CONTENT_UNREVIEWED');
  const cross=reconcileSourceAccess({status:404,access:'NOT_FOUND',contentReview:'NOT_PERFORMED'},
    {browserAccess:'CONTENT_DISPLAYED',checkedAt:'2026-10-10',title:'실제 원문'});
  assert.equal(cross.status,404);assert.equal(cross.runtimeAccess,'BROWSER_CONTENT_DISPLAYED');
  assert.equal(cross.discrepancy,true);assert.equal(cross.contentReview,'NOT_PERFORMED');
  assert.equal(reconcileSourceAccess({access:'NOT_FOUND'}, {browserAccess:'UNCONFIRMED'}).runtimeAccess,'UNCONFIRMED');
});

test('growth event installer preserves existing skin and refuses duplicate or redacted input',()=>{
  const skin='<html><body><script>existing()</script>[##_article_rep_desc_##]</body></html>';
  const result=installGrowthEvents(skin,'/* events */');
  assert.ok(result.includes('<script>existing()</script>'));assert.ok(result.includes('[##_article_rep_desc_##]'));
  assert.throws(()=>installGrowthEvents(result,''),/E_ALREADY_INSTALLED/);
  assert.throws(()=>installGrowthEvents('REDACTED'+skin,''),/E_LIVE_SOURCE_REQUIRED/);
  const tagSkin="<script>gtag('config', 'GT-TEST');</script>";
  const protectedSkin=protectExistingAnalytics(tagSkin);
  const calls=[];
  vm.runInNewContext(protectedSkin.replace(/^<script>|<\/script>$/g,''),{gtag:(...args)=>calls.push(args),
    location:{origin:'https://nhunnhun.tistory.com',pathname:'/1',search:'?private=medical&nh_analytics_debug=1'},
    document:{referrer:'https://search.example/?private=secret'},URL,URLSearchParams});
  assert.equal(calls.length,1);assert.equal(calls[0][1],'GT-TEST');
  assert.equal(calls[0][2].page_location,'https://nhunnhun.tistory.com/1');
  assert.equal(calls[0][2].page_referrer,'https://search.example');assert.equal(calls[0][2].debug_mode,true);
  assert.equal(protectExistingAnalytics(protectedSkin),protectedSkin);
  assert.throws(()=>protectExistingAnalytics(tagSkin+tagSkin),/AMBIGUOUS/);
});

test('growth click tracking omits query, fragment, source path and user content and emits no page_view',async()=>{
  const code=await fs.readFile(new URL('../skin/proposals/growth-events-20261010.js',import.meta.url),'utf8');
  const calls=[];let handler;
  const context={window:{gtag:(...args)=>calls.push(args)},location:{origin:'https://nhunnhun.tistory.com',pathname:'/1',search:'?private=medical&nh_analytics_debug=1'},URL,URLSearchParams,setTimeout,
    document:{addEventListener:(name,fn)=>{assert.equal(name,'click');handler=fn;}}};
  vm.runInNewContext(code,context);
  const anchor=href=>({href,matches:s=>s==='a',closest:()=>true});
  handler({target:{closest:()=>anchor('https://nhunnhun.tistory.com/2?private=secret#diagnosis')}});
  handler({target:{closest:()=>anchor('https://ods.od.nih.gov/factsheets/Iron/?token=secret')}});
  assert.deepEqual(calls.map(c=>c[1]),['related_link_click','source_click']);
  const serialized=JSON.stringify(calls);
  for(const forbidden of ['medical','secret','diagnosis','factsheets','page_view']) assert.equal(serialized.includes(forbidden),false);
  assert.equal(calls[0][2].page_location,'https://nhunnhun.tistory.com/1');
  assert.equal(calls[1][2].source_host,'ods.od.nih.gov');assert.equal(calls[1][2].interaction_stage,'requested');
  vm.runInNewContext(code,context);assert.equal(calls.length,2);
});

test('schema date observations detect reversed dates and identity mismatch without semantic certification',()=>{
  const rows=summarizeSchemaDates({one:{url:'https://nhunnhun.tistory.com/1',jsonLd:[{validJson:true,value:{'@graph':[{'@type':'BlogPosting',url:'https://nhunnhun.tistory.com/2',headline:'제목&middot;정보',datePublished:'2026-10-10',dateModified:'2026-10-09'}]}}]}});
  assert.deepEqual(rows[0].issues,['SCHEMA_URL_MISMATCH','MODIFIED_BEFORE_PUBLISHED','HEADLINE_CONTAINS_HTML_ENTITY']);
  assert.equal(rows[0].semanticReview,'NOT_PERFORMED');
  assert.equal(rows[0].officialValidation,'NOT_PERFORMED');
});

test('schema observation preserves missing dates and missing Article as separate findings',()=>{
  const rows=summarizeSchemaDates({one:{url:'https://nhunnhun.tistory.com/1',jsonLd:[{validJson:true,value:{'@type':'BlogPosting',url:'https://nhunnhun.tistory.com/1',headline:'건강'}}]},two:{url:'https://nhunnhun.tistory.com/2',jsonLd:[{validJson:false}]}});
  assert.deepEqual(rows[0].dates,[{published:null,modified:null}]);
  assert.deepEqual(rows[0].issues,['PUBLISHED_DATE_MISSING_OR_INVALID','MODIFIED_DATE_MISSING_OR_INVALID']);
  assert.deepEqual(rows[1].issues,['ARTICLE_SCHEMA_MISSING']);
});

test('growth navigation preserves skin content and refuses duplicate installation',()=>{
  const s='<html><body>[##_article_rep_desc_##]<footer>Copyright</footer></body></html>';
  const out=installGrowthNavigation(s,'/* no network */');
  assert.ok(out.includes('[##_article_rep_desc_##]'));
  assert.ok(out.includes('href="/pages/about"'));
  assert.throws(()=>installGrowthNavigation(out,''),/E_ALREADY_INSTALLED/);
});

test('nested matching canonical remains separate from conflicting URLs and metadata duplicates',()=>{
  const url='https://nhunnhun.tistory.com/1';
  const s=`<html><head><link rel="canonical" href="${url}"></head><body><div><html><head><link rel="canonical" href="${url}"></head></html></div></body></html>`;
  const result=metadata(s,url);
  assert.equal(result.canonicalConflict,false);assert.equal(result.nestedCanonical,1);
  assert.equal(metadata(s.replaceAll(url,url+'/other')+`<link rel="canonical" href="${url}">`,url).canonicalConflict,true);
  assert.deepEqual(duplicateGroups([{url:'a',title:'same'},{url:'b',title:'same'}],'title')[0].urls,['a','b']);
});

test('skin head repair preserves resources and template placeholders and rejects ambiguous sources', () => {
  const s = '<!doctype html><html lang="ko"><style>.x{color:red}</style><head><meta name="msvalidate.01" content="public-value"><title>[##_title_##]</title></head><body>[##_article_rep_desc_##]</body></html>';
  const out = normalizeSkinHead(s);
  assert.match(out, /<html lang="ko">\n<head>\n<meta name="msvalidate.01"/);
  for (const item of ['<style>.x{color:red}</style>','[##_title_##]','[##_article_rep_desc_##]']) assert.ok(out.includes(item));
  assert.equal(out.match(/<head>/g).length,1);
  assert.equal(normalizeSkinHead(out),out);
  assert.throws(()=>normalizeSkinHead('REDACTED'), /E_REDACTED_SOURCE/);
  assert.throws(()=>normalizeSkinHead(s+s), /E_HEAD_STRUCTURE/);
});

test('independent inventory detects missing and stale sitemap entries without counting categories', () => {
  const base = 'https://nhunnhun.tistory.com';
  const result = compareInventory([{url:base+'/1'},{url:base+'/2'}], [base+'/1',base+'/1',base+'/3',base+'/category']);
  assert.deepEqual(result.sitemapDuplicates,[base+'/1']);
  assert.deepEqual(result.missingFromSitemap,[base+'/2']);
  assert.deepEqual(result.absentFromAdmin,[base+'/3']);
  assert.equal(result.sitemapCount,2);
  assert.throws(()=>compareInventory([{url:'https://other.test/1'}],[]), /E_NON_ARTICLE_ADMIN_URL/);
});
test('canonical, noindex, invalid schema and same-host links remain distinct', () => {
  const p = inspect('<title>건강</title><link rel="canonical" href="https://nhunnhun.tistory.com/1"><meta name="robots" content="noindex"><meta name="description" content="설명"><a href="/2#x">관련</a><a href="https://other.test/">외부</a><script type="application/ld+json">broken</script>', 'https://nhunnhun.tistory.com/1');
  assert.equal(p.noindex, true); assert.deepEqual(p.internal, ['https://nhunnhun.tistory.com/2']); assert.equal(p.jsonLd[0].validJson, false); assert.equal(p.rawBodyPresent, false);
});
test('sitemap duplicate URLs are retained for diagnosis', () => {
  assert.deepEqual(locations('<loc>https://a.test/?a=1&amp;b=2</loc><loc>https://a.test/?a=1&amp;b=2</loc>'), ['https://a.test/?a=1&b=2', 'https://a.test/?a=1&b=2']);
});
