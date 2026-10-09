import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPerformanceResources } from '../scripts/performance-resource-audit.mjs';

test('resource audit limits image candidates to article and never reports measured vitals', () => {
  const result = inspectPerformanceResources('<img src="profile.png"><div class="contents_style"><img src="hero.jpg" loading="lazy" alt="Food"><img src="detail.jpg" width="100" height="50"></div><img src="ad.jpg">', 'https://nhunnhun.tistory.com/282');
  assert.equal(result.articleImages.length, 2);
  assert.equal(result.firstArticleImage.src, 'https://nhunnhun.tistory.com/hero.jpg');
  assert.equal(result.fieldVitals, 'NOT_MEASURED');
  assert.equal(result.laboratoryVitals, 'NOT_MEASURED');
  assert.deepEqual(result.warnings, ['FIRST_ARTICLE_IMAGE_LAZY_RAW_HTML', 'IMAGE_DIMENSIONS_MISSING_RAW_HTML']);
});

test('resource audit distinguishes asynchronous scripts and duplicate connections', () => {
  const result = inspectPerformanceResources('<link rel="preconnect" href="https://a.example"><link rel="preconnect" href="https://a.example/x"><script src="https://a.example/b.js" async></script><script src="/blocking.js"></script><link rel="stylesheet" href="/print.css" media="print">', 'https://nhunnhun.tistory.com/282');
  assert.deepEqual(result.preconnects.duplicateOrigins, ['https://a.example']);
  assert.deepEqual(result.blockingScriptOrigins, ['https://nhunnhun.tistory.com']);
  assert.deepEqual(result.blockingStyles, []);
});

test('resource report omits resource query credentials and signatures', () => {
  const result = inspectPerformanceResources('<div class="article-body"><img src="https://blog.kakaocdn.net/a.jpg?credential=private&amp;signature=secret"></div><link rel="stylesheet" href="/style.css?token=private">', 'https://nhunnhun.tistory.com/282');
  assert.equal(result.firstArticleImage.src, 'https://blog.kakaocdn.net/a.jpg');
  assert.equal(result.blockingStyles[0].href, 'https://nhunnhun.tistory.com/style.css');
  assert.ok(!JSON.stringify(result).includes('private'));
  assert.ok(!JSON.stringify(result).includes('secret'));
});

test('resource audit distinguishes deferred icon font from render blocking stylesheet', () => {
  const result = inspectPerformanceResources('<link rel="stylesheet" href="https://fonts.googleapis.com/icons.css" media="print" onload="this.media=\'all\'"><link rel="stylesheet" href="/style.css">', 'https://nhunnhun.tistory.com/282');
  assert.equal(result.asynchronousStyles.length, 1);
  assert.equal(result.blockingStyles.length, 1);
  assert.equal(result.blockingStyles[0].href, 'https://nhunnhun.tistory.com/style.css');
});
