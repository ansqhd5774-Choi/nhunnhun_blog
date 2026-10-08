import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {checkUpdateSource} from '../publishing/update-core.mjs';
import {renderDirectArticle} from '../publishing/direct-design.mjs';
import {observeEmphasis} from './emphasis-summary.mjs';

// A single local preparation view; no AI, network, content gate or publication.
export function prepareDirectSource(source) {
  checkUpdateSource(source,source.id+'.json');
  const observation=observeEmphasis(source.bodyHtml);
  return {
    report:{sourceId:source.id,...observation},
    preview:'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>원고 디자인 확인</title></head><body>'+renderDirectArticle(source.bodyHtml)+'</body></html>'
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const source=JSON.parse(readFileSync(process.argv[2],'utf8'));
  const prepared=prepareDirectSource(source);
  const output=resolve('evidence','direct-preparation',source.id);
  mkdirSync(output,{recursive:true});
  writeFileSync(join(output,'preview.html'),prepared.preview);
  writeFileSync(join(output,'emphasis.json'),JSON.stringify(prepared.report,null,2)+'\n');
  console.log(JSON.stringify({preview:join(output,'preview.html'),...prepared.report},null,2));
}
