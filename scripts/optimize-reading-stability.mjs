import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Apply only to the private operational backup, never a redacted review copy.
export function optimizeReadingStability(source, css, header = '') {
  if (source.includes('REDACTED')) throw new Error('Redacted skin is not deployable');
  if (source.includes('id="nh-reading-stability-20261010"')) return source;
  const blocks = ['nh-reader-tools-script', 'nh-reading-layout-20261009'].map(id => {
    const matches = [...source.matchAll(new RegExp(`<script id="${id}">[\\s\\S]*?<\\/script>`, 'g'))];
    if (matches.length !== 1) throw new Error(`Expected one ${id}`);
    return matches[0][0];
  });
  const anchor = '[##_article_rep_desc_##]';
  if (source.split(anchor).length !== 2) throw new Error('Expected one article body anchor');
  for (const block of blocks) source = source.replace(block, '');
  blocks[0] = blocks[0].replace(/if \(document.readyState === 'loading'\) document.addEventListener\('DOMContentLoaded', init\);\s*else init\(\);/, 'init();');
  blocks[0] = blocks[0].replace("image.decoding = 'async'; image.loading = i === 0 ? 'eager' : 'lazy';", "image.decoding = 'async'; image.loading = i === 0 ? 'eager' : 'lazy'; if(i===0)image.fetchPriority='high';");
  blocks[1] = blocks[1].replace("if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance);else enhance();", 'enhance();');
  source = source.replace(anchor, () => anchor + '\n' + blocks.join('\n'));
  source = source.replace('duplicateCheckButton.addEventListener("click",togglePopup);closeButton.addEventListener("click",hidePopup);', 'duplicateCheckButton?.addEventListener("click",togglePopup);closeButton?.addEventListener("click",hidePopup);');
  if (header) {
    const title = '<h1 class="hd-heading">[##_article_rep_title_##]</h1>';
    if (source.split(title).length !== 2) throw new Error('Expected one article title');
    source = source.replace(title, () => title + '\n<script id="nh-reading-header-20261010">' + header.trim() + '</script>');
  }
  const marker = '<!-- SHARED PERFORMANCE R1 20261004 -->';
  if (!source.includes(marker)) throw new Error('Missing known performance marker');
  return source.replace(marker, () => marker + '\n<style id="nh-reading-stability-20261010">' + css.trim() + '</style>');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output || input === output) throw new Error('Usage: node optimize-reading-stability.mjs private-input separate-private-output');
  const css = await readFile(new URL('../skin/proposals/reading-stability-20261010.css', import.meta.url), 'utf8');
  const header = await readFile(new URL('../skin/proposals/reading-header-20261010.js', import.meta.url), 'utf8');
  await writeFile(output, optimizeReadingStability(await readFile(input, 'utf8'), css, header));
}
