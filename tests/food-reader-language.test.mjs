import test from 'node:test';
import assert from 'node:assert/strict';
import {assertFoodReaderLanguage} from '../publishing/food-reader-language.mjs';

const source=(bodyHtml,changeScope='full-rewrite')=>({
  id:'direct-food-readability-example',category:'음식',contentStandard:'SP1',changeScope,bodyHtml
});

test('full food rewrite rejects unexplained Latin binomial in prose',()=>{
  assert.throws(()=>assertFoodReaderLanguage(source('<p>학명은 <em>Marsupenaeus japonicus</em>입니다.</p>')),/E_DIRECT_FOOD_LATIN_SPECIES_VISIBLE/);
});

test('full food rewrite rejects dominant image-credit captions in body',()=>{
  assert.throws(()=>assertFoodReaderLanguage(source('<p><img src="https://example.org/a.jpg"></p><p><em>사진: Photographer, CC BY-SA 4.0.</em></p>')),/E_DIRECT_FOOD_PHOTO_CREDIT_CAPTION/);
});

test('scientific identifiers and photo license citations in bottom sources are allowed',()=>{
  assert.doesNotThrow(()=>assertFoodReaderLanguage(source('<p>새우 줄무늬와 크기를 보고 구별합니다.</p><h2>자료 출처</h2><ul><li>Marsupenaeus japonicus</li><li>사진: Totti, CC BY-SA 4.0</li></ul>')));
});

test('maintenance-only food update is not judged as a full rewrite',()=>{
  assert.doesNotThrow(()=>assertFoodReaderLanguage(source('<p><em>Marsupenaeus japonicus</em></p>','stock-lead-removal')));
});
