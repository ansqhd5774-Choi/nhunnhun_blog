import {readdir,readFile} from 'node:fs/promises';import {join} from 'node:path';import {publicReader} from './research.mjs';
import {plainText,fingerprint} from '../publishing/core.mjs';
const norm=s=>String(s).normalize('NFKC').toLowerCase().replace(/\s+/g,'');
export function matchingIntent(keyword,entries){const key=norm(keyword);if(!key)throw new Error('E_KEYWORD');return entries.filter(e=>norm(e.title).includes(key));}
export async function articleInventory(source,{signal,read=publicReader({signal})}={}){
  const entries=[];
  for(const directory of ['posts','updates']){
    for(const file of(await readdir(join(source,directory))).filter(f=>f.endsWith('.json'))){
      const item=JSON.parse(await readFile(join(source,directory,file),'utf8'));
      if(item.id==='example-post')continue;
      let url=item.targetUrl??null;
      if(directory==='posts'&&/^[a-z0-9-]+$/.test(item.id)){try{const ledger=JSON.parse(await readFile(join(source,'publishing/state',item.id+'.json'),'utf8'));if(ledger.phase==='published'&&ledger.fingerprint===fingerprint(item)&&/^https:\/\/nhunnhun\.tistory\.com\/\d+$/.test(ledger.url))url=ledger.url;}catch{}}
      entries.push({source_id:item.id,title:item.title,url,source_kind:directory});
    }
  }
  const response=await read('https://nhunnhun.tistory.com/rss',8*1024*1024),text=response.bytes.toString('utf8');
  for(const match of text.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)){
    const title=plainText((match[1].match(/<title>([\s\S]*?)<\/title>/)?.[1]??'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1'));
    const url=(match[1].match(/<link>([^<]+)<\/link>/)?.[1]??'').trim();
    if(title&&/^https:\/\/nhunnhun\.tistory\.com\/\d+$/.test(url))entries.push({title,url,source_kind:'rss'});
  }
  return {entries,coverage:'REPOSITORY_PLUS_RSS_PARTIAL; ABSENCE_IS_NOT_PROOF_NO_DUPLICATE',retrieved_at:new Date().toISOString()};
}
