import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {checkUpdateSource} from '../publishing/update-core.mjs';
import {renderDirectArticle} from '../publishing/direct-design.mjs';
import {directFocusReview} from '../publishing/direct-focus.mjs';
import {observeEmphasis} from './emphasis-summary.mjs';
import {pairingReview} from './pairing-review.mjs';
import {checkPost,checkPublishHtml} from '../publishing/core.mjs';

// A single local preparation view; no AI, network or publication.
export function prepareDirectSource(source) {
  if(source.articleId)checkUpdateSource(source,source.id+'.json');
  else {checkPost(source,source.id+'.json');checkPublishHtml(source);}
  const observation=observeEmphasis(source.bodyHtml);
  const focusReview=directFocusReview(source.bodyHtml);
  return {
    report:{sourceId:source.id,...observation,focusReview,pairingReview:pairingReview(source.bodyHtml,source.category),
      editorialReview:{status:'AUTHOR_REVIEW_REQUIRED',automatedSemanticVerdict:false,questions:[
        '이 키워드를 검색한 독자가 가장 먼저 알고 싶은 핵심 질문을 6개 이내로 정리했는가?',
        '각 핵심 소제목이 독자의 질문 하나에 직접 답하며 세부 설명 때문에 별도 대주제를 불필요하게 만들지 않았는가?',
        '분야에 맞는 건강·영양 중심 제목인가? 제목이 약속한 중심 질문에 직접 답하는가?',
        '도입·소개·효과·활용은 확인된 특징·장점·도움을 먼저 충분히 설명하고 있는가?',
        '연구 설계·표본·통계·전문 기전은 독자의 선택·섭취·복용·진료 행동에 필요한 범위만 남겼는가?',
        '도입·효능·궁합·FAQ·핵심 정리에서 독자가 주장하지 않은 치료·예방 효과나 근거 한계를 반복하지 않았는가?',
        '강한 강조(mark+strong, mark+u+strong)는 부정·반박보다 핵심 장점·작용·수치·실천 기준을 중심으로 선택했는가?',
        '실제 안전 경고는 필요한 위치와 주의 항목에 명확히 두되, 같은 경고를 여러 항목에 반복해 글의 중심을 바꾸지 않았는가?',
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
