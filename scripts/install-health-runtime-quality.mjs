import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function installRuntimeQuality(skin, script, css) {
  if (/REDACTED/.test(skin) || (skin.match(/<\/body>/gi) ?? []).length !== 1 || (skin.match(/<\/head>/gi) ?? []).length !== 1) throw new Error('E_LIVE_SOURCE_REQUIRED');
  if (skin.includes('id="nh-runtime-quality-20261010"')) throw new Error('E_ALREADY_INSTALLED');
  if (/<\/script/i.test(script) || /<\/style/i.test(css)) throw new Error('E_SCRIPT_STYLE_BOUNDARY');
  return skin.replace(/<\/head>/i, `<style id="nh-focus-quality-20261010">\n${css}\n</style>\n</head>`)
    .replace(/<\/body>/i, `<script id="nh-runtime-quality-20261010">\n${script}\n</script>\n</body>`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [source, destination] = process.argv.slice(2);
  if (!source || !destination || path.resolve(source) === path.resolve(destination)) throw new Error('E_DISTINCT_SOURCE_DEST_REQUIRED');
  const output = installRuntimeQuality(await fs.readFile(source, 'utf8'), await fs.readFile('skin/proposals/health-runtime-quality-20261010.js','utf8'), await fs.readFile('skin/proposals/health-focus-20261010.css','utf8'));
  await fs.writeFile(destination, output);
  console.log('Prepared existing-skin metadata/profile/focus repair; no live deployment performed.');
}
