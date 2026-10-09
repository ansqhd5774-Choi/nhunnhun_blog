import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {checkUpdateSource} from '../publishing/update-core.mjs';
import {renderDirectArticle} from '../publishing/direct-design.mjs';
import {observeEmphasis} from './emphasis-summary.mjs';
import {pairingReview} from './pairing-review.mjs';
import {checkPost,checkPublishHtml} from '../publishing/core.mjs';

// A single local preparation view; no AI, network, content gate or publication.
export function prepareDirectSource(source) {
  if(source.articleId)checkUpdateSource(source,source.id+'.json');
  else {checkPost(source,source.id+'.json');checkPublishHtml(source);}
  const observation=observeEmphasis(source.bodyHtml);
  return {
    report:{sourceId:source.id,...observation,pairingReview:pairingReview(source.bodyHtml),
      editorialReview:{status:'AUTHOR_REVIEW_REQUIRED',automatedSemanticVerdict:false,questions:[
        '제목·소제목이 실제 본문에서 답하는 내용과 일치하는가?',
        '소개·효능·궁합은 장점을 먼저 설명하고 불필요한 반박을 반복하지 않는가?',
        '흡수·상호작용·효과 크기의 구체적인 주장에 해당 원문 출처를 연결했는가?',
        '수치 설명은 모으고 FAQ·요약을 제외한 불필요한 반복을 줄였는가?',
        '조리·보관 안내에 행동·시간·온도·조건을 명확하게 표시했는가?'
      ]}},
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
