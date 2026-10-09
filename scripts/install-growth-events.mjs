import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export function installGrowthEvents(skin,script) {
  if (!/<\/body>/i.test(skin) || /REDACTED/.test(skin)) throw new Error('E_LIVE_SOURCE_REQUIRED');
  if (skin.includes('id="nh-growth-events-20261010"')) throw new Error('E_ALREADY_INSTALLED');
  if (/<\/script/i.test(script)) throw new Error('E_SCRIPT_BOUNDARY');
  return skin.replace(/<\/body>/i,`<script id="nh-growth-events-20261010">\n${script}\n</script>\n</body>`);
}

export function protectExistingAnalytics(skin) {
  if (/REDACTED/.test(skin)) throw new Error('E_LIVE_SOURCE_REQUIRED');
  if (skin.includes('/* nh-private-page-context */')) return skin;
  const pattern=/gtag\(\s*(['"])config\1\s*,\s*(['"])(?:GT|G|UA)-[A-Za-z0-9-]+\2\s*\);/g;
  const matches=[...skin.matchAll(pattern)];
  if(matches.length!==1) throw new Error('E_EXISTING_TAG_CONFIG_AMBIGUOUS');
  const options=`{ /* nh-private-page-context */
    page_location: location.origin + location.pathname,
    page_referrer: (() => { try { return document.referrer ? new URL(document.referrer).origin : ''; } catch { return ''; } })(),
    ...(new URLSearchParams(location.search).get('nh_analytics_debug') === '1' ? {debug_mode:true} : {})
  }`;
  return skin.replace(pattern,match=>match.slice(0,-2)+`, ${options});`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const protect=process.argv[2]==='--protect-existing';
  const [source,dest]=process.argv.slice(protect?3:2);
  if(!source||!dest||path.resolve(source)===path.resolve(dest)) throw new Error('E_DISTINCT_SOURCE_DEST_REQUIRED');
  const skin=await fs.readFile(source,'utf8');
  await fs.writeFile(dest,protect?protectExistingAnalytics(skin):installGrowthEvents(skin,await fs.readFile('skin/proposals/growth-events-20261010.js','utf8')));
  console.log('Prepared existing-skin event addition; no live deployment performed.');
}
