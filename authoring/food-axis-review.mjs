const FOOD_RULE_SOURCE='docs/project-instructions/PROJECT_INSTRUCTIONS_FOOD_R8.1.txt';
const FOOD_QUALITY_RULE_SOURCE='docs/content/FOOD_CONTENT_QUALITY_R1.md';
const FOOD_AXES = [
  {expectedAxis:'소개',readerQuestion:'이 음식은 무엇이고, 어떤 맛·식감·종류·제철·산지 특징이 있는가?',reviewQuestion:'처음 보는 일반 독자가 이 음식의 정체와 특징을 바로 이해할 수 있는가? 소개에 제철 정보가 실제 문장으로 포함됐는가? 제철 작성 전 다른 국내 음식 블로그 최소 2개를 직접 확인했고, 상충 시 어종·품종·산지·유통 형태 차이를 교차확인했는가?'},
  {expectedAxis:'영양소·핵심 성분',readerQuestion:'이 음식에서 중요한 영양소와 핵심 성분은 무엇이고 몸에서 어떤 역할을 하는가?',reviewQuestion:'영양소 이름과 숫자만 나열하지 않고 중요한 성분의 역할을 쉬운 말로 설명했는가? 일반 영양표가 음식 고유 특징을 밀어내지 않았는가?'},
  {expectedAxis:'꾸준 섭취 변화',readerQuestion:'이 음식을 꾸준히 먹으면 몸에서 어떤 긍정적인 변화가 기대되는가?',reviewQuestion:'체중 관리·근육·심혈관·뇌·에너지 대사·장·뼈·면역·피부 등 음식 특성에 맞는 실제 신체 변화를 중심으로 설명했는가? 조리·보관 편의나 식사 지속성이 핵심을 대신하지 않았는가? 작성 과정 설명보다 독자가 체감할 변화와 실제 의미에 집중했는가?'},
  {expectedAxis:'궁합·시너지',readerQuestion:'무엇과 함께 먹으면 좋고, 왜 좋은지, 실제로 어떻게 먹으면 되는가?',reviewQuestion:'무엇과 먹는지·왜 좋은지·어떻게 먹는지를 함께 답했는가? 영양 보완과 맛·식감 조합을 과장 없이 실용적으로 설명했는가?'},
  {expectedAxis:'주의사항',readerQuestion:'누가 어떤 상황에서 주의해야 하고, 실제로 무엇을 조심하면 되는가?',reviewQuestion:'알레르기·독성·과다섭취·중요한 상호작용처럼 행동을 바꿔야 하는 주의만 남겼는가? 일반적인 부정·제한 문장으로 분량을 채우지 않았는가?'},
  {expectedAxis:'고르는 법·보관법',readerQuestion:'좋은 제품을 어떻게 고르고, 집에서는 어떻게 보관하면 되는가?',reviewQuestion:'신선도·구매 기준·제품 형태·보관 위치와 방법을 구체적으로 답했는가? 독자가 바로 적용할 수 있는 행동 정보가 있는가?'}
];
const BALANCE_REVIEW_QUESTIONS=[
  '기존 음식 글 전체 재작성이라면 기존 본문을 초안·문장 재료로 쓰지 않고, 빈 문서에서 정확한 검색어 벤치마크와 새 조사로 처음부터 작성했는가? 부분 수정은 사용자가 범위를 명시한 경우에만 했는가?',
  '도입과 본문 첫인상이 음식의 특징·영양·장점·활용을 먼저 보여주는가?',
  '사용자 확정 6개 소제목의 이름·순서·의미를 임의 변경하지 않았는가?',
  '소개에 제철 정보가 실제 문장으로 들어갔는가?',
  '제철 정보를 작성하기 전에 다른 국내 음식 블로그 최소 2개를 직접 확인했는가?',
  '블로그 간 제철 설명이 다를 경우 어종·품종·산지·자연산/양식·생물/냉동·가공 형태 차이를 추가 조사해 교차확인했는가?',
  '③ 꾸준 섭취 변화가 조리·보관 편의가 아니라 실제 긍정적 신체 변화를 중심으로 작성됐는가?',
  '③ 본문이 사실 확인 과정 설명보다 독자가 기대할 변화와 실제 의미에 집중하는가?',
  '제철·산지·정의·명칭·분류·배경 설명을 단지 필수 포함 정보라는 이유만으로 형광펜이나 밑줄 처리하지 않았는가?',
  '각 형광펜·밑줄 문장을 놓쳤을 때 독자의 건강 이해·선택·섭취·보관 행동이 실제로 달라지는가? 아니라면 일반 문장 또는 굵게로 낮췄는가?',
  '부정·제한·반박 문장이 글 전체를 압도하지 않고, 꼭 필요한 주의는 ⑤ 주의사항에 집중했는가?',
  '확인해서 사용할 수 없는 내용은 생략하고 독자에게 필요한 다른 생활정보를 추가 조사했는가?',
  '같은 사실을 도입·표·본문·요약에서 표현이나 숫자만 바꿔 반복하지 않았는가?',
  '100mL→200mL처럼 단순 배수·단위 환산·산술 확장으로 표의 행이나 열을 채우지 않았는가?',
  '표의 각 행·열이 독자에게 새로운 선택·섭취·보관 판단 정보를 주는가?',
  '일반 영양표가 음식 고유 특징·제품/형태 차이·실제 선택 정보를 밀어내지 않았는가?',
  '내용이 얕은 부분을 문장·표·강조로 늘리지 않고 벤치마크와 추가 조사로 보강했는가?',
  '구매·섭취·궁합·주의·보관 중 독자가 실제 행동으로 옮길 수 있는 정보가 충분한가?'
];
const UTILITY_HEADING_RE=/^(?:자주\s*묻는\s*질문|FAQ|핵심\s*정리|함께\s*보면\s*좋은\s*글|자료\s*출처)$/iu;
function decodeHtml(text){return String(text??'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;|&#x27;/gi,"'");}
function textOnly(html){return decodeHtml(String(html??'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();}
function normalizedHeading(value){return String(value??'').replace(/^\d+[.)]\s*/u,'').trim();}
function firstAnswer(segment){const blocks=String(segment??'').matchAll(/<(p|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi);for(const match of blocks){const answer=textOnly(match[2]);if(answer)return answer;}return '';}
export function buildFoodAxisReview(source={}){
  const html=String(source.bodyHtml??'');
  const allHeadings=[...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((match,order)=>({order,index:match.index??0,end:(match.index??0)+match[0].length,heading:textOnly(match[1])})).filter(item=>item.heading);
  const coreHeadings=allHeadings.filter(item=>!UTILITY_HEADING_RE.test(normalizedHeading(item.heading)));
  const reviewHeadings=coreHeadings.slice(0,6);
  const axes=FOOD_AXES.map((definition,index)=>{const item=reviewHeadings[index];const next=item?allHeadings.find(heading=>heading.order>item.order):null;const segment=item?html.slice(item.end,next?.index??html.length):'';return {axis:index+1,...definition,heading:item?.heading??'',firstAnswer:firstAnswer(segment)};});
  return {assessment:'AUTHOR_REVIEW_REQUIRED',automatedSemanticVerdict:false,scope:'FOOD_ONLY',ruleSource:FOOD_RULE_SOURCE,qualityRuleSource:FOOD_QUALITY_RULE_SOURCE,observedCoreH2Count:coreHeadings.length,axes,balanceReview:{status:'AUTHOR_REVIEW_REQUIRED',automatedSemanticVerdict:false,scope:'FOOD_ONLY',ruleSource:FOOD_RULE_SOURCE,qualityRuleSource:FOOD_QUALITY_RULE_SOURCE,questions:[...BALANCE_REVIEW_QUESTIONS]}};
}
