import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseDocument, DomUtils } from 'htmlparser2';

const compact = value => DomUtils.textContent(parseDocument(String(value ?? ''))).replace(/\s+/g, ' ').trim();
const titlePromises = [
  ['칼로리', /칼로리|열량|kcal/i], ['단백질', /단백질/], ['보관', /보관/],
  ['주의', /주의|부작용|금기/], ['궁합', /궁합|조합|상호작용/], ['만들기', /만들|레시피|조리/],
  ['섭취량', /섭취량|몇\s*[g알개]|하루|분량/], ['효능', /효능|효과|역할|신체|연구/],
];

export function reviewPage(page, metadata) {
  const title = compact(page.title ?? metadata?.title);
  const headings = (page.headings ?? []).map(compact);
  const coverageCandidates = titlePromises.filter(([term]) => title.includes(term))
    .filter(([, pattern]) => !headings.some(heading => pattern.test(heading))).map(([term]) => term);
  const schemas = (metadata?.jsonLd ?? []).flatMap(record => {
    const value = record.value;
    if (!record.validJson || !value) return [];
    return Array.isArray(value) ? value : [value];
  }).flatMap(value => value['@graph'] ?? [value]);
  const articles = schemas.filter(value => [value['@type']].flat().some(type => ['Article', 'BlogPosting'].includes(type)));
  const schemaCandidates = articles.flatMap(value => {
    const issues = [];
    if (compact(value.headline) !== title) issues.push('HEADLINE_DIFFERS_FROM_SNAPSHOT_TITLE');
    const schemaUrl = value.url ?? value.mainEntityOfPage?.['@id'];
    if (schemaUrl && schemaUrl !== page.url) issues.push('ARTICLE_URL_DIFFERS');
    if (!value.description || !compact(value.description)) issues.push('DESCRIPTION_MISSING');
    return issues;
  });
  if (!articles.length) schemaCandidates.push('ARTICLE_SCHEMA_NOT_OBSERVED');
  const imageCreditReferences = (page.external ?? []).filter(reference =>
    /CC BY|public domain|퍼블릭 도메인|공개 도메인|저작자|저작권|라이선스/i.test(reference.label + ' ' + reference.context));
  return {
    url: page.url, title, snapshotCheckedAt: page.checkedAt ?? null,
    metadataCheckedAt: metadata?.checkedAt ?? null,
    titleHeadingCoverageCandidates: coverageCandidates,
    titleBodyMeaningReview: 'NOT_PERFORMED',
    schemaTechnicalCandidates: [...new Set(schemaCandidates)],
    schemaMeaningReview: 'NOT_PERFORMED',
    imageCount: page.images?.length ?? 0,
    missingAlt: (page.images ?? []).filter(image => !compact(image.alt)).map(image => ({key: image.key, host: image.host})),
    imageCreditReferenceCount: imageCreditReferences.length,
    imageCreditsObserved: imageCreditReferences.map(reference => ({url: reference.sourceUrl, label: compact(reference.label)})),
    imageLicenseMapping: 'NOT_PERFORMED', imageVisualRelevance: 'NOT_PERFORMED',
    // References are only candidates. A credit paragraph is not proof of an individual image's license.
    nextActions: [
      ...(coverageCandidates.length ? ['READ_BODY_FOR_TITLE_PROMISES'] : []),
      ...((page.images ?? []).some(image => !compact(image.alt)) ? ['VIEW_IMAGE_BEFORE_ALT_AUTHORING'] : []),
      ...((page.images ?? []).length ? ['MAP_EACH_IMAGE_TO_ORIGINAL_LICENSE_AND_VISUAL_REVIEW'] : []),
      'CHECK_SCHEMA_AGAINST_VISIBLE_ARTICLE',
    ],
  };
}

export async function runReview(evidenceDir, outputDir) {
  const state = JSON.parse(await fs.readFile(path.join(evidenceDir, 'health-evidence-checkpoint.json'), 'utf8'));
  const metadata = JSON.parse(await fs.readFile(path.join(evidenceDir, 'metadata-pages.json'), 'utf8'));
  const rows = Object.values(state.pages).map(page => reviewPage(page, metadata[page.url]));
  const summary = {
    analyzedAt: new Date().toISOString(), method: 'SAVED_HTTP_OBSERVATION_REANALYSIS',
    pages: rows.length, metadataPages: Object.keys(metadata).length,
    missingAltOccurrences: rows.reduce((sum, row) => sum + row.missingAlt.length, 0),
    pagesWithMissingAlt: rows.filter(row => row.missingAlt.length).length,
    pagesWithTitleCoverageCandidates: rows.filter(row => row.titleHeadingCoverageCandidates.length).length,
    pagesWithSchemaTechnicalCandidates: rows.filter(row => row.schemaTechnicalCandidates.length).length,
    pagesWithImages: rows.filter(row => row.imageCount).length,
    pagesWithoutObservedImageCredit: rows.filter(row => row.imageCount && !row.imageCreditReferenceCount).length,
    meaningReviewedPages: 0, visuallyReviewedImages: 0, individuallyLicenseVerifiedImages: 0,
    publicMutationPerformed: false,
    limits: ['Saved observation dates are retained; this is not a fresh crawl.',
      'Heading vocabulary absence is a review candidate, not title/body failure.',
      'HTTP metadata can differ from repaired browser JSON-LD; do not undo valid runtime evidence.',
      'Missing alt may be intentionally decorative; view the image before authoring.',
      'Credit presence is not license verification; no source or license was inferred.'],
  };
  await fs.mkdir(outputDir, {recursive:true});
  await fs.writeFile(path.join(outputDir, 'content-quality-review-register.json'), JSON.stringify({summary, rows}, null, 2));
  await fs.writeFile(path.join(outputDir, 'content-quality-review-summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await runReview(process.argv[2], process.argv[3]), null, 2));
}
