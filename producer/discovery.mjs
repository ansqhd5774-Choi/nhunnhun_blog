import {publicReader,publicUrl} from './research.mjs';
import {plainText} from '../publishing/core.mjs';
export const FRUIT_SOURCE='https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/raw-fruits-poster-text-version-accessible-version';
export const CLEAN_SOURCE='https://www.fda.gov/consumers/consumer-updates/7-tips-cleaning-fruits-vegetables';
export const FOOD_CATALOG={사과:{row:'Apple',category:'Apples'},바나나:{row:'Banana',category:'Bananas'},아보카도:{row:'Avocado',category:'Avocados'},포도:{row:'Grapes',category:'Grapes'},자몽:{row:'Grapefruit',category:'Grapefruits'},키위:{row:'Kiwifruit',category:'Kiwifruit'},오렌지:{row:'Orange',category:'Oranges'},복숭아:{row:'Peach',category:'Peaches'},천도복숭아:{row:'Nectarine',category:'Nectarines'},서양배:{row:'Pear',category:'Pears'},파인애플:{row:'Pineapple',category:'Pineapples'},자두:{row:'Plums',category:'Plums'},딸기:{row:'Strawberries',category:'Strawberries'},체리:{row:'Sweet Cherries',category:'Cherries'},귤:{row:'Tangerine',category:'Mandarins'},수박:{row:'Watermelon',category:'Watermelons'}};
export function cleaningClaims(text){
  const facts=[
    ['c-wash','농산물은 먹기 전 흐르는 물에서 문질러 씻는다. 비누나 과일 세척제는 사용할 필요가 없다.', 'Gently rub produce while holding under plain running water. There’s no need to use soap or a produce wash.'],
    ['c-select','가능하면 눌리거나 손상되지 않은 농산물을 고른다. 이미 자른 농산물은 매장과 집에서 냉장하거나 얼음 위에 둔다.', 'If possible, FDA says to choose produce that isn’t bruised or damaged, and make sure that pre-cut items—such as bags of lettuce or watermelon slices—are either refrigerated or on ice both in the store and at home.'],
    ['c-hands','신선한 농산물을 준비하기 전과 후에 따뜻한 물과 비누로 손을 20초 동안 씻는다.', 'Wash your hands for 20 seconds with warm water and soap before and after preparing fresh produce.'],
    ['c-peel','껍질을 벗길 농산물도 벗기기 전에 먼저 헹군다.', 'Rinse produce BEFORE you peel it, so dirt and bacteria aren’t transferred from the knife onto the fruit or vegetable.'],
    ['c-dry','씻은 농산물은 깨끗한 천이나 종이타월로 물기를 말린다.', 'Dry produce with a clean cloth or paper towel to further reduce bacteria that may be present.'],
  ];
  if(facts.some(f=>!text.includes(f[2])))throw new Error('BLOCKED_EVIDENCE');
  return facts.map(([id,text,excerpt])=>({id,text,excerpt,reviewed:true,review_method:'PRE_REVIEWED_FDA_GENERAL_PRODUCE_HANDLING_CLAIM'}));
}
export function parseFruitRow(html,name){
  const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[...m[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(c=>plainText(c[1])));
  if(!rows[0]?.[0]?.startsWith('Fruits')||!/^Calories$/i.test(rows[0]?.[1]?.trim()??'')||!/Dietary\s*Fiber\s*\(g\)/i.test(rows[0]?.[11]??'')||/%/.test(rows[0]?.[11]??''))throw new Error('E_FDA_COLUMNS');
  const row=rows.find(r=>r[0]?.startsWith(name+' '));
  if(!row||row.length!==19||!/^\d+(?:\.\d+)?$/.test(row[1])||!/^\d+(?:\.\d+)?$/.test(row[11]))throw new Error('BLOCKED_EVIDENCE');
  const grams=row[0].match(/\((\d+(?:\.\d+)?)\s*g\//)?.[1];if(!grams)throw new Error('E_FDA_PORTION');
  return {serving:row[0],grams,calories:row[1],fiber:row[11],excerpt:row.join(' ')};
}
export function commonsFiles(html){return [...new Set([...html.matchAll(/href="(\/wiki\/File:[^"#?]+\.(?:jpg|jpeg|png))"/gi)].map(m=>'https://commons.wikimedia.org'+m[1].replace(/&amp;/g,'&')))].slice(0,60);}
export function fileCandidate(html,page){
  publicUrl(page);
  let asset=html.match(/class="fullImageLink"[\s\S]*?<a href="(https:\/\/upload\.wikimedia\.org\/[^" ]+)"/)?.[1];
  const author=html.match(/id="fileinfotpl_aut"[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/)?.[1]??html.match(/<td\b[^>]*>\s*Author\s*<\/td>\s*<td\b[^>]*>([\s\S]*?)<\/td>/)?.[1];
  if(!asset||!author)return null;
  if(/lacking|unknown|not (?:known|given)|missing/i.test(plainText(author)))return null;
  const assetUrl=publicUrl(asset.replace(/&amp;/g,'&'));assetUrl.search='';asset=assetUrl.href;
  const originalAsset=asset;
  // Use only the displayed preview URL actually present inside the primary image link.
  // Commons supplies this resized asset; no thumbnail URL or crop is invented.
  const imageLink=html.match(/class="fullImageLink"[\s\S]*?<a href="https:\/\/upload\.wikimedia\.org\/[^" ]+"[^>]*>([\s\S]*?)<\/a>/)?.[1];
  const preview=imageLink?.match(/\bsrc="((?:https:)?\/\/(?:upload|thumb)\.wikimedia\.org\/[^" ]+)"/)?.[1];
  if(preview){const previewUrl=publicUrl((preview.startsWith('//')?'https:':'')+preview.replace(/&amp;/g,'&'));previewUrl.search='';asset=previewUrl.href;}
  const start=html.indexOf('id="Licensing"'),ends=['id="File_history"','id="filehistory"'].map(s=>html.indexOf(s,start)).filter(n=>n>start),end=ends.length?Math.min(...ends):-1;
  if(start<0||end<=start)return null;
  // Commons footer CC0 applies to metadata, not the photograph. Inspect only its licensing section.
  const licensing=html.slice(start,end);
  let license,licenseUrl;
  if(/creativecommons\.org\/licenses\/by\/4\.0/.test(licensing)){license='CC-BY-4.0';licenseUrl='https://creativecommons.org/licenses/by/4.0/';}
  else if(/creativecommons\.org\/licenses\/by-sa\/4\.0/.test(licensing)){license='CC-BY-SA-4.0';licenseUrl='https://creativecommons.org/licenses/by-sa/4.0/';}
  else if(/creativecommons\.org\/publicdomain\/zero\/1\.0/.test(licensing)){license='CC0';licenseUrl='https://creativecommons.org/publicdomain/zero/1.0/';}
  else if(/class="[^"]*licensetpl[^"]*"[\s\S]*?public domain/i.test(licensing)){license='PUBLIC_DOMAIN';licenseUrl=page;}
  else return null;
  return {original_page_url:page,original_asset_url:originalAsset,https_asset_url:asset,asset_selection:asset===originalAsset?'ORIGINAL':'COMMONS_DISPLAY_PREVIEW_NO_CROP_REQUESTED',author:plainText(author),license,license_url:licenseUrl,rights_reviewed:false,visualChecked:false,review_status:'CANDIDATE_NOT_APPROVED'};
}
export async function discoverKeyword(keyword,{signal,read=publicReader({signal})}={}){
  const food=FOOD_CATALOG[keyword];if(!food)throw new Error('BLOCKED_EVIDENCE');
  const fruit=await read(FRUIT_SOURCE),row=parseFruitRow(fruit.bytes.toString('utf8'),food.row);
  const cleaning=await read(CLEAN_SOURCE),clean=plainText(cleaning.bytes.toString('utf8'));
  const handling=cleaningClaims(clean);
  const category='https://commons.wikimedia.org/wiki/Category:'+food.category;
  const listing=await read(category),candidates=[];
  const stem=food.category.toLowerCase().slice(0,4);
  const files=commonsFiles(listing.bytes.toString('utf8')).filter(p=>!/orchard_book|nurseries|catalog|encyclop|painting|drawing|ribbon/i.test(p));
  // Filename relevance only orders inspection; it never marks a photograph as accepted.
  files.sort((a,b)=>Number(decodeURIComponent(b).toLowerCase().includes(stem))-Number(decodeURIComponent(a).toLowerCase().includes(stem)));
  for(const page of files){
    const result=await read(page);const item=fileCandidate(result.bytes.toString('utf8'),page);if(item)candidates.push(item);
    if(candidates.length>=12)break;
  }
  const claims=[{id:'c-portion',text:`FDA ${food.row} 행은 먹을 수 있는 부분 ${row.grams} g 기준이다. 이는 권장 섭취량이 아닌 영양표의 기준량이다.`,excerpt:row.excerpt,reviewed:true,review_method:'STRUCTURED_FDA_COLUMN_AND_PORTION_CHECK'},{id:'c-calories',text:`${keyword}의 FDA 표 기준량 ${row.grams} g에서 열량은 ${row.calories} kcal이다. 크기가 다른 모든 과일 한 개에 동일하게 적용하지 않는다.`,excerpt:row.excerpt,reviewed:true,review_method:'STRUCTURED_FDA_COLUMN_AND_PORTION_CHECK'},{id:'c-fiber',text:`${keyword}의 FDA 표 기준량 ${row.grams} g에서 식이섬유는 ${row.fiber} g이다.`,excerpt:row.excerpt,reviewed:true,review_method:'STRUCTURED_FDA_COLUMN_AND_PORTION_CHECK'}];
  const cleanDate=clean.match(/Content current as of:\s*(\d{2})\/(\d{2})\/(\d{4})/);
  return {keyword,sources:[{url:FRUIT_SOURCE,title:'Raw Fruits Poster',institution:'FDA',published_at:'UNDATED',claims},{url:CLEAN_SOURCE,title:'7 Tips for Cleaning Fruits, Vegetables',institution:'FDA',published_at:cleanDate?`${cleanDate[3]}-${cleanDate[1]}-${cleanDate[2]}`:'UNDATED',claims:handling}],image_candidates:candidates,research_status:'SOURCES_DISCOVERED_IMAGES_REQUIRE_REVIEW',medical_review:'GENERAL_FOOD_DATA_ONLY',search_intent_review:'PENDING',internal_links:[]};
}
