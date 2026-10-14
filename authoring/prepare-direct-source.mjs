import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {checkUpdateSource} from '../publishing/update-core.mjs';
import {renderDirectArticle} from '../publishing/direct-design.mjs';
import {directFocusReview} from '../publishing/direct-focus.mjs';
import {imageReviewObservation} from '../publishing/image-review.mjs';
import {observeEmphasis} from './emphasis-summary.mjs';
import {pairingReview} from './pairing-review.mjs';
import {buildFoodAxisReview} from './food-axis-review.mjs';
import {checkPost,checkPublishHtml} from '../publishing/core.mjs';
import {directPreflight} from '../publishing/direct-preflight.mjs';

// A single local preparation view; no AI, network or publication.
export function prepareDirectSource(source) {
  if(source.articleId)checkUpdateSource(source,source.id+'.json');
  else {checkPost(source,source.id+'.json');checkPublishHtml(source);}
  const observation=observeEmphasis(source.bodyHtml,{category:source.category});
  const focusReview=directFocusReview(source.bodyHtml);
  const foodAxisReview=source.category==='음식'?buildFoodAxisReview(source):null;
  const imageEditorialReview=imageReviewObservation(source);
  return {
    report:{sourceId:source.id,preflight:directPreflight(source),...observation,focusReview,pairingReview:pairingReview(source.bodyHtml,source.category),imageEditorialReview,...(foodAxisReview?{foodAxisReview}:{}),
      editorialReview:{status:'AUTHOR_REVIEW_REQUIRED',automatedSemanticVerdict:false,questions:[
        '이 키워드를 검색한 독자가 가장 먼저 알고 싶은 핵심 질문을 6개 이내로 정리했는가?',
        '각 핵심 소제목이 독자의 질문 하나에 직접 답하며 세부 설명 때문에 별도 대주제를 불필요하게 만들지 않았는가?',
        '분야에 맞는 건강·영양 중심 제목인가? 제목이 약속한 중심 질문에 직접 답하는가?',
        '도입·핵심 요약·소개·효과·활용은 음식의 정체·건강상 장점·영양적 역할·실제 활용을 먼저 충분히 설명하고, 즉시 위험이 중심인 주제가 아닌데 경고·부정·근거 한계를 첫 인상으로 만들지 않았는가?',
        '② 효능은 독자가 알고 싶은 건강상 장점과 몸에서 하는 역할, 실제 섭취 활용을 먼저 설명했는가? 연구 설계·근거 수준·한계는 독자 판단에 꼭 필요한 경우에만 짧게 남겼는가?',
        '연구·공식 자료는 주장 사실 확인에 사용하고, 종·부위·제형·용량이 다른 결과를 일반 식품의 효과로 바꾸지 않았는가?',
        '전통 사용 기록을 현대 치료·예방 효과로 바꾸지 않았는가?',
        '연구 방법·표본·통계·근거 수준 같은 작성자 검토 정보가 소제목이나 본문의 중심을 차지하거나 반복되지 않았는가?',
        '독성·고용량·금기·응급 행동은 원칙적으로 ⑤ 부작용·주의 대상에 집중하고, 다른 축에는 그 자리의 행동 결정에 꼭 필요한 최소 주의만 남겼는가?',
        '강한 강조(mark+strong, mark+u+strong)는 각 H2의 직접 답과 확인된 건강·영양·안전·섭취 가치를 우선했는가? 연구 한계·반박 문구를 강조 개수 충족용으로 올리지 않았는가?',
        '강조는 카테고리별 하한을 충족하되 숫자를 맞추기 위해 문장·효능·색을 억지로 추가하지 않았는가?',
        '음식 이미지는 저장 전에 한 번만 실제로 열어 보고, 최소 2장은 음식 자체가 화면의 주 피사체인지 확인했는가? 밭·꽃·식당 전체·다른 음식이 중심인 사진은 보조 맥락 사진 1장 이내로 두고, 실제 확인하지 않았으면 visualChecked:true를 기록하지 않았는가?',
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
