import fs from 'node:fs/promises';
import path from 'node:path';
const out = process.argv[2] ?? 'evidence/review-register';
await fs.mkdir(out, { recursive: true });
const rows = [];
for (const folder of ['posts', 'updates']) {
  for (const name of await fs.readdir(folder)) {
    if (!name.endsWith('.json')) continue;
    const source = JSON.parse(await fs.readFile(path.join(folder, name), 'utf8'));
    const ledgerFolder = folder === 'posts' ? 'publishing/state' : 'publishing/update-state';
    let ledger = {}; try { ledger = JSON.parse(await fs.readFile(path.join(ledgerFolder, name), 'utf8')); } catch {}
    const html = source.bodyHtml ?? '';
    const links = [...html.matchAll(/href\s*=\s*["'](https?:\/\/[^"']+)["']/gi)].map(m => m[1].replaceAll('&amp;', '&'));
    const external = [...new Set(links.filter(u => !u.startsWith('https://nhunnhun.tistory.com/')))];
    rows.push({ sourceId: source.id, category: source.category, title: source.title, sourceFile: folder + '/' + name,
      publicUrl: ledger.url ?? null, publicVerification: ledger.publicResult?.status ?? 'UNKNOWN',
      lastPublicationEvidence: ledger.timestamp ?? null, sourceCheckedAt: null, nextReviewAt: null,
      status: 'NEEDS_SOURCE_DATE_REVIEW', externalLinkCandidates: external,
      note: 'Links are candidates, not validated claim references. Publication time is not source verification time.' });
  }
}
await fs.writeFile(path.join(out, 'review-register.json'), JSON.stringify(rows, null, 2));
console.log(JSON.stringify({ sources: rows.length, verifiedPublicationRecords: rows.filter(r => r.publicVerification === 'PUBLIC_VERIFIED').length, sourceDates: 'UNKNOWN; not inferred' }));
