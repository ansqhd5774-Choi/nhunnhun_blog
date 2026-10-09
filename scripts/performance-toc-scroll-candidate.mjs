import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
export function repairTocScroll(source) {
  if (source.includes('REDACTED')) throw new Error('REDACTED_SKIN_NOT_DEPLOYABLE');
  const blocks = [...source.matchAll(/<script id="nh-reader-tools-script">[\s\S]*?<\/script>/g)];
  if (blocks.length !== 1) throw new Error('EXPECTED_ONE_READER_SCRIPT');
  const before = "heading.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});\n        if (innerWidth < 768) details.open = false;";
  const after = "const scrollToHeading = () => heading.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});\n        if (innerWidth < 768) { details.open = false; requestAnimationFrame(scrollToHeading); }\n        else scrollToHeading();";
  const lineEnding = blocks[0][0].includes('\r\n') ? '\r\n' : '\n';
  const expected = before.replaceAll('\n',lineEnding), replacement = after.replaceAll('\n',lineEnding);
  if (blocks[0][0].includes(replacement)) return source;
  if (blocks[0][0].split(expected).length !== 2) throw new Error('EXPECTED_ORIGINAL_SCROLL_CONTRACT');
  return source.replace(blocks[0][0],blocks[0][0].replace(expected,replacement));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input,output] = process.argv.slice(2);
  if (!input || !output || input === output) throw new Error('SEPARATE_PRIVATE_OUTPUT_REQUIRED');
  await writeFile(output,repairTocScroll(await readFile(input,'utf8')));
  console.log('SCROLL_CANDIDATE_ONLY_NOT_DEPLOYED');
}
