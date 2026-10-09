import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function initializeCompactToc(source) {
  if (source.includes('REDACTED')) throw new Error('REDACTED_SKIN_NOT_DEPLOYABLE');
  const id = 'nh-reader-tools-script';
  const blocks = [...source.matchAll(new RegExp(`<script id="${id}">[\\s\\S]*?<\\/script>`, 'g'))];
  if (blocks.length !== 1) throw new Error('EXPECTED_ONE_READER_SCRIPT');
  const before = "link.textContent = heading.closest('.nh-direct-v2') ? heading.textContent.trim().replace(/^\\d{2}(?!\\d)\\s*/, '') : heading.textContent.trim();";
  const after = "const fullTitle = heading.closest('.nh-direct-v2') ? heading.textContent.trim().replace(/^\\d{2}(?!\\d)\\s*/, '') : heading.textContent.trim();\n      link.dataset.fullTitle = fullTitle; link.title = fullTitle;\n      link.textContent = fullTitle.split('｜')[0].replace(/^\\s*\\d+[.\\s]+/, '').trim();";
  if (blocks[0][0].includes(after)) return source;
  if (blocks[0][0].split(before).length !== 2) throw new Error('EXPECTED_ORIGINAL_TOC_LABEL_CONTRACT');
  return source.replace(blocks[0][0], blocks[0][0].replace(before, after));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output || input === output) throw new Error('Usage: performance-toc-candidate.mjs PRIVATE_INPUT SEPARATE_PRIVATE_OUTPUT');
  await writeFile(output, initializeCompactToc(await readFile(input, 'utf8')));
  console.log('CANDIDATE_ONLY_NOT_DEPLOYED');
}
