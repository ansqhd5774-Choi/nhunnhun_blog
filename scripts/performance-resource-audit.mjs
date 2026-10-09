import { Parser } from 'htmlparser2';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const BASE = 'https://nhunnhun.tistory.com';
export function inspectPerformanceResources(html, url) {
  const links = [], scripts = [], images = [], stack = [];
  const publicResource = href => { try { const u = new URL(href, url); return u.origin + u.pathname; } catch { return null; } };
  const parser = new Parser({
    onopentag(name, a) {
      const inArticle = stack.some(x => x.article) || /(?:^|\s)(?:article-body|contents_style)(?:\s|$)/.test(a.class ?? '');
      if (name === 'link') links.push(a);
      if (name === 'script' && a.src) scripts.push({ src: a.src, async: 'async' in a, defer: 'defer' in a, type: a.type ?? '' });
      if (name === 'img' && inArticle) images.push({ src: publicResource(a.src ?? ''), width: a.width ?? null, height: a.height ?? null, loading: a.loading ?? null, fetchpriority: a.fetchpriority ?? null, srcset: Boolean(a.srcset), alt: Boolean(a.alt?.trim()) });
      stack.push({ name, article: inArticle });
    },
    onclosetag(name) { const i = stack.findLastIndex(x => x.name === name); if (i >= 0) stack.splice(i); },
  }, { decodeEntities: true });
  parser.write(html); parser.end();
  const origin = href => { try { return new URL(href, url).origin; } catch { return null; } };
  const preconnects = links.filter(x => /(?:^|\s)preconnect(?:\s|$)/i.test(x.rel ?? '')).map(x => origin(x.href)).filter(Boolean);
  const asyncStyle = x => /^(print|not all)$/i.test(x.media ?? '') && /this\.media/.test(x.onload ?? '');
  const blockingStyles = links.filter(x => /(?:^|\s)stylesheet(?:\s|$)/i.test(x.rel ?? '') && !/^(print|not all)$/i.test(x.media ?? '')).map(x => ({ origin: origin(x.href), href: publicResource(x.href) }));
  const asynchronousStyles = links.filter(x => /(?:^|\s)stylesheet(?:\s|$)/i.test(x.rel ?? '') && asyncStyle(x)).map(x => ({ origin: origin(x.href), href: publicResource(x.href) }));
  return {
    mode: 'raw-http-resource-observation', url,
    fieldVitals: 'NOT_MEASURED', laboratoryVitals: 'NOT_MEASURED', accessibility: 'RENDERED_AUDIT_REQUIRED',
    preconnects: { total: preconnects.length, uniqueOrigins: [...new Set(preconnects)], duplicateOrigins: [...new Set(preconnects.filter((x, i) => preconnects.indexOf(x) !== i))] },
    blockingStyles,
    asynchronousStyles,
    blockingScriptOrigins: [...new Set(scripts.filter(x => !x.async && !x.defer && x.type !== 'module').map(x => origin(x.src)).filter(Boolean))],
    articleImages: images,
    firstArticleImage: images[0] ?? null,
    warnings: [
      ...(preconnects.length > 4 ? ['PRECONNECT_REQUIRES_RESOURCE_TIMING_REVIEW'] : []),
      ...(images[0]?.loading === 'lazy' ? ['FIRST_ARTICLE_IMAGE_LAZY_RAW_HTML'] : []),
      ...(images.some(x => !x.width || !x.height) ? ['IMAGE_DIMENSIONS_MISSING_RAW_HTML'] : []),
    ],
    limitations: ['JavaScript can change image properties after parsing.', 'The first article image is a candidate, not a measured LCP element.', 'Advertising resources are observed; this tool never alters them.'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [out, ...ids] = process.argv.slice(2);
  if (!out || !ids.length || ids.some(x => !/^\d+$/.test(x)) || ids.length > 10) throw new Error('Usage: node performance-resource-audit.mjs OUTPUT.json ARTICLE_ID [ARTICLE_ID ...] (maximum 10)');
  const rows = await Promise.all(ids.map(async id => {
    const url = BASE + '/' + id;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      const html = await response.text();
      return { checkedAt: new Date().toISOString(), status: response.status, finalUrl: response.url, ...inspectPerformanceResources(html, url) };
    } catch (error) { return { checkedAt: new Date().toISOString(), url, error: error.name, status: 'HTTP_UNAVAILABLE' }; }
  }));
  await writeFile(out, JSON.stringify({ rows }, null, 2));
  console.log(JSON.stringify(rows.map(x => ({ url: x.url, status: x.status, warnings: x.warnings, images: x.articleImages?.length })), null, 2));
}
