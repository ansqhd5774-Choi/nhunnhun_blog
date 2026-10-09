import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { locations } from './audit-search-foundation.mjs';

const article = /^https:\/\/nhunnhun\.tistory\.com\/\d+$/;
export function compareInventory(rows, sitemapUrls) {
  const urls = rows.map(row => row.url);
  if (urls.some(url => !article.test(url))) throw new Error('E_NON_ARTICLE_ADMIN_URL');
  const admin = new Set(urls);
  const articleUrls = sitemapUrls.filter(url => article.test(url));
  const sitemap = new Set(articleUrls);
  return {
    adminCount: admin.size, sitemapCount: sitemap.size,
    adminDuplicates: urls.filter((url, index) => urls.indexOf(url) !== index),
    sitemapDuplicates: articleUrls.filter((url, index) => articleUrls.indexOf(url) !== index),
    missingFromSitemap: [...admin].filter(url => !sitemap.has(url)),
    absentFromAdmin: [...sitemap].filter(url => !admin.has(url)),
  };
}
export async function run(adminPath, outPath) {
  const inventory = JSON.parse(await fs.readFile(adminPath, 'utf8'));
  const response = await fetch('https://nhunnhun.tistory.com/sitemap.xml', {signal: AbortSignal.timeout(20000)});
  if (!response.ok) throw new Error(`E_SITEMAP_HTTP_${response.status}`);
  const result = {adminCheckedAt: inventory.checkedAt, sitemapCheckedAt: new Date().toISOString(), pages: inventory.pages,
    ...compareInventory(inventory.rows, locations(await response.text())),
    limits: ['Only the supplied independently collected public admin pages are compared.', 'No search indexing or publication state is inferred.']};
  await fs.writeFile(outPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await run(process.argv[2], process.argv[3]);
}
