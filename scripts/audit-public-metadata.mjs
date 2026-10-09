import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Parser } from 'htmlparser2';
import { inspect } from './audit-search-foundation.mjs';

export function metadata(html, url) {
  const stack = []; const canonicalLocations = [];
  const parser = new Parser({
    onopentag(name, attrs) {
      if (name === 'link' && attrs.rel === 'canonical') canonicalLocations.push({url:attrs.href, primaryHead:stack.join('/') === 'html/head'});
      stack.push(name);
    },
    onclosetag(name) { const index=stack.lastIndexOf(name); if(index>=0) stack.length=index; },
  });
  parser.write(html); parser.end();
  const base = inspect(html,url);
  return {url,title:base.title,description:base.description,canonical:base.canonical,canonicalLocations,
    canonicalConflict:new Set(base.canonical).size>1,
    nestedCanonical:canonicalLocations.filter(c=>!c.primaryHead).length,
    noindex:base.noindex,og:base.og,jsonLd:base.jsonLd,
    images:base.images,rawBodyPresent:base.rawBodyPresent};
}
export function duplicateGroups(rows, field) {
  const groups=new Map();
  for(const row of rows){const value=field==='description'?row.description?.[0]:row[field];if(!value)continue;const key=value.replace(/\s+/g,' ').trim();groups.set(key,[...(groups.get(key)||[]),row.url]);}
  return [...groups].filter(([,urls])=>urls.length>1).map(([value,urls])=>({value,urls}));
}
export async function run(inventoryPath,outDir) {
  await fs.mkdir(outDir,{recursive:true});
  const inventory=JSON.parse(await fs.readFile(inventoryPath,'utf8'));
  const checkpoint=path.join(outDir,'metadata-pages.json');
  let pages={};try{pages=JSON.parse(await fs.readFile(checkpoint,'utf8'));}catch{}
  const targets=inventory.rows.filter(row=>!pages[row.url]);
  for(let i=0;i<targets.length;i+=4){
    await Promise.all(targets.slice(i,i+4).map(async row=>{
      try{const r=await fetch(row.url,{signal:AbortSignal.timeout(20000)}); pages[row.url]={checkedAt:new Date().toISOString(),status:r.status,...metadata(await r.text(),row.url)};}
      catch(e){pages[row.url]={url:row.url,error:e.name};}
    }));
    await fs.writeFile(checkpoint,JSON.stringify(pages,null,2));
    if(i%40===0)console.log(`Metadata ${Math.min(i+4,targets.length)}/${targets.length}`);
  }
  const rows=inventory.rows.map(r=>pages[r.url]);
  const summary={checkedAt:new Date().toISOString(),pages:rows.length,httpErrors:rows.filter(r=>r.status!==200).map(r=>r.url),
    noindex:rows.filter(r=>r.noindex).map(r=>r.url),canonicalConflicts:rows.filter(r=>r.canonicalConflict).map(r=>r.url),
    nestedCanonical:rows.filter(r=>r.nestedCanonical).map(r=>r.url),
    duplicateTitles:duplicateGroups(rows,'title'),duplicateDescriptions:duplicateGroups(rows,'description'),
    invalidJsonLd:rows.filter(r=>r.jsonLd?.some(j=>!j.validJson)).map(r=>r.url),
    missingDescription:rows.filter(r=>r.description?.length!==1).map(r=>r.url),
    limits:['Raw server metadata only; schema meaning, rendered crawler visibility and editorial accuracy require separate evidence.']};
  await fs.writeFile(path.join(outDir,'metadata-summary.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify(Object.fromEntries(Object.entries(summary).map(([k,v])=>[k,Array.isArray(v)?v.length:v]))));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await run(process.argv[2],process.argv[3]);
