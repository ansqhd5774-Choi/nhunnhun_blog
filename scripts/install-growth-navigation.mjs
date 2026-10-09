import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export function installGrowthNavigation(source, script) {
  if (/REDACTED/.test(source)) throw new Error('E_REDACTED_SOURCE');
  if (!source.includes('</body>') || !source.includes('Copyright')) throw new Error('E_SKIN_TARGET');
  if (source.includes('id="nh-growth-navigation"')) throw new Error('E_ALREADY_INSTALLED');
  const footer='<nav id="nh-editorial-policy" aria-label="운영 안내" style="text-align:center;padding:16px"><a href="/pages/about">한입 건강 소개·편집 원칙·오류 신고</a></nav>';
  return source.replace('</body>',`${footer}\n<script id="nh-growth-navigation">${script}</script>\n</body>`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const source=await fs.readFile(process.argv[2],'utf8');
  const script=await fs.readFile('skin/proposals/growth-navigation-20261010.js','utf8');
  await fs.writeFile(process.argv[3],installGrowthNavigation(source,script));
  console.log('PASS: category guide and policy link added; no article or analytics mutation.');
}
