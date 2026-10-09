import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Read-only observations from the existing HTTP checkpoint, never a publish gate.
export function summarizeSchemaDates(pages) {
  return Object.values(pages).map(page => {
    const records = (page.jsonLd ?? []).flatMap(item => {
      if (!item.validJson) return [];
      const value = item.value;
      return Array.isArray(value) ? value : value?.['@graph'] ?? [value];
    });
    const articles = records.filter(item => [item?.['@type']].flat().some(type => ['Article','BlogPosting','NewsArticle'].includes(type)));
    const issues = [];
    if (!articles.length) issues.push('ARTICLE_SCHEMA_MISSING');
    for (const article of articles) {
      const articleUrl = article.url ?? article.mainEntityOfPage?.['@id'];
      if (articleUrl !== page.url) issues.push('SCHEMA_URL_MISMATCH');
      if (!article.headline?.trim()) issues.push('SCHEMA_HEADLINE_MISSING');
      const published = Date.parse(article.datePublished);
      const modified = Date.parse(article.dateModified);
      if (!Number.isFinite(published)) issues.push('PUBLISHED_DATE_MISSING_OR_INVALID');
      if (!Number.isFinite(modified)) issues.push('MODIFIED_DATE_MISSING_OR_INVALID');
      if (Number.isFinite(published) && Number.isFinite(modified) && modified < published) issues.push('MODIFIED_BEFORE_PUBLISHED');
      if (/&(?:[a-z]+|#\d+|#x[0-9a-f]+);/i.test(article.headline ?? '')) issues.push('HEADLINE_CONTAINS_HTML_ENTITY');
    }
    return {url:page.url, observedAt:page.checkedAt ?? null, articleSchemaCount:articles.length,
      dates:articles.map(a => ({published:a.datePublished ?? null,modified:a.dateModified ?? null})),
      issues:[...new Set(issues)], semanticReview:'NOT_PERFORMED',officialValidation:'NOT_PERFORMED'};
  });
}
if(process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const pages = JSON.parse(await fs.readFile(process.argv[2],'utf8'));
  const rows = summarizeSchemaDates(pages);
  const counts = {};
  for(const row of rows) for(const issue of row.issues) counts[issue] = (counts[issue] ?? 0) + 1;
  const result = {analyzedAt:new Date().toISOString(),pages:rows.length,issueCounts:counts,rows,
    limitations:['Stored HTTP metadata observations only. Dates are provider metadata, not source-check dates or independently verified revision dates. No full schema, editorial or search-engine certification.']};
  await fs.writeFile(process.argv[3],JSON.stringify(result,null,2));
  console.log(JSON.stringify({pages:rows.length,issueCounts:counts}));
}
