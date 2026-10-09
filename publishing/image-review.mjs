const REVIEW_KEYS=['src','alt','role','composition','sourcePage','author','license','visualChecked'];
const ROLES=new Set(['hero','detail','context','process','diagram']);
const COMPOSITIONS=new Set(['closeup','cross-section','context','process','diagram']);
const LICENSE=/^(?:CC0|CC BY(?:-SA)?(?: [1-9](?:\.\d)?)?|Public Domain|GFDL)(?:\b|$)/i;
function imageTags(html=''){return [...String(html).matchAll(/<img\b[^>]*>/gi)].map(m=>m[0]);}
function attr(tag,name){return (tag.match(new RegExp('\\b'+name+'=(["\\\'])(.*?)\\1','i'))||[])[2]||'';}
function sourceBlock(html=''){return (String(html).match(/<h2>자료 출처<\/h2>\s*<ul>([\s\S]*?)<\/ul>/)||[])[1]||'';}
// Match the closing delimiter to its opening quote; file names may contain apostrophes.
function hrefs(html=''){return new Set([...String(html).matchAll(/<a\b[^>]*\bhref=(["'])(https:\/\/.*?)\1/gi)].map(m=>m[2].replace(/&amp;/g,'&')));}
function assertHttps(value,code){let u;try{u=new URL(value);}catch{throw new Error(code);}if(u.protocol!=='https:'||u.username||u.password)throw new Error(code);return u;}
export function assertImageReview(item){
  const tags=imageTags(item?.bodyHtml),review=item?.imageReview;
  if(!Array.isArray(review)||review.length!==tags.length||tags.length<3)throw new Error('E_IMAGE_REVIEW_REQUIRED');
  if(review[0]?.role!=='hero'||review[0]?.composition!=='closeup'||review[0]?.src!==item.representativeImageUrl)throw new Error('E_IMAGE_HERO_REVIEW');
  const sourceLinks=hrefs(sourceBlock(item.bodyHtml)),seenSrc=new Set(),seenPages=new Set();
  for(let i=0;i<review.length;i++){
    const r=review[i],tag=tags[i];
    if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).some(k=>!REVIEW_KEYS.includes(k)))throw new Error('E_IMAGE_REVIEW_SCHEMA');
    if(r.visualChecked!==true||!ROLES.has(r.role)||!COMPOSITIONS.has(r.composition)||(i>0&&r.role==='hero'))throw new Error('E_IMAGE_REVIEW_REQUIRED');
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
