import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentDigest, todayInSeoul } from '../publishing/content-standards.mjs';

const validDay = (day, today) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? '')) return false;
  const value = new Date(day + 'T00:00:00Z');
  return Number.isFinite(value.getTime()) && value.toISOString().slice(0,10) === day && day <= today;
};
export function recordedSourceDates(source, manifest, today = todayInSeoul()) {
  if (!manifest || manifest.version !== 'R1' || manifest.sourceDigest !== contentDigest(source) || manifest.review?.status !== 'approved' || !validDay(manifest.review.checkedAt,today)) {
    return {sourceCheckedAt:null,nextReviewAt:null,status:'NEEDS_SOURCE_DATE_REVIEW',sourceDateRecords:[]};
  }
  const linked = new Set([...String(source.bodyHtml ?? '').matchAll(/href\s*=\s*["'](https?:\/\/[^"']+)["']/gi)].map(m=>m[1].replaceAll('&amp;','&')));
  const entries = (Array.isArray(manifest.sources) ? manifest.sources : []).filter(s=>linked.has(s.url));
  const records = entries.map(s=>{
    const checkedAt = validDay(s.checkedAt,today) && s.checkedAt <= manifest.review.checkedAt ? s.checkedAt : null;
    const interval = ['safety','authorization'].includes(s.role) || s.kind === 'guideline' ? 30 : s.role === 'nutrition' ? 365 : 90;
    const nextReviewAt = checkedAt ? new Date(Date.parse(checkedAt+'T00:00:00Z')+interval*86400000).toISOString().slice(0,10) : null;
    return {url:s.url,checkedAt,nextReviewAt,intervalDays:interval,basis:'matching R1 review record; not newly verified'};
  });
  const complete = records.length > 0 && records.every(r=>r.checkedAt);
  return {
    sourceCheckedAt:complete ? records.map(r=>r.checkedAt).sort()[0] : null,
    nextReviewAt:complete ? records.map(r=>r.nextReviewAt).sort()[0] : null,
    status:complete ? 'RECORDED_SOURCE_DATES' : 'NEEDS_SOURCE_DATE_REVIEW',sourceDateRecords:records,
    sourceDateNote:'Dates come from a digest-matching approved review. Publication date is separate. Schedules follow the existing 30/90/365-day policy; no fresh source review or independent medical review was performed.'
  };
}

export async function buildReviewRegister(root, out) {
await fs.mkdir(out, { recursive: true });
const rows = [];
for (const folder of ['posts', 'updates']) {
  for (const name of await fs.readdir(path.join(root,folder))) {
    if (!name.endsWith('.json')) continue;
    const source = JSON.parse(await fs.readFile(path.join(root,folder, name), 'utf8'));
    const ledgerFolder = folder === 'posts' ? 'publishing/state' : 'publishing/update-state';
    let ledger = {}; try { ledger = JSON.parse(await fs.readFile(path.join(root,ledgerFolder, name), 'utf8')); } catch {}
    let manifest; try { manifest=JSON.parse(await fs.readFile(path.join(root,'content-reviews',folder,name),'utf8')); } catch {}
    const html = source.bodyHtml ?? '';
    const links = [...html.matchAll(/href\s*=\s*["'](https?:\/\/[^"']+)["']/gi)].map(m => m[1].replaceAll('&amp;', '&'));
    const external = [...new Set(links.filter(u => !u.startsWith('https://nhunnhun.tistory.com/')))];
    rows.push({ sourceId: source.id, category: source.category, title: source.title, sourceFile: folder + '/' + name,
      publicUrl: ledger.url ?? null, publicVerification: ledger.publicResult?.status ?? 'UNKNOWN',
      lastPublicationEvidence: ledger.timestamp ?? null, ...recordedSourceDates(source,manifest), externalLinkCandidates: external,
      note: 'Links are candidates, not validated claim references. Publication time is not source verification time.' });
  }
}
await fs.writeFile(path.join(out, 'review-register.json'), JSON.stringify(rows, null, 2));
console.log(JSON.stringify({ sources: rows.length, verifiedPublicationRecords: rows.filter(r => r.publicVerification === 'PUBLIC_VERIFIED').length, recordedDateSources:rows.filter(r=>r.status==='RECORDED_SOURCE_DATES').length, unknownDateSources:rows.filter(r=>r.status==='NEEDS_SOURCE_DATE_REVIEW').length, sourceDates:'matching review records only; no fresh verification' }));
return rows;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await buildReviewRegister(process.cwd(),process.argv[2] ?? 'evidence/review-register');
