import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect, locations } from '../scripts/audit-search-foundation.mjs';
test('canonical, noindex, invalid schema and same-host links remain distinct', () => {
  const p = inspect('<title>건강</title><link rel="canonical" href="https://nhunnhun.tistory.com/1"><meta name="robots" content="noindex"><meta name="description" content="설명"><a href="/2#x">관련</a><a href="https://other.test/">외부</a><script type="application/ld+json">broken</script>', 'https://nhunnhun.tistory.com/1');
  assert.equal(p.noindex, true); assert.deepEqual(p.internal, ['https://nhunnhun.tistory.com/2']); assert.equal(p.jsonLd[0].validJson, false); assert.equal(p.rawBodyPresent, false);
});
test('sitemap duplicate URLs are retained for diagnosis', () => {
  assert.deepEqual(locations('<loc>https://a.test/?a=1&amp;b=2</loc><loc>https://a.test/?a=1&amp;b=2</loc>'), ['https://a.test/?a=1&b=2', 'https://a.test/?a=1&b=2']);
});
