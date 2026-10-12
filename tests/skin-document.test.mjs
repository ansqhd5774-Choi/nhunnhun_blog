import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSkinDocument} from '../scripts/check-skin-document.mjs';
const single='<!DOCTYPE html><html><head><title>검증</title></head><body>본문</body></html>';
test('one complete skin document passes',()=>assert.deepEqual(assertSkinDocument(single),{html:1,head:1,body:1}));
test('concatenated skin documents fail before deployment',()=>assert.throws(()=>assertSkinDocument(single+single),/E_SKIN_DOCUMENT_COUNT/));
test('HTML-looking strings inside scripts are not extra documents',()=>assert.doesNotThrow(()=>assertSkinDocument(single.replace('</head>','<script>const text="<html><head><body>";</script></head>'))));
test('missing body fails instead of accepting a partial skin',()=>assert.throws(()=>assertSkinDocument('<html><head></head></html>'),/E_SKIN_DOCUMENT_COUNT/));
