import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPublishHtml} from '../publishing/core.mjs';

const source=bodyHtml=>({bodyHtml});

test('restricted centered table-cell alignment is accepted',()=>{
  const html='<table><thead><tr><th style="text-align:center;vertical-align:middle">항목</th></tr></thead><tbody><tr><td style="text-align:center;vertical-align:middle">값</td></tr></tbody></table>';
  assert.doesNotThrow(()=>checkPublishHtml(source(html)));
});

test('table-cell styles outside the approved center alignment remain blocked',()=>{
  for(const html of [
    '<table><tr><td style="text-align:left">값</td></tr></table>',
    '<table><tr><td style="color:red">값</td></tr></table>',
    '<table><tr><th style="vertical-align:top">항목</th></tr></table>'
  ]) assert.throws(()=>checkPublishHtml(source(html)),/E_HTML_REQUIRES_REVIEW/);
});
