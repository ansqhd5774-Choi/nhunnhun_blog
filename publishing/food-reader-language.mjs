// Food articles are written for everyday Korean readers. Scientific names and
// image license metadata belong in the source/attribution list, not in large
// reader-facing paragraphs or captions.
const MAIN_END=/<h2[^>]*>\s*(?:\d+[.．]\s*)?자료\s*출처\s*<\/h2>/iu;
const BINOMIAL=/\b[A-Z][a-z]{4,}\s+[a-z][a-z-]{3,}\b/u;
const PHOTO_META_CAPTION=/<p[^>]*>\s*(?:<em>|<small>)[\s\S]{0,320}?(?:사진\s*[:：]|CC\s*BY|Public\s*Domain|촬영\s*[:：])[\s\S]{0,320}?<\/(?:em|small)>\s*<\/p>/iu;
const CARD_TITLE_BODY=/<li\b[^>]*>\s*<strong\b[^>]*>([^<]+)<\/strong>([\s\S]*?)<\/li>/giu;

export function assertFoodReaderLanguage(source){
  if(source?.category!=='음식'||source?.contentStandard!=='SP1'||!source?.id?.startsWith('direct-'))return;
  // Non-rewrite maintenance changes are intentionally outside this contract.
  if(source.changeScope&&!['full-rewrite','content-update'].includes(source.changeScope))return;
  const body=String(source.bodyHtml??'');
  const main=body.split(MAIN_END)[0];
  const readable=main.replace(/<[^>]*>/gu,' ').replace(/&(?:nbsp|amp|lt|gt);/gu,' ');
  if(BINOMIAL.test(readable))throw Error('E_DIRECT_FOOD_LATIN_SPECIES_VISIBLE');
  if(PHOTO_META_CAPTION.test(main))throw Error('E_DIRECT_FOOD_PHOTO_CREDIT_CAPTION');
  // The first <strong> is rendered as a card heading; the rest becomes its body.
  // Identical opening words across the two surfaces read as "아연 아연 · ...".
  for(const match of main.matchAll(CARD_TITLE_BODY)){
    const label=match[1].replace(/\s+/gu,' ').trim();
    const opening=match[2].replace(/<[^>]+>/gu,' ').replace(/\s+/gu,' ').trim();
    if(!label)continue;
    const openingRepeats=term=>{
      if(!term||!opening.startsWith(term))return false;
      const next=opening.slice(term.length);
      return !next||/^[\s·:：,，—–-]/u.test(next)||/^(?:은|는|이|가|을|를)(?:\s|[·:：,，—–-]|$)/u.test(next);
    };
    const firstCompoundTerm=label.split(/(?:과|와|·|\+)/u)[0].trim();
    if(openingRepeats(label)||(firstCompoundTerm.length>=2&&firstCompoundTerm!==label&&openingRepeats(firstCompoundTerm)))
      throw Error('E_DIRECT_FOOD_CARD_LABEL_REPEAT');
  }
}
