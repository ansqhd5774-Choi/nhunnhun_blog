import fs from 'node:fs/promises';
import {parseDocument, DomUtils} from 'htmlparser2';
const base='../evidence/health-growth-final-20261010/';
const metadata=JSON.parse(await fs.readFile(base+'metadata-pages.json','utf8'));
const checkpoint=JSON.parse(await fs.readFile(base+'health-evidence-checkpoint.json','utf8'));
const clean=s=>DomUtils.textContent(parseDocument(String(s??''))).replace(/\s+/g,' ').trim();
const normalizedUrl=s=>String(s??'').replace(/\/$/,'');
const rows=Object.entries(metadata).map(([url,page])=>{
 const records=(page.jsonLd??[]).flatMap(r=>r.validJson?[r.value].flat():[]).flatMap(r=>r?.['@graph']??[r]);
 const article=records.filter(r=>r&&['Article','BlogPosting'].includes(r['@type']));
 const checks=article.map(r=>{
  const identity=r.mainEntityOfPage?.['@id']??r.mainEntityOfPage;
  const descriptions=(page.description??[]).map(clean);
  const description=clean(r.description);
  return {type:r['@type'],headlineMatch:clean(r.headline)===clean(page.title),urlMatch:normalizedUrl(r.url)===normalizedUrl(url),entityMatch:normalizedUrl(identity)===normalizedUrl(url),descriptionMatchesPublishedMetadata:Boolean(description)&&descriptions.some(d=>Boolean(d)&&(d===description||d.startsWith(description)||description.startsWith(d))),datesOrdered:Number.isFinite(Date.parse(r.datePublished))&&Number.isFinite(Date.parse(r.dateModified))&&Date.parse(r.datePublished)<=Date.parse(r.dateModified)};
 });
 const errors=checks.flatMap((c,i)=>Object.entries(c).filter(([key,value])=>key!=='type'&&!value).map(([key])=>`${i+1}:${key}`));
 const contentPresent=Boolean(checkpoint.pages[url]?.articleFound);
 return {url,title:clean(page.title),snapshotAt:page.checkedAt,articleCount:article.length,contentPresent,checks,status:!article.length||!contentPresent?'확인 불가':errors.length?'REVIEW':'PASS',issues:errors};
});
const summary={pages:rows.length,records:rows.reduce((n,r)=>n+r.articleCount,0),pass:rows.filter(r=>r.status==='PASS').length,review:rows.filter(r=>r.status==='REVIEW').length,unverifiable:rows.filter(r=>r.status==='확인 불가').length,multiple:rows.filter(r=>r.articleCount>1).length,limitations:['Saved metadata only: medical truth, author identity, original publication dates and image rights are not established.','Description comparison checks published metadata consistency, not full body factual accuracy.','Duplicate records do not establish their DOM location or current live duplication.']};
await fs.writeFile('../evidence/health-growth-resume-parallel-20261010/content-quality/schema-meaning-356.json',JSON.stringify({summary,rows},null,2)+'\n');
console.log(JSON.stringify(summary));
console.log(JSON.stringify(rows.filter(r=>r.status!=='PASS').map(({url,issues,status})=>({url,issues,status}))));
