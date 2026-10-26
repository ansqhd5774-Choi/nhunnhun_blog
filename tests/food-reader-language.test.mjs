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

test('list card must not repeat its heading at the start of its highlighted body',()=>{
  const body='<ul><li><strong>아연</strong> <mark data-tone="positive"><strong>아연 · 정상 면역 기능 유지</strong></mark>에 필요한 미네랄입니다.</li><li><strong>비타민 B12</strong> <mark><strong>비타민 B12 · 신경·혈액</strong></mark>에 필요합니다.</li></ul>';
  assert.throws(()=>assertFoodReaderLanguage(source(body)),/E_DIRECT_FOOD_CARD_LABEL_REPEAT/);
  assert.throws(()=>assertFoodReaderLanguage(source(body,'content-update')),/E_DIRECT_FOOD_CARD_LABEL_REPEAT/);
});

test('list card may introduce a different point and read as natural Korean',()=>{
  const body='<ul><li><strong>면역 기능</strong> 보리새우에는 아연이 들어 있습니다. <mark><strong>해산물·고기·콩을 골고루</strong></mark> 먹어 보세요.</li><li><strong>신경과 혈액</strong> 비타민 B12는 적혈구 형성에 필요합니다.</li></ul>';
  assert.doesNotThrow(()=>assertFoodReaderLanguage(source(body,'content-update')));
});

test('compound card title must not repeat its first nutrient in body opener',()=>{
  const body='<ul><li><strong>칼륨과 셀레늄</strong> 칼륨은 근육과 신경의 기능에 필요합니다.</li></ul>';
  assert.throws(()=>assertFoodReaderLanguage(source(body)),/E_DIRECT_FOOD_CARD_LABEL_REPEAT/);
});
