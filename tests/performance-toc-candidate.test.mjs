import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeCompactToc } from '../scripts/performance-toc-candidate.mjs';

const label = "link.textContent = heading.closest('.nh-direct-v2') ? heading.textContent.trim().replace(/^\\d{2}(?!\\d)\\s*/, '') : heading.textContent.trim();";
const reader = '<script id="nh-reader-tools-script">'+label+'\nbody.prepend(nav);</script>';
const fixture = '<head><style>.title{color:green}</style></head>'+reader+'<script>platform();</script><aside>Ad</aside>';

test('initial compact labels preserve full title and all surrounding skin code', () => {
  const output = initializeCompactToc(fixture);
  assert.ok(output.includes('link.dataset.fullTitle = fullTitle; link.title = fullTitle;'));
  assert.ok(output.includes("fullTitle.split('｜')[0]"));
  assert.ok(output.startsWith('<head><style>.title{color:green}</style></head>'));
  assert.ok(output.endsWith('body.prepend(nav);</script><script>platform();</script><aside>Ad</aside>'));
});
test('compact TOC installation is idempotent', () => {
  const output = initializeCompactToc(fixture);
  assert.equal(initializeCompactToc(output), output);
});
test('redacted operational source is rejected', () => {
  assert.throws(() => initializeCompactToc('REDACTED'+fixture), /REDACTED_SKIN_NOT_DEPLOYABLE/);
});
test('missing or duplicate reader blocks are rejected', () => {
  assert.throws(() => initializeCompactToc('<head></head>'), /EXPECTED_ONE_READER_SCRIPT/);
  assert.throws(() => initializeCompactToc(fixture+reader), /EXPECTED_ONE_READER_SCRIPT/);
});
test('unknown or duplicated original label contract is rejected', () => {
  assert.throws(() => initializeCompactToc(fixture.replace(label, 'link.textContent = heading.innerText;')), /EXPECTED_ORIGINAL_TOC_LABEL_CONTRACT/);
  assert.throws(() => initializeCompactToc(fixture.replace(label, label+label)), /EXPECTED_ORIGINAL_TOC_LABEL_CONTRACT/);
});
