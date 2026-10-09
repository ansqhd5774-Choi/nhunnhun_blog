import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Run only against a fresh administrator skin backup. Never against rendered HTML.
export function normalizeSkinHead(source) {
  if (/REDACTED/.test(source)) throw new Error('E_REDACTED_SOURCE');
  if ((source.match(/<head\b[^>]*>/gi) ?? []).length !== 1 ||
      (source.match(/<\/head\s*>/gi) ?? []).length !== 1) throw new Error('E_HEAD_STRUCTURE');
  const html = /<html\b[^>]*>/i.exec(source);
  const head = /<head\b[^>]*>/i.exec(source);
  if (!html || html.index >= head.index || /<body\b/i.test(source.slice(0, head.index))) throw new Error('E_HEAD_ORDER');
  const verification = [...source.matchAll(/<meta\b[^>]*name=["']msvalidate\.01["'][^>]*>/gi)];
  if (verification.length !== 1) throw new Error('E_VERIFICATION_TAG_COUNT');
  const tag = verification[0][0];
  if (source.slice(html.index + html[0].length, head.index).trim() === '' &&
      source.slice(head.index + head[0].length, verification[0].index).trim() === '') return source;
  let output = source.replace(head[0], '').replace(tag, '');
  output = output.replace(html[0], `${html[0]}\n${head[0]}\n${tag}`);
  return output;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await fs.writeFile(process.argv[3], normalizeSkinHead(await fs.readFile(process.argv[2], 'utf8')));
  console.log('PASS: head opening and existing verification tag moved; remaining skin content preserved.');
}
