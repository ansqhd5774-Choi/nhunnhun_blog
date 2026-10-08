// Typography only: never rewrite, summarize, or validate the article's claims.
export function applyFoodDesign(html){
  let out=html.replace(/(?:<p>\s*\d+[.)]\s+[\s\S]*?<\/p>\s*)+/g,group=>
    '<ol>'+[...group.matchAll(/<p>\s*(\d+)[.)]\s+([\s\S]*?)<\/p>/g)].map(m=>'<li>'+m[2]+'</li>').join('')+'</ol>');
  // A leading item label is a heading, not a whole highlighted paragraph.
  out=out.replace(/(<li>)([^<>:\n]{2,24})[:：]\s*/g,'$1<strong>$2</strong> ');
  const stack=[];let numbers=0,highlights=0;
  out=out.split(/(<[^>]+>)/g).map(part=>{
    if(part.startsWith('<')){
      const closing=part.match(/^<\/([a-z0-9]+)/i);
      if(closing){const index=stack.lastIndexOf(closing[1].toLowerCase());if(index>=0)stack.splice(index);}
      else {const opening=part.match(/^<([a-z0-9]+)/i);if(opening&&!/^(img|br|hr|input)$/i.test(opening[1]))stack.push(opening[1].toLowerCase());}
      if(/^<h2\b/i.test(part)){numbers=0;highlights=0;}
      return part;
    }
    if(stack.some(tag=>['strong','u','mark','a','h1','h2','h3'].includes(tag)))return part;
    // Only a short existing caution/action sentence. No medical benefit selection.
    if(highlights<1&&stack.includes('p'))part=part.replace(/[^.!?。\n]{4,70}(?:주의해야 합니다|주의하세요|피하세요|확인하세요)[.!?]?/g,text=>{
      if(highlights>=1)return text;highlights++;return '<u>'+text+'</u>';
    });
    if(numbers<2)part=part.replace(/\d+(?:\.\d+)?(?:\s*[~～–-]\s*\d+(?:\.\d+)?)?\s*(?:mg|mcg|μg|kcal|kg|g|mL|ml|°C|℃|%|개월|주|일)(?![a-z])/g,text=>{
      if(numbers>=2)return text;numbers++;return '<strong>'+text+'</strong>';
    });
    return part;
  }).join('');
  return out;
}
