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
    report:{sourceId:source.id,...observation,pairingReview:pairingReview(source.bodyHtml,source.category),
      editorialReview:{status:'AUTHOR_REVIEW_REQUIRED',automatedSemanticVerdict:false,questions:[
        '분야에 맞는 건강·영양 중심 제목인가? 제목이 약속한 중심 질문에 직접 답하는가?',
        '제목·소제목이 본문의 중심 답과 비중에 맞는가?',
        '소개·역할·효과·활용은 확인된 도움을 먼저 설명하고 불필요한 반박을 반복하지 않는가?',
        '흡수·상호작용·효과 크기의 구체적인 주장에 해당 원문 출처를 연결했는가?',
        '수치 설명은 모으고 FAQ·요약을 제외한 불필요한 반복을 줄였는가?',
        '분야별 섭취·복용·생활 관리에 필요한 행동·양·시간·조건과 실제 안전 경고를 명확하게 표시했는가?'
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
