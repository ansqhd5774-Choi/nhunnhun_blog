const FOOD_AXES = [
  {
    expectedAxis:'정의·주요 성분·작용',
    readerQuestion:'이 음식은 무엇이며, 일반 영양표 외에 이 음식을 특징짓는 대표 성분·작용은 무엇인가?',
    reviewQuestion:'조사에서 확인된 대표 성분·저장 탄수화물·색소·향 성분 등 이 음식의 특징을 일반 열량·비타민·무기질 표에 묻히게 하지 않았는가? 근거가 없는 고유 성분을 억지로 만들지 않았는가?'
  },
  {
    expectedAxis:'핵심 효능·예방 효과',
    readerQuestion:'이 음식의 핵심 효능은 무엇이며, 사람에게 어디까지 확인됐는가?',
    reviewQuestion:'제목·검색 의도가 효능·건강 효과를 약속한다면 H2와 첫 문장이 확인된 이점·식품 가치와 사람에게 확인된 범위를 먼저 직접 답하는가? 연구 한계·안전·맛 설명만으로 이 축을 대신하거나 부정 설명을 첫 답변으로 세우지 않았는가?'
  },
  {
    expectedAxis:'섭취법·권장량',
    readerQuestion:'얼마나·어떻게 먹는가? 공식 권장량이 있는가?',
    reviewQuestion:'H2와 첫 문장이 실제 섭취 방법·양·공식 권장량 유무를 직접 답하는가? ⑤에서 다룰 독성·고용량 경고를 이 축에 반복하지 않고 실제 섭취 행동에 필요한 최소 주의만 남겼는가?'
  },
  {
    expectedAxis:'궁합·상호작용',
    readerQuestion:'무엇과 먹으면 좋고, 실제 상호작용인지 단순 풍미 조합인지?',
    reviewQuestion:'H2와 첫 문장이 무엇과 먹는지와 이유를 답하고 실제 작용·흡수와 단순 풍미 조합을 구분하는가?'
  },
  {
    expectedAxis:'부작용·주의 대상',
    readerQuestion:'부작용은 무엇이고 누가 주의해야 하는가?',
    reviewQuestion:'H2와 첫 문장이 정상 반응·부작용·주의 대상을 구분해 직접 답하며, 독성·고용량·금기·응급 행동을 이 축에 집중해 다른 축의 반복 경고를 줄였는가?'
  },
  {
    expectedAxis:'신선도·보관·조리 팁',
    readerQuestion:'신선한 것을 어떻게 고르고, 보관·조리하면 좋은가?',
    reviewQuestion:'H2와 첫 문장이 고르는 기준과 보관·조리 행동을 구체적으로 답하는가?'
  }
];

const BALANCE_REVIEW_QUESTIONS=[
  '도입·핵심 요약이 음식의 정체·확인된 장점·실제 활용을 먼저 보여주고, 일반 안전 경고를 첫 인상으로 만들지 않았는가? 단, 즉시 위험 행동이 검색 의도의 중심이면 예외다.',
  '② 효능의 첫 문단이 확인된 이점·작용 또는 실제 식품 가치를 먼저 설명한 뒤 필요한 근거 한계를 짧게 두는가? 없는 효능을 만들지는 않았는가?',
  '사람 연구 부족·미확인·공식 권장량 없음·고용량 위험 같은 동일 의미를 도입·②·③·⑤·FAQ·요약에 반복하지 않았는가?',
  '독성·고용량·금기·응급 행동은 원칙적으로 ⑤에 집중하고, 다른 축에는 그 자리의 행동 결정에 꼭 필요한 최소 주의만 남겼는가?',
  'mark·최고강조가 건강·영양 판단에 직접 필요한 정보(사람에게 확인된 효능·효과 범위, 핵심 성분의 건강상 역할, 섭취 조건·제형 차이, 실제 금기·응급 행동)를 먼저 드러내는가? 맛·향·조리 팁·품종 비교만으로 mark·최고강조 하한을 채우지 않았는가?'
];

// Keep this utility set aligned with publishing/direct-focus.mjs.
const UTILITY_HEADING_RE=/^(?:자주\s*묻는\s*질문|FAQ|핵심\s*정리|함께\s*보면\s*좋은\s*글|자료\s*출처)$/iu;

function decodeHtml(text){
  return String(text??'')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&#x27;/gi,"'");
}

function textOnly(html){
  return decodeHtml(String(html??'')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' '))
    .replace(/\s+/g,' ')
    .trim();
}

function normalizedHeading(value){
  return String(value??'').replace(/^\d+[.)]\s*/u,'').trim();
}

function firstAnswer(segment){
  const blocks=String(segment??'').matchAll(/<(p|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi);
  for(const match of blocks){
    const answer=textOnly(match[2]);
    if(answer)return answer;
  }
  return '';
}

export function buildFoodAxisReview(source={}){
  const html=String(source.bodyHtml??'');
  const allHeadings=[...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)]
    .map((match,order)=>({
      order,
      index:match.index??0,
      end:(match.index??0)+match[0].length,
      heading:textOnly(match[1])
    }))
    .filter(item=>item.heading);
  const coreHeadings=allHeadings.filter(item=>!UTILITY_HEADING_RE.test(normalizedHeading(item.heading)));
  const reviewHeadings=coreHeadings.slice(0,6);

  const axes=FOOD_AXES.map((definition,index)=>{
    const item=reviewHeadings[index];
    const next=item?allHeadings.find(heading=>heading.order>item.order):null;
    const segment=item?html.slice(item.end,next?.index??html.length):'';
    return {
      axis:index+1,
      ...definition,
      heading:item?.heading??'',
      firstAnswer:firstAnswer(segment)
    };
  });

  return {
    assessment:'AUTHOR_REVIEW_REQUIRED',
    automatedSemanticVerdict:false,
    observedCoreH2Count:coreHeadings.length,
    axes,
    balanceReview:{
      status:'AUTHOR_REVIEW_REQUIRED',
      automatedSemanticVerdict:false,
      questions:[...BALANCE_REVIEW_QUESTIONS]
    }
  };
}
