import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect, locations } from '../scripts/audit-search-foundation.mjs';
import { compareInventory } from '../scripts/compare-public-inventory.mjs';
import { normalizeSkinHead } from '../scripts/normalize-skin-head.mjs';
import { metadata,duplicateGroups } from '../scripts/audit-public-metadata.mjs';
import { installGrowthNavigation } from '../scripts/install-growth-navigation.mjs';

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
