import {DIRECT_AUTHORING_CONTRACT} from './direct-authoring-contract.mjs';
import {isRejectedHeroSource} from './rejected-hero-sources.mjs';
const REVIEW_KEYS=DIRECT_AUTHORING_CONTRACT.imageReviewKeys;
const ROLES=new Set(['hero','detail','context','process','diagram']);
const COMPOSITIONS=new Set(['closeup','cross-section','context','serving','field','process','diagram']);
const LICENSE=/^(?:CC0|CC BY(?:-SA)?(?: [1-9](?:\.\d)?)?|Public Domain|GFDL)(?:\b|$)/i;
const NUTRIENT_ABSTRACT_HERO=/(?:structure|skeletal|formula|molecule|molecular|crystal|kristall|microscop|polarized|polarised|polariseeritud|chemical[_ -]?structure)/i;
function imageTags(html=''){return [...String(html).matchAll(/<img\b[^>]*>/gi)].map(m=>m[0]);}
function attr(tag,name){return (tag.match(new RegExp('\\b'+name+'=(["\\\'])(.*?)\\1','i'))||[])[2]||'';}
function sourceBlock(html=''){return (String(html).match(/<h2>자료 출처<\/h2>\s*<ul>([\s\S]*?)<\/ul>/)||[])[1]||'';}
// Match the closing delimiter to its opening quote; file names may contain apostrophes.
function hrefs(html=''){return new Set([...String(html).matchAll(/<a\b[^>]*\bhref=(["'])(https:\/\/.*?)\1/gi)].map(m=>m[2].replace(/&amp;/g,'&')));}
function assertHttps(value,code){let u;try{u=new URL(value);}catch{throw new Error(code);}if(u.protocol!=='https:'||u.username||u.password)throw new Error(code);return u;}
function isAbstractNutrientHero(item,review){
  if(String(item?.category??'').trim()!=='영양소')return false;
  let pathname='';
  try{pathname=decodeURIComponent(new URL(review?.sourcePage??'').pathname);}catch{return false;}
  return NUTRIENT_ABSTRACT_HERO.test(pathname);
}
export function assertImageReview(item){
  const tags=imageTags(item?.bodyHtml),review=item?.imageReview;
  if(!Array.isArray(review)||review.length!==tags.length||tags.length<DIRECT_AUTHORING_CONTRACT.imageMinimum)throw new Error('E_IMAGE_REVIEW_REQUIRED');
  if(review[0]?.role!=='hero'||review[0]?.composition!=='closeup'||review[0]?.src!==item.representativeImageUrl)throw new Error('E_IMAGE_HERO_REVIEW');
  // Sources explicitly rejected after visual inspection must not silently return as a hero.
  // Nutrient hero images also reject deterministic abstract-science filename patterns so molecular structures,
  // microscopy and crystal images cannot become the representative image merely because licensing metadata passes.
  if(isRejectedHeroSource(review[0]?.sourcePage)||isAbstractNutrientHero(item,review[0]))throw new Error('E_IMAGE_HERO_REJECTED');
  const sourceLinks=hrefs(sourceBlock(item.bodyHtml)),seenSrc=new Set(),seenPages=new Set();
  for(let i=0;i<review.length;i++){
    const r=review[i],tag=tags[i];
    if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).some(k=>!REVIEW_KEYS.includes(k)))throw new Error('E_IMAGE_REVIEW_SCHEMA');
    // Optional observation only. Never synthesize true or restore the removed mandatory gate.
    if(r.visualChecked!==undefined&&typeof r.visualChecked!=='boolean')throw new Error('E_IMAGE_REVIEW_SCHEMA');
    if(!ROLES.has(r.role)||!COMPOSITIONS.has(r.composition)||(i>0&&r.role==='hero'))throw new Error('E_IMAGE_REVIEW_REQUIRED');
    const src=attr(tag,'src'),alt=attr(tag,'alt');
    if(r.src!==src||r.alt!==alt||!alt.trim()||alt.length<6)throw new Error('E_IMAGE_REVIEW_MISMATCH');
    assertHttps(r.src,'E_IMAGE_REVIEW_URL');
    const page=assertHttps(r.sourcePage,'E_IMAGE_REVIEW_SOURCE');
    if(page.hostname!=='commons.wikimedia.org'||!/^\/wiki\/File:/i.test(page.pathname))throw new Error('E_IMAGE_REVIEW_SOURCE');
    if(!String(r.author||'').trim()||!LICENSE.test(String(r.license||'').trim()))throw new Error('E_IMAGE_REVIEW_LICENSE');
    if(!sourceLinks.has(r.sourcePage))throw new Error('E_IMAGE_REVIEW_ATTRIBUTION');
    if(seenSrc.has(r.src)||seenPages.has(r.sourcePage))throw new Error('E_IMAGE_REVIEW_DUPLICATE');
    seenSrc.add(r.src);seenPages.add(r.sourcePage);
  }
  return item;
}
