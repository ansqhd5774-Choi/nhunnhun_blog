import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE = 'https://nhunnhun.tistory.com';
export function locations(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map(m => m[1].trim().replaceAll('&amp;', '&'));
}
export function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)].map(m => [m[1].toLowerCase(), m[3]]));
}
export function inspect(html, url) {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => attributes(m[0]));
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(m => attributes(m[0]));
  const canonical = links.filter(a => a.rel?.toLowerCase() === 'canonical').map(a => a.href);
  const description = metas.filter(a => a.name?.toLowerCase() === 'description').map(a => a.content);
  const internal = [...html.matchAll(/<a\b[^>]*>/gi)].flatMap(m => {
    try {
      const target = new URL(attributes(m[0]).href, url);
      if (target.origin !== BASE || target.pathname.startsWith('/manage')) return [];
      target.hash = ''; return [target.href];
    } catch { return []; }
  });
  const jsonLd = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(m => attributes(m[1]).type === 'application/ld+json')
    .map(m => { try { return { validJson: true, value: JSON.parse(m[2]) }; } catch { return { validJson: false }; } });
  return {
    title: /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? null,
    canonical, description,
    noindex: metas.some(a => /^(robots|googlebot)$/i.test(a.name ?? '') && /\bnoindex\b/i.test(a.content ?? '')),
    og: Object.fromEntries(metas.filter(a => a.property?.startsWith('og:')).map(a => [a.property, a.content])),
    internal: [...new Set(internal)], jsonLd,
    // Raw HTML observation only: does not certify Google rendering, indexability or medical correctness.
    rawBodyPresent: /(?:contents_style|article-body|tt_article_useless_p_margin)/.test(html),
    images: [...html.matchAll(/<img\b[^>]*>/gi)].map(m => attributes(m[0])).map(a => ({ altPresent: Boolean(a.alt?.trim()), dimensionPresent: Boolean(a.width && a.height), lazy: a.loading === 'lazy' })),
  };
}

export async function audit(outDir, limit = 0) {
  await fs.mkdir(outDir, { recursive: true });
  const checkpoint = path.join(outDir, 'pages.json');
  let cache = {}; try { cache = JSON.parse(await fs.readFile(checkpoint, 'utf8')); } catch {}
  async function read(url) {
    if (cache[url]) return cache[url];
    let row;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'NH-Health-ReadOnly-Audit/1.0' } });
      const body = await res.text();
      row = { url, finalUrl: res.url, status: res.status, checkedAt: new Date().toISOString(), xRobots: res.headers.get('x-robots-tag'), contentType: res.headers.get('content-type'), ...inspect(body, res.url) };
      if (url.endsWith('/sitemap.xml') || url.endsWith('/robots.txt')) row.controlText = body;
    } catch (err) { row = { url, error: err.name, checkedAt: new Date().toISOString() }; }
    cache[url] = row;
    await fs.writeFile(checkpoint, JSON.stringify(cache, null, 2));
    await new Promise(r => setTimeout(r, 250));
    return row;
  }
  const sitemap = await read(BASE + '/sitemap.xml');
  await read(BASE + '/robots.txt');
  const listed = locations(sitemap.controlText ?? '');
  const unique = [...new Set(listed)];
  const targets = unique.filter(u => /^https:\/\/nhunnhun\.tistory\.com\/\d+$/.test(u));
  const selected = limit ? targets.slice(0, limit) : targets;
  const home = await read(BASE + '/');
  // Navigation traversal is bounded; incomplete traversal never certifies no orphan pages.
  const queue = [BASE + '/', ...home.internal.filter(u => /\/(?:category|\?page=)/.test(u))];
  const visited = new Set();
  while (queue.length && visited.size < 500) {
    const url = queue.shift(); if (visited.has(url)) continue;
    visited.add(url); const row = await read(url);
    for (const link of row.internal ?? []) {
      const u = new URL(link);
      if ((u.pathname.startsWith('/category') || (u.pathname === '/' && u.searchParams.has('page'))) && !visited.has(link) && !queue.includes(link)) queue.push(link);
    }
  }
  for (const [i, url] of selected.entries()) {
    await read(url); if (i % 25 === 0) console.log(`Progress ${i + 1}/${selected.length}`);
  }
  const rows = selected.map(u => cache[u]);
  const linked = new Set([...visited].flatMap(u => cache[u]?.internal ?? []));
  const ledgers = [];
  for (const dir of ['publishing/state', 'publishing/update-state']) {
    for (const file of await fs.readdir(dir)) {
      if (!file.endsWith('.json')) continue;
      try { const l = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8')); if (l.publicResult?.status === 'PUBLIC_VERIFIED' && l.url) ledgers.push(l.url); } catch {}
    }
  }
  const result = {
    checkedAt: new Date().toISOString(), mode: 'read-only-raw-http',
    sitemap: { status: sitemap.status, entries: listed.length, numericPages: targets.length, duplicates: listed.filter((u, i) => listed.indexOf(u) !== i), knownVerifiedLedgerMissing: [...new Set(ledgers)].filter(u => !unique.includes(u)) },
    traversal: { pages: visited.size, complete: queue.length === 0, candidatesNotLinkedFromTraversal: targets.filter(u => !linked.has(u)) },
    inspected: rows.length, inspectionComplete: rows.length === targets.length,
    issues: rows.filter(r => r.error || r.status !== 200 || r.noindex || /noindex/i.test(r.xRobots ?? '') || r.canonical?.length !== 1 || r.canonical?.[0] !== r.url || r.description?.length !== 1 || !r.title || r.jsonLd?.some(j => !j.validJson)),
    limits: ['Sitemap is not an independent full public-post inventory.', 'Traversal candidate is not proven orphan.', 'JSON parse success is not rich-result validation.', 'HTTP body is not rendered Googlebot evidence.', 'No indexing or medical verification performed.'],
  };
  await fs.writeFile(path.join(outDir, 'summary.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ inspected: result.inspected, sitemapPages: targets.length, issues: result.issues.length, traversal: result.traversal.pages, complete: result.inspectionComplete }));
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await audit(process.argv[2] ?? 'evidence/search-foundation', Number(process.argv[3] ?? 0));
}
