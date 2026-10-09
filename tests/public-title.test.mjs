import test from 'node:test';
import assert from 'node:assert/strict';
import {assertPublicTitle} from '../publishing/public-title.mjs';
test('split heading preserves exact title identity',()=>assert.doesNotThrow(()=>assertPublicTitle({heading:'템페 효능\n먹는 법',og:'템페 효능｜먹는 법'},'템페 효능｜먹는 법')));
test('wrong heading cannot pass using sidebar title',()=>assert.throws(()=>assertPublicTitle({heading:'두부',og:'템페'},'템페'),/E_PUBLIC_TITLE_MISMATCH/));
test('wrong metadata fails',()=>assert.throws(()=>assertPublicTitle({heading:'템페',og:'두부'},'템페'),/E_PUBLIC_TITLE_METADATA_MISMATCH/));
