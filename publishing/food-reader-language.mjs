// Food articles are written for everyday Korean readers. Scientific names and
// image license metadata belong in the source/attribution list, not in large
// reader-facing paragraphs or captions.
const MAIN_END=/<h2[^>]*>\s*(?:\d+[.．]\s*)?자료\s*출처\s*<\/h2>/iu;
const BINOMIAL=/\b[A-Z][a-z]{4,}\s+[a-z][a-z-]{3,}\b/u;
const PHOTO_META_CAPTION=/<p[^>]*>\s*(?:<em>|<small>)[\s\S]{0,320}?(?:사진\s*[:：]|CC\s*BY|Public\s*Domain|촬영\s*[:：])[\s\S]{0,320}?<\/(?:em|small)>\s*<\/p>/iu;

export function assertFoodReaderLanguage(source){
  if(source?.category!=='음식'||source?.contentStandard!=='SP1'||!source?.id?.startsWith('direct-'))return;
  // Non-rewrite maintenance changes are intentionally outside this contract.
  if(source.changeScope&&source.changeScope!=='full-rewrite')return;
  const body=String(source.bodyHtml??'');
  const main=body.split(MAIN_END)[0];
  const readable=main.replace(/<[^>]*>/gu,' ').replace(/&(?:nbsp|amp|lt|gt);/gu,' ');
  if(BINOMIAL.test(readable))throw Error('E_DIRECT_FOOD_LATIN_SPECIES_VISIBLE');
  if(PHOTO_META_CAPTION.test(main))throw Error('E_DIRECT_FOOD_PHOTO_CREDIT_CAPTION');
}
