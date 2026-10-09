import test from 'node:test';
import assert from 'node:assert/strict';
import { optimizeReadingStability } from '../scripts/optimize-reading-stability.mjs';

const skin = '<!-- SHARED PERFORMANCE R1 20261004 --><header>original title</header><div>[##_article_rep_desc_##]</div><script src="existing-ad.js"></script><script id="nh-reader-tools-script">if (document.readyState === \'loading\') document.addEventListener(\'DOMContentLoaded\', init);\nelse init();</script><script id="nh-reading-layout-20261009">if(document.readyState===\'loading\')document.addEventListener(\'DOMContentLoaded\',enhance);else enhance();</script>';
test('initializes article tools before later scripts, preserving placeholders and integrations', () => {
  const result = optimizeReadingStability(skin, '.sample{display:block}');
  assert.ok(result.indexOf('id="nh-reader-tools-script"') < result.indexOf('existing-ad.js'));
  assert.ok(result.includes('original title'));
  assert.equal(result.split('[##_article_rep_desc_##]').length, 2);
  assert.ok(!result.includes('DOMContentLoaded'));
  assert.equal(optimizeReadingStability(result, '.sample{}'), result);
});
test('rejects missing, duplicate, and redacted source instead of partial deployment', () => {
  assert.throws(() => optimizeReadingStability('REDACTED ' + skin, ''));
  assert.throws(() => optimizeReadingStability(skin.replace('[##_article_rep_desc_##]', ''), ''));
  assert.throws(() => optimizeReadingStability(skin + '<script id="nh-reader-tools-script"></script>', ''));
});
test('title/date initialization precedes article rendering and removed controls are guarded', () => {
  const input = skin.replace('<header>original title</header>', '<header><h1 class="hd-heading">[##_article_rep_title_##]</h1></header>') + 'duplicateCheckButton.addEventListener("click",togglePopup);closeButton.addEventListener("click",hidePopup);';
  const result = optimizeReadingStability(input, '.sample{}', 'headerInit();');
  assert.ok(result.indexOf('headerInit();') < result.indexOf('[##_article_rep_desc_##]'));
  assert.ok(result.includes('duplicateCheckButton?.addEventListener'));
  assert.ok(result.includes('closeButton?.addEventListener'));
});
