import {plainText} from '../publishing/core.mjs';
export function publicArticleTitle(html){
  for(const [tag] of html.matchAll(/<meta\b[^>]*>/gi)){
    if(!/\bproperty\s*=\s*(["'])og:title\1/i.test(tag))continue;
    const content=tag.match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i)?.[2];
    if(content)return plainText(content).replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,(_m,key)=>{
      const named={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '};if(key[0]!=='#')return named[key.toLowerCase()];
      const code=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);
      if(code<=0||code>0x10ffff||code>=0xd800&&code<=0xdfff)throw new Error('E_INTERNAL_LINK_TITLE');
      return String.fromCodePoint(code);
    }).replace(/\s+/g,' ').trim();
  }
  throw new Error('E_INTERNAL_LINK_TITLE');
}
