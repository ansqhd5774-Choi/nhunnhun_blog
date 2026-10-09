import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export async function auditOgAssets(input,output) {
  const pages=Object.values(JSON.parse(await fs.readFile(input,'utf8')));
  const images=[...new Set(pages.map(p=>p.og?.['og:image']).filter(Boolean))];
  const results=[];let cursor=0;
  async function worker() {
    while(cursor<images.length) {
      const address=images[cursor++];
      const key=crypto.createHash('sha256').update(address).digest('hex');
      try {
        const response=await fetch(address,{signal:AbortSignal.timeout(12000)});
        await response.body?.cancel();
        results.push({key,status:response.status,isImage:/^image\//i.test(response.headers.get('content-type')??'')});
      } catch {results.push({key,status:null,isImage:null});}
      await new Promise(resolve=>setTimeout(resolve,200));
    }
  }
  await Promise.all([worker(),worker(),worker()]);
  const summary={checkedAt:new Date().toISOString(),metadataSnapshotCount:pages.length,
    siteNameMismatch:pages.filter(p=>p.og?.['og:site_name']!=='한입 건강').map(p=>p.url),
    urlMismatch:pages.filter(p=>p.og?.['og:url']!==p.url).map(p=>p.url),
    missingTitleOrDescription:pages.filter(p=>!p.og?.['og:title']||!p.og?.['og:description']).map(p=>p.url),
    missingImage:pages.filter(p=>!p.og?.['og:image']).map(p=>p.url),
    uniqueImages:images.length,accessibleImages:results.filter(r=>r.status===200&&r.isImage).length,
    imageIssues:results.filter(r=>r.status!==200||!r.isImage).map(result=>({...result,
      affectedArticles:pages.filter(p=>p.og?.['og:image']&&crypto.createHash('sha256').update(p.og['og:image']).digest('hex')===result.key).map(p=>p.url)})),
    limits:['HTTP asset availability only; visual relevance, decoding and license are not certified. Metadata retains its own observation dates.']};
  await fs.writeFile(output,JSON.stringify(summary,null,2));
  console.log(JSON.stringify({...summary,imageIssues:summary.imageIssues.length}));
  return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) await auditOgAssets(process.argv[2],process.argv[3]);
